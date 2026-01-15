/**
 * API: CRM Metrics
 * 
 * GET /api/crm/metrics - Métricas do CRM
 */

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { logger } from "@/lib/logger";

interface DealData {
    stage: string;
    value: number;
    createdAt: Date;
    closedAt: Date | null;
}

export async function GET() {
    try {
        const user = await getCurrentUser();
        if (!user || !user.companyId) {
            return NextResponse.json(
                { success: false, error: "Não autorizado" },
                { status: 401 }
            );
        }

        // Get all deals
        const deals = await prisma.deal.findMany({
            where: { companyId: user.companyId },
            select: {
                stage: true,
                value: true,
                createdAt: true,
                closedAt: true,
            },
        });

        // Get orders for this month
        const startOfMonth = new Date();
        startOfMonth.setDate(1);
        startOfMonth.setHours(0, 0, 0, 0);

        const orders = await prisma.order.findMany({
            where: {
                companyId: user.companyId,
                createdAt: { gte: startOfMonth },
            },
            select: {
                totalAmount: true,
                status: true,
            },
        });

        // Calculate metrics
        const totalLeads = deals.filter((d: DealData) => d.stage === "LEAD").length;
        const totalInterested = deals.filter((d: DealData) => d.stage === "INTERESTED").length;
        const totalNegotiating = deals.filter((d: DealData) => d.stage === "NEGOTIATING").length;
        const totalClosedWon = deals.filter((d: DealData) => d.stage === "CLOSED_WON").length;
        const totalClosedLost = deals.filter((d: DealData) => d.stage === "CLOSED_LOST").length;

        // Pipeline value (not closed)
        const pipelineValue = deals
            .filter((d: DealData) => !["CLOSED_WON", "CLOSED_LOST"].includes(d.stage))
            .reduce((sum: number, d: DealData) => sum + (d.value || 0), 0);

        // Closed value
        const closedValue = deals
            .filter((d: DealData) => d.stage === "CLOSED_WON")
            .reduce((sum: number, d: DealData) => sum + (d.value || 0), 0);

        // Conversion rate
        const totalDeals = deals.length;
        const conversionRate = totalDeals > 0
            ? Math.round((totalClosedWon / totalDeals) * 100)
            : 0;

        // Average deal time (for closed won)
        const closedDeals = deals.filter((d: DealData) => d.stage === "CLOSED_WON" && d.closedAt);
        const avgDealTime = closedDeals.length > 0
            ? Math.round(
                closedDeals.reduce((sum: number, d: DealData) => {
                    const diff = d.closedAt!.getTime() - d.createdAt.getTime();
                    return sum + diff / (1000 * 60 * 60 * 24); // days
                }, 0) / closedDeals.length
            )
            : 0;

        // Orders this month
        const ordersThisMonth = orders.length;
        const revenueThisMonth = orders.reduce((sum, o) => sum + (o.totalAmount || 0), 0);

        return NextResponse.json({
            success: true,
            data: {
                pipeline: {
                    leads: totalLeads,
                    interested: totalInterested,
                    negotiating: totalNegotiating,
                    closedWon: totalClosedWon,
                    closedLost: totalClosedLost,
                    pipelineValue,
                    closedValue,
                },
                metrics: {
                    conversionRate,
                    avgDealTime,
                    ordersThisMonth,
                    revenueThisMonth,
                },
            },
        });

    } catch (error) {
        logger.error("[CRM Metrics] Error", { error, route: "/api/crm/metrics" });
        return NextResponse.json(
            { success: false, error: "Erro ao buscar métricas" },
            { status: 500 }
        );
    }
}
