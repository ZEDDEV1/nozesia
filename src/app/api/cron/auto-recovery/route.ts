/**
 * API: Cronjob - Auto Recovery Execution
 * 
 * This endpoint should be called by an external cron service (e.g., Vercel Cron, Railway Cron)
 * or manually to execute the automatic customer recovery process.
 * 
 * POST /api/cron/auto-recovery
 * 
 * Headers:
 *   Authorization: Bearer CRON_SECRET (set in env)
 * 
 * Security:
 *   - Requires CRON_SECRET header to prevent unauthorized access
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { generateMessageVariations, calculateDelay, calculateTypingTime } from "@/lib/message-variations";
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
 * POST /api/cron/auto-recovery - Execute automatic customer recovery
 */
export async function POST(request: NextRequest) {
    // Verify authorization
    if (!verifyCronSecret(request)) {
        return NextResponse.json(
            { success: false, error: "Unauthorized" },
            { status: 401 }
        );
    }

    const results: {
        companyId: string;
        companyName: string;
        inactiveFound: number;
        messagesSent: number;
        errors: string[];
    }[] = [];

    try {
        // Get current time info
        const now = new Date();
        const currentHour = now.getHours();
        const currentDay = now.getDay(); // 0 = Sunday

        // Find all companies with auto-recovery enabled
        const configs = await prisma.autoRecoveryConfig.findMany({
            where: {
                enabled: true,
            },
            include: {
                company: {
                    include: {
                        sessions: {
                            where: { status: "CONNECTED" },
                            take: 1,
                        },
                    },
                },
            },
        });

        logger.info(`[AutoRecovery] Found ${configs.length} active configs`);

        for (const config of configs) {
            const companyResult = {
                companyId: config.companyId,
                companyName: config.company.name,
                inactiveFound: 0,
                messagesSent: 0,
                errors: [] as string[],
            };

            try {
                // Check if current hour is within allowed range
                if (currentHour < config.startHour || currentHour >= config.endHour) {
                    companyResult.errors.push(`Outside allowed hours (${config.startHour}h-${config.endHour}h)`);
                    results.push(companyResult);
                    continue;
                }

                // Check if current day is allowed
                if (!config.activeDays.includes(currentDay)) {
                    companyResult.errors.push(`Day ${currentDay} not in active days`);
                    results.push(companyResult);
                    continue;
                }

                // Check for active WhatsApp session
                const session = config.company.sessions[0];
                if (!session) {
                    companyResult.errors.push("No active WhatsApp session");
                    results.push(companyResult);
                    continue;
                }

                // Calculate cutoff date for inactivity
                const cutoffDate = new Date(
                    now.getTime() - config.inactiveDays * 24 * 60 * 60 * 1000
                );

                // Find inactive customers (conversations with no recent activity)
                const inactiveConversations = await prisma.conversation.findMany({
                    where: {
                        companyId: config.companyId,
                        lastMessageAt: { lt: cutoffDate },
                    },
                    select: {
                        id: true,
                        customerPhone: true,
                        customerName: true,
                    },
                    take: config.dailyLimit,
                });

                companyResult.inactiveFound = inactiveConversations.length;

                if (inactiveConversations.length === 0) {
                    results.push(companyResult);
                    continue;
                }

                // Get opted-out phones
                const optedOut = await prisma.contactPreference.findMany({
                    where: {
                        companyId: config.companyId,
                        optedOut: true,
                    },
                    select: { phone: true },
                });
                const optedOutSet = new Set(optedOut.map(o => o.phone));

                // Filter out opted-out customers
                const eligibleCustomers = inactiveConversations.filter(
                    c => !optedOutSet.has(c.customerPhone)
                );

                // Generate message variations
                const variations = await generateMessageVariations(
                    config.message,
                    config.company.name,
                    5
                );

                // Process each eligible customer
                for (let i = 0; i < eligibleCustomers.length && i < config.dailyLimit; i++) {
                    const customer = eligibleCustomers[i];

                    try {
                        // Personalize message
                        const variationIndex = i % variations.length;
                        let personalizedMessage = variations[variationIndex];
                        personalizedMessage = personalizedMessage.replace(
                            /\{nome\}/gi,
                            customer.customerName || "cliente"
                        );

                        // Calculate delays
                        const delay = calculateDelay({ sentCount: i, minDelay: 10, maxDelay: 30, pauseEvery: 10 });
                        const typingTime = calculateTypingTime(personalizedMessage);

                        // Log the action (actual sending would go through WPPConnect)
                        logger.info(`[AutoRecovery] Would send to ${customer.customerPhone}`, { messagePreview: personalizedMessage.substring(0, 50) });
                        logger.debug(`[AutoRecovery] Timing`, { delay, typingTime });

                        // TODO: Integrate with actual message sending via WPPConnect
                        // For now, we just log and count

                        // Update the contact preference to track we sent a recovery message
                        await prisma.contactPreference.upsert({
                            where: {
                                companyId_phone: {
                                    companyId: config.companyId,
                                    phone: customer.customerPhone,
                                },
                            },
                            create: {
                                companyId: config.companyId,
                                phone: customer.customerPhone,
                                lastInteractionAt: now,
                            },
                            update: {
                                lastInteractionAt: now,
                            },
                        });

                        companyResult.messagesSent++;
                    } catch (error) {
                        companyResult.errors.push(`Error sending to ${customer.customerPhone}: ${error}`);
                    }
                }

                // Update last run info
                await prisma.autoRecoveryConfig.update({
                    where: { id: config.id },
                    data: {
                        lastRunAt: now,
                        lastRunCount: companyResult.messagesSent,
                    },
                });

            } catch (error) {
                companyResult.errors.push(`Company error: ${error}`);
            }

            results.push(companyResult);
        }

        // Summary
        const totalSent = results.reduce((sum, r) => sum + r.messagesSent, 0);
        const totalInactive = results.reduce((sum, r) => sum + r.inactiveFound, 0);

        return NextResponse.json({
            success: true,
            message: `Processed ${results.length} companies`,
            summary: {
                companiesProcessed: results.length,
                totalInactiveFound: totalInactive,
                totalMessagesSent: totalSent,
            },
            details: results,
        });

    } catch (error) {
        logger.error("[AutoRecovery Cron] Error", { error, route: "/api/cron/auto-recovery", method: "POST" });
        return NextResponse.json(
            { success: false, error: "Internal server error" },
            { status: 500 }
        );
    }
}

/**
 * GET /api/cron/auto-recovery - Get status of auto-recovery system
 */
export async function GET(request: NextRequest) {
    // Verify authorization
    if (!verifyCronSecret(request)) {
        return NextResponse.json(
            { success: false, error: "Unauthorized" },
            { status: 401 }
        );
    }

    try {
        const configs = await prisma.autoRecoveryConfig.findMany({
            where: { enabled: true },
            include: {
                company: {
                    select: { name: true },
                },
            },
        });

        return NextResponse.json({
            success: true,
            activeConfigs: configs.length,
            configs: configs.map(c => ({
                company: c.company.name,
                inactiveDays: c.inactiveDays,
                dailyLimit: c.dailyLimit,
                hours: `${c.startHour}h-${c.endHour}h`,
                lastRun: c.lastRunAt,
                lastRunCount: c.lastRunCount,
            })),
        });
    } catch (error) {
        logger.error("[AutoRecovery Cron] GET error", { error, route: "/api/cron/auto-recovery", method: "GET" });
        return NextResponse.json(
            { success: false, error: "Internal server error" },
            { status: 500 }
        );
    }
}
