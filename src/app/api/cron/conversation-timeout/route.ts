/**
 * API: Cron - Conversation Timeout
 * 
 * Verifica conversas inativas e envia avisos/fecha automaticamente.
 * Deve ser chamado a cada 5 minutos por um serviço de cron externo.
 * 
 * POST /api/cron/conversation-timeout
 * 
 * Headers:
 *   Authorization: Bearer CRON_SECRET (set in env)
 * 
 * INTELIGÊNCIA DO TIMEOUT:
 * - Só envia aviso se cliente PAROU NO MEIO do processo
 * - NÃO envia aviso se IA já terminou seu trabalho (pedido feito, consulta marcada)
 */

import { NextRequest, NextResponse } from "next/server";
import { processInactiveConversations, TIMEOUT_CONFIG } from "@/lib/conversation-timeout";
import { logger } from "@/lib/logger";

// Verify cron secret
function verifyCronSecret(request: NextRequest): boolean {
    const authHeader = request.headers.get("authorization");
    const cronSecret = process.env.CRON_SECRET;

    // If no secret configured, allow (for local testing)
    if (!cronSecret) return true;

    return authHeader === `Bearer ${cronSecret}`;
}

/**
 * POST /api/cron/conversation-timeout - Execute timeout check
 */
export async function POST(request: NextRequest) {
    // Verify authorization
    if (!verifyCronSecret(request)) {
        return NextResponse.json(
            { success: false, error: "Unauthorized" },
            { status: 401 }
        );
    }

    try {
        logger.info("[ConversationTimeout Cron] Starting execution");

        const results = await processInactiveConversations();

        // Summarize results
        const summary = {
            total: results.length,
            warningsSent: results.filter(r => r.action === "WARNING_SENT").length,
            closed: results.filter(r => r.action === "CLOSED").length,
            skipped: results.filter(r => r.action === "SKIPPED").length,
            errors: results.filter(r => r.action === "ERROR").length,
        };

        logger.info("[ConversationTimeout Cron] Completed", summary);

        return NextResponse.json({
            success: true,
            message: `Processed ${summary.total} conversations`,
            summary,
            details: results,
        });
    } catch (error) {
        logger.error("[ConversationTimeout Cron] Error", {
            error,
            route: "/api/cron/conversation-timeout",
            method: "POST"
        });
        return NextResponse.json(
            { success: false, error: "Internal server error" },
            { status: 500 }
        );
    }
}

/**
 * GET /api/cron/conversation-timeout - Get configuration info
 */
export async function GET(request: NextRequest) {
    // Verify authorization
    if (!verifyCronSecret(request)) {
        return NextResponse.json(
            { success: false, error: "Unauthorized" },
            { status: 401 }
        );
    }

    return NextResponse.json({
        success: true,
        config: {
            warningAfterMinutes: TIMEOUT_CONFIG.warningAfterMinutes,
            closeAfterMinutes: TIMEOUT_CONFIG.closeAfterMinutes,
            maxConversationsPerRun: TIMEOUT_CONFIG.maxConversationsPerRun,
        },
        info: {
            description: "Intelligent conversation timeout system",
            logic: [
                "Only sends warning if customer stopped MID-PROCESS",
                "Does NOT send warning if AI completed work (order placed, appointment made)",
                "Checks: Orders, Appointments, AuditLogs for AI completion",
            ],
        },
    });
}
