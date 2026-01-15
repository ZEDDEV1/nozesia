/**
 * API: Start Campaign Dispatch
 * 
 * POST - Start or resume campaign dispatch
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { addCampaignJob } from "@/lib/queue-bullmq";
import { logger } from "@/lib/logger";

interface RouteParams {
    params: Promise<{ id: string }>;
}

/**
 * POST /api/campaigns/[id]/start - Start campaign dispatch
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
    try {
        const user = await getCurrentUser();
        if (!user || !user.companyId) {
            return NextResponse.json(
                { success: false, error: "Não autorizado" },
                { status: 401 }
            );
        }

        const { id } = await params;

        // Get campaign
        const campaign = await prisma.campaign.findFirst({
            where: { id, companyId: user.companyId },
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

        if (!campaign) {
            return NextResponse.json(
                { success: false, error: "Campanha não encontrada" },
                { status: 404 }
            );
        }

        // Check if already running
        if (campaign.status === "RUNNING") {
            return NextResponse.json(
                { success: false, error: "Campanha já em execução" },
                { status: 400 }
            );
        }

        // Check for active WhatsApp session
        const activeSession = campaign.company.sessions[0];
        if (!activeSession) {
            return NextResponse.json(
                { success: false, error: "Nenhuma sessão WhatsApp ativa" },
                { status: 400 }
            );
        }

        // Check for pending recipients
        const pendingCount = await prisma.campaignRecipient.count({
            where: {
                campaignId: id,
                status: "PENDING",
            },
        });

        if (pendingCount === 0) {
            return NextResponse.json(
                { success: false, error: "Nenhum destinatário pendente" },
                { status: 400 }
            );
        }

        // Update campaign status
        await prisma.campaign.update({
            where: { id },
            data: {
                status: "RUNNING",
                startedAt: campaign.startedAt || new Date(),
            },
        });

        // Add job to queue for background processing
        await addCampaignJob({
            campaignId: id,
            companyId: user.companyId,
            sessionName: activeSession.sessionName,
        });

        return NextResponse.json({
            success: true,
            message: "Campanha iniciada",
            data: {
                campaignId: id,
                pendingRecipients: pendingCount,
                sessionName: activeSession.sessionName,
            },
        });
    } catch (error) {
        logger.error("[API Campaigns] Start error", { error, route: "/api/campaigns/[id]/start" });
        return NextResponse.json(
            { success: false, error: "Erro ao iniciar campanha" },
            { status: 500 }
        );
    }
}
