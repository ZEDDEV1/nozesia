/**
 * API: Deal Actions
 * 
 * GET /api/deals/[id] - Buscar deal
 * PATCH /api/deals/[id] - Atualizar deal (stage, notas, valor)
 * DELETE /api/deals/[id] - Excluir deal
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { logger } from "@/lib/logger";

interface RouteParams {
    params: Promise<{ id: string }>;
}

/**
 * GET /api/deals/[id] - Get deal by ID
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

        const deal = await prisma.deal.findFirst({
            where: {
                id,
                companyId: user.companyId,
            },
        });

        if (!deal) {
            return NextResponse.json(
                { success: false, error: "Deal não encontrado" },
                { status: 404 }
            );
        }

        return NextResponse.json({
            success: true,
            data: deal,
        });

    } catch (error) {
        logger.error("[Deals API] Error", { error, route: "/api/deals/[id]" });
        return NextResponse.json(
            { success: false, error: "Erro ao buscar deal" },
            { status: 500 }
        );
    }
}

/**
 * PATCH /api/deals/[id] - Update deal
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
        const { stage, title, value, notes, customerName } = body;

        // Verify deal belongs to company
        const existing = await prisma.deal.findFirst({
            where: {
                id,
                companyId: user.companyId,
            },
        });

        if (!existing) {
            return NextResponse.json(
                { success: false, error: "Deal não encontrado" },
                { status: 404 }
            );
        }

        // Build update data
        const updateData: Record<string, unknown> = {};
        if (stage !== undefined) {
            updateData.stage = stage;
            // Set closedAt when moving to closed stages
            if (stage === "CLOSED_WON" || stage === "CLOSED_LOST") {
                updateData.closedAt = new Date();
            } else {
                updateData.closedAt = null;
            }
        }
        if (title !== undefined) updateData.title = title;
        if (value !== undefined) updateData.value = value;
        if (notes !== undefined) updateData.notes = notes;
        if (customerName !== undefined) updateData.customerName = customerName;

        const deal = await prisma.deal.update({
            where: { id },
            data: updateData,
        });

        return NextResponse.json({
            success: true,
            data: deal,
        });

    } catch (error) {
        logger.error("[Deals API] Error", { error, route: "/api/deals/[id]" });
        return NextResponse.json(
            { success: false, error: "Erro ao atualizar deal" },
            { status: 500 }
        );
    }
}

/**
 * DELETE /api/deals/[id] - Delete deal
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

        // Verify deal belongs to company
        const existing = await prisma.deal.findFirst({
            where: {
                id,
                companyId: user.companyId,
            },
        });

        if (!existing) {
            return NextResponse.json(
                { success: false, error: "Deal não encontrado" },
                { status: 404 }
            );
        }

        await prisma.deal.delete({
            where: { id },
        });

        return NextResponse.json({
            success: true,
            message: "Deal excluído!",
        });

    } catch (error) {
        logger.error("[Deals API] Error", { error, route: "/api/deals/[id]" });
        return NextResponse.json(
            { success: false, error: "Erro ao excluir deal" },
            { status: 500 }
        );
    }
}
