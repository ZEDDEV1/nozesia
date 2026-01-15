/**
 * API: Deals (Pipeline CRM)
 * 
 * GET /api/deals - Listar deals da empresa
 * POST /api/deals - Criar novo deal
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { DealStage } from "@prisma/client";
import { logger } from "@/lib/logger";

interface DealData {
    id: string;
    companyId: string;
    customerPhone: string;
    customerName: string | null;
    title: string;
    value: number;
    stage: DealStage;
    notes: string | null;
    createdAt: Date;
    updatedAt: Date;
    closedAt: Date | null;
}

/**
 * GET /api/deals - List all deals for the company
 */
export async function GET() {
    try {
        const user = await getCurrentUser();
        if (!user || !user.companyId) {
            return NextResponse.json(
                { success: false, error: "Não autorizado" },
                { status: 401 }
            );
        }

        const deals = await prisma.deal.findMany({
            where: { companyId: user.companyId },
            orderBy: { createdAt: "desc" },
        });

        // Group by stage with totals
        const stages: DealStage[] = ["LEAD", "INTERESTED", "NEGOTIATING", "CLOSED_WON", "CLOSED_LOST"];
        const summary = stages.reduce((acc, stage) => {
            const stageDeals = deals.filter((d: DealData) => d.stage === stage);
            acc[stage] = {
                count: stageDeals.length,
                total: stageDeals.reduce((sum: number, d: DealData) => sum + (d.value || 0), 0),
            };
            return acc;
        }, {} as Record<string, { count: number; total: number }>);

        return NextResponse.json({
            success: true,
            data: deals,
            summary,
        });

    } catch (error) {
        logger.error("[Deals API] Error", { error, route: "/api/deals" });
        return NextResponse.json(
            { success: false, error: "Erro ao buscar deals" },
            { status: 500 }
        );
    }
}

/**
 * POST /api/deals - Create a new deal
 */
export async function POST(request: NextRequest) {
    try {
        const user = await getCurrentUser();
        if (!user || !user.companyId) {
            return NextResponse.json(
                { success: false, error: "Não autorizado" },
                { status: 401 }
            );
        }

        const body = await request.json();
        const { customerPhone, customerName, title, value, stage, notes } = body;

        if (!customerPhone || !title) {
            return NextResponse.json(
                { success: false, error: "Telefone e título são obrigatórios" },
                { status: 400 }
            );
        }

        const deal = await prisma.deal.create({
            data: {
                companyId: user.companyId,
                customerPhone: customerPhone.replace(/\D/g, ""),
                customerName: customerName || null,
                title,
                value: value || 0,
                stage: stage || "LEAD",
                notes: notes || null,
            },
        });

        return NextResponse.json({
            success: true,
            data: deal,
        });

    } catch (error) {
        logger.error("[Deals API] Error", { error, route: "/api/deals" });
        return NextResponse.json(
            { success: false, error: "Erro ao criar deal" },
            { status: 500 }
        );
    }
}
