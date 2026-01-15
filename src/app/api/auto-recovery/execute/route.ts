/**
 * API: Execute Auto Recovery (Manual Trigger)
 * 
 * POST /api/auto-recovery/execute
 * 
 * This allows the admin to manually trigger recovery for their company
 * without needing the cron secret.
 */

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { generateMessageVariations } from "@/lib/message-variations";
import { logger } from "@/lib/logger";

/**
 * POST /api/auto-recovery/execute - Manually execute auto recovery
 */
export async function POST() {
    try {
        const user = await getCurrentUser();
        if (!user || !user.companyId) {
            return NextResponse.json(
                { success: false, error: "Não autorizado" },
                { status: 401 }
            );
        }

        // Get company config
        const config = await prisma.autoRecoveryConfig.findUnique({
            where: { companyId: user.companyId },
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

        if (!config) {
            return NextResponse.json(
                { success: false, error: "Configurar recuperação automática primeiro" },
                { status: 400 }
            );
        }

        // Check for active session
        const session = config.company.sessions[0];
        if (!session) {
            return NextResponse.json(
                { success: false, error: "Nenhuma sessão WhatsApp ativa" },
                { status: 400 }
            );
        }

        // Calculate cutoff date
        const now = new Date();
        const cutoffDate = new Date(
            now.getTime() - config.inactiveDays * 24 * 60 * 60 * 1000
        );

        // Find inactive conversations
        const inactiveConversations = await prisma.conversation.findMany({
            where: {
                companyId: user.companyId,
                lastMessageAt: { lt: cutoffDate },
            },
            select: {
                customerPhone: true,
                customerName: true,
            },
            take: config.dailyLimit,
        });

        if (inactiveConversations.length === 0) {
            return NextResponse.json({
                success: true,
                message: "Nenhum cliente inativo encontrado",
                stats: { found: 0, eligible: 0, queued: 0 },
            });
        }

        // Get opted-out phones
        const optedOut = await prisma.contactPreference.findMany({
            where: {
                companyId: user.companyId,
                optedOut: true,
            },
            select: { phone: true },
        });
        const optedOutSet = new Set(optedOut.map(o => o.phone));

        // Filter eligible
        const eligibleCustomers = inactiveConversations.filter(
            c => !optedOutSet.has(c.customerPhone)
        );

        // Generate message variations
        const variations = await generateMessageVariations(
            config.message,
            config.company.name,
            5
        );

        // For now, create a campaign with these customers as recipients
        const campaign = await prisma.campaign.create({
            data: {
                companyId: user.companyId,
                name: `Recuperação Automática - ${new Date().toLocaleDateString("pt-BR")}`,
                originalMessage: config.message,
                variations,
                targetSegments: ["INACTIVE"],
                status: "DRAFT",
                totalRecipients: eligibleCustomers.length,
            },
        });

        // Add recipients
        await prisma.campaignRecipient.createMany({
            data: eligibleCustomers.map((c, i) => ({
                campaignId: campaign.id,
                phone: c.customerPhone,
                contactName: c.customerName,
                variationIndex: i % variations.length,
                status: "PENDING",
            })),
        });

        // Update config
        await prisma.autoRecoveryConfig.update({
            where: { id: config.id },
            data: {
                lastRunAt: now,
                lastRunCount: eligibleCustomers.length,
            },
        });

        return NextResponse.json({
            success: true,
            message: "Campanha de recuperação criada!",
            stats: {
                found: inactiveConversations.length,
                eligible: eligibleCustomers.length,
                campaignId: campaign.id,
            },
        });

    } catch (error) {
        logger.error("[AutoRecovery Execute] Error", { error, route: "/api/auto-recovery/execute" });
        return NextResponse.json(
            { success: false, error: "Erro ao executar recuperação" },
            { status: 500 }
        );
    }
}
