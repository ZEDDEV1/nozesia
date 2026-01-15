/**
 * API: Campaign by ID
 * 
 * GET - Get campaign details
 * PATCH - Update campaign
 * DELETE - Delete campaign
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { logger } from "@/lib/logger";

interface RouteParams {
    params: Promise<{ id: string }>;
}

/**
 * GET /api/campaigns/[id] - Get campaign details
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
    try {
        const user = await getCurrentUser();
        if (!user || !user.companyId) {
            return NextResponse.json(
                { success: false, error: "Não autorizado" },
                { status: 401 }
            );
        }

        const { id } = await params;

        const campaign = await prisma.campaign.findFirst({
            where: {
                id,
                companyId: user.companyId,
            },
            include: {
                recipients: {
                    take: 100,
                    orderBy: { sentAt: "desc" },
                },
                _count: {
                    select: { recipients: true },
                },
            },
        });

        if (!campaign) {
            return NextResponse.json(
                { success: false, error: "Campanha não encontrada" },
                { status: 404 }
            );
        }

        // Calculate recipient stats
        const recipientStats = await prisma.campaignRecipient.groupBy({
            by: ["status"],
            where: { campaignId: id },
            _count: true,
        });

        const stats = recipientStats.reduce((acc, s) => {
            acc[s.status] = s._count;
            return acc;
        }, {} as Record<string, number>);

        return NextResponse.json({
            success: true,
            data: {
                ...campaign,
                stats,
            },
        });
    } catch (error) {
        logger.error("[API Campaigns] GET error", { error, route: "/api/campaigns/[id]", method: "GET" });
        return NextResponse.json(
            { success: false, error: "Erro ao buscar campanha" },
            { status: 500 }
        );
    }
}

/**
 * PATCH /api/campaigns/[id] - Update campaign
 */
export async function PATCH(request: NextRequest, { params }: RouteParams) {
    try {
        const user = await getCurrentUser();
        if (!user || !user.companyId) {
            return NextResponse.json(
                { success: false, error: "Não autorizado" },
                { status: 401 }
            );
        }

        const { id } = await params;
        const body = await request.json();
        const { status, scheduledAt, settings } = body;

        // Verify ownership
        const campaign = await prisma.campaign.findFirst({
            where: { id, companyId: user.companyId },
        });

        if (!campaign) {
            return NextResponse.json(
                { success: false, error: "Campanha não encontrada" },
                { status: 404 }
            );
        }

        // Build update data
        const updateData: Record<string, unknown> = {};

        if (status) {
            updateData.status = status;

            // Update timestamps based on status
            if (status === "RUNNING") updateData.startedAt = new Date();
            if (status === "PAUSED") updateData.pausedAt = new Date();
            if (status === "COMPLETED") updateData.completedAt = new Date();
        }

        if (scheduledAt !== undefined) {
            updateData.scheduledAt = scheduledAt ? new Date(scheduledAt) : null;
        }

        if (settings) {
            updateData.settings = {
                ...(campaign.settings as object),
                ...settings,
            };
        }

        const updated = await prisma.campaign.update({
            where: { id },
            data: updateData,
        });

        return NextResponse.json({
            success: true,
            data: updated,
        });
    } catch (error) {
        logger.error("[API Campaigns] PATCH error", { error, route: "/api/campaigns/[id]", method: "PATCH" });
        return NextResponse.json(
            { success: false, error: "Erro ao atualizar campanha" },
            { status: 500 }
        );
    }
}

/**
 * DELETE /api/campaigns/[id] - Delete campaign
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
    try {
        const user = await getCurrentUser();
        if (!user || !user.companyId) {
            return NextResponse.json(
                { success: false, error: "Não autorizado" },
                { status: 401 }
            );
        }

        const { id } = await params;

        // Verify ownership and status
        const campaign = await prisma.campaign.findFirst({
            where: { id, companyId: user.companyId },
        });

        if (!campaign) {
            return NextResponse.json(
                { success: false, error: "Campanha não encontrada" },
                { status: 404 }
            );
        }

        if (campaign.status === "RUNNING") {
            return NextResponse.json(
                { success: false, error: "Não é possível excluir campanha em execução" },
                { status: 400 }
            );
        }

        // Delete campaign (recipients will be cascade deleted)
        await prisma.campaign.delete({
            where: { id },
        });

        return NextResponse.json({
            success: true,
            message: "Campanha excluída com sucesso",
        });
    } catch (error) {
        logger.error("[API Campaigns] DELETE error", { error, route: "/api/campaigns/[id]", method: "DELETE" });
        return NextResponse.json(
            { success: false, error: "Erro ao excluir campanha" },
            { status: 500 }
        );
    }
}
