/**
 * Webhook Service
 * 
 * Dispatches events to configured webhook endpoints.
 * Supports retries, HMAC signing, and logging.
 */

import crypto from "crypto";
import { prisma } from "./prisma";
import { logger } from "./logger";

// Webhook event types
export type WebhookEventType =
    | "NEW_CONVERSATION"
    | "MESSAGE_RECEIVED"
    | "SALE_COMPLETED"
    | "CUSTOMER_INTEREST"
    | "HUMAN_TRANSFER"
    | "CONVERSATION_CLOSED"
    | "MEETING_SCHEDULED"
    | "CONSULTATION_BOOKED"
    | "QUOTE_REQUESTED"
    | "APPOINTMENT_REMINDER"
    | "PAYMENT_RECEIVED"
    | "LEAD_CAPTURED"
    | "TEST"; // Special test event

// Payload interfaces
interface WebhookPayload {
    event: WebhookEventType;
    timestamp: string;
    data: Record<string, unknown>;
}

interface DispatchResult {
    webhookId: string;
    success: boolean;
    statusCode?: number;
    error?: string;
}

// ============================
// HMAC SIGNATURE
// ============================

/**
 * Generate HMAC-SHA256 signature for webhook payload
 */
function generateSignature(payload: string, secret: string): string {
    return crypto
        .createHmac("sha256", secret)
        .update(payload)
        .digest("hex");
}

// ============================
// DISPATCH WEBHOOK
// ============================

/**
 * Send a webhook to a single endpoint
 */
async function sendWebhook(
    webhook: {
        id: string;
        url: string;
        secret: string | null;
        headers: string | null;
        timeoutMs: number;
        retryCount: number;
    },
    payload: WebhookPayload
): Promise<DispatchResult> {
    const payloadString = JSON.stringify(payload);
    let attempts = 0;
    let lastError: string | null = null;
    let statusCode: number | undefined;
    let responseBody: string | undefined;

    // Build headers
    const headers: Record<string, string> = {
        "Content-Type": "application/json",
        "User-Agent": "NozesIA-Webhook/1.0",
    };

    // Add signature if secret is provided
    if (webhook.secret) {
        headers["X-Webhook-Signature"] = generateSignature(payloadString, webhook.secret);
    }

    // Add custom headers
    if (webhook.headers) {
        try {
            const customHeaders = JSON.parse(webhook.headers);
            Object.assign(headers, customHeaders);
        } catch {
            logger.warn("[Webhook] Invalid custom headers JSON", { webhookId: webhook.id });
        }
    }

    // Retry loop
    while (attempts < webhook.retryCount) {
        attempts++;

        try {
            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), webhook.timeoutMs);

            const response = await fetch(webhook.url, {
                method: "POST",
                headers,
                body: payloadString,
                signal: controller.signal,
            });

            clearTimeout(timeout);
            statusCode = response.status;
            responseBody = await response.text();

            if (response.ok) {
                // Success! Log and return
                await prisma.webhookLog.create({
                    data: {
                        webhookId: webhook.id,
                        event: payload.event,
                        payload: payloadString,
                        statusCode,
                        response: responseBody.substring(0, 1000), // Truncate
                        success: true,
                        attempts,
                    },
                });

                logger.info("[Webhook] Delivered successfully", {
                    webhookId: webhook.id,
                    event: payload.event,
                    statusCode,
                    attempts,
                });

                return { webhookId: webhook.id, success: true, statusCode };
            }

            lastError = `HTTP ${statusCode}: ${responseBody.substring(0, 200)}`;
        } catch (error) {
            if (error instanceof Error) {
                if (error.name === "AbortError") {
                    lastError = `Timeout after ${webhook.timeoutMs}ms`;
                } else {
                    lastError = error.message;
                }
            } else {
                lastError = "Unknown error";
            }
        }

        // Wait before retry (exponential backoff)
        if (attempts < webhook.retryCount) {
            await new Promise((resolve) => setTimeout(resolve, 1000 * attempts));
        }
    }

    // All retries failed
    await prisma.webhookLog.create({
        data: {
            webhookId: webhook.id,
            event: payload.event,
            payload: payloadString,
            statusCode,
            response: responseBody?.substring(0, 1000),
            success: false,
            attempts,
            error: lastError,
        },
    });

    logger.error("[Webhook] Failed after retries", {
        webhookId: webhook.id,
        event: payload.event,
        attempts,
        error: lastError,
    });

    return { webhookId: webhook.id, success: false, statusCode, error: lastError || undefined };
}

// ============================
// DISPATCH TO ALL WEBHOOKS
// ============================

/**
 * Dispatch an event to all webhooks configured for that event type
 */
export async function dispatchWebhook(
    companyId: string,
    event: WebhookEventType,
    data: Record<string, unknown>
): Promise<DispatchResult[]> {
    // Find all active webhooks for this company that listen to this event
    const webhooks = await prisma.webhook.findMany({
        where: {
            companyId,
            isActive: true,
        },
    });

    // Filter webhooks that have this event configured
    const matchingWebhooks = webhooks.filter((webhook) => {
        try {
            const events = JSON.parse(webhook.events) as string[];
            return events.includes(event);
        } catch {
            return false;
        }
    });

    if (matchingWebhooks.length === 0) {
        return [];
    }

    // Build payload
    const payload: WebhookPayload = {
        event,
        timestamp: new Date().toISOString(),
        data,
    };

    // Dispatch to all matching webhooks in parallel
    const results = await Promise.all(
        matchingWebhooks.map((webhook) => sendWebhook(webhook, payload))
    );

    logger.info("[Webhook] Dispatched event", {
        companyId,
        event,
        totalWebhooks: matchingWebhooks.length,
        successful: results.filter((r) => r.success).length,
    });

    return results;
}

// ============================
// HELPER FUNCTIONS
// ============================

/**
 * Dispatch NEW_CONVERSATION event
 */
export async function dispatchNewConversation(
    companyId: string,
    conversationId: string,
    customerPhone: string,
    customerName?: string
) {
    return dispatchWebhook(companyId, "NEW_CONVERSATION", {
        conversationId,
        customerPhone,
        customerName,
    });
}

/**
 * Dispatch SALE_COMPLETED event
 */
export async function dispatchSaleCompleted(
    companyId: string,
    orderId: string,
    customerPhone: string,
    totalValue: number,
    items: Array<{ name: string; quantity: number; price: number }>
) {
    return dispatchWebhook(companyId, "SALE_COMPLETED", {
        orderId,
        customerPhone,
        totalValue,
        items,
    });
}

/**
 * Dispatch CUSTOMER_INTEREST event
 */
export async function dispatchCustomerInterest(
    companyId: string,
    customerPhone: string,
    productName: string,
    notes?: string
) {
    return dispatchWebhook(companyId, "CUSTOMER_INTEREST", {
        customerPhone,
        productName,
        notes,
    });
}

/**
 * Dispatch HUMAN_TRANSFER event
 */
export async function dispatchHumanTransfer(
    companyId: string,
    conversationId: string,
    customerPhone: string,
    reason?: string
) {
    return dispatchWebhook(companyId, "HUMAN_TRANSFER", {
        conversationId,
        customerPhone,
        reason,
    });
}

/**
 * Dispatch CONVERSATION_CLOSED event
 */
export async function dispatchConversationClosed(
    companyId: string,
    conversationId: string,
    customerPhone: string,
    totalMessages: number
) {
    return dispatchWebhook(companyId, "CONVERSATION_CLOSED", {
        conversationId,
        customerPhone,
        totalMessages,
    });
}
