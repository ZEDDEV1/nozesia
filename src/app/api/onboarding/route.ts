/**
 * API: Onboarding Status
 * 
 * GET /api/onboarding - Get onboarding progress for current company
 */

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { successResponse, errorResponse } from "@/lib/api-response";

export async function GET() {
    try {
        const user = await getCurrentUser();
        if (!user || !user.companyId) {
            return NextResponse.json(errorResponse("Não autorizado"), { status: 401 });
        }

        const companyId = user.companyId;

        // Check all onboarding conditions in parallel
        const [
            agentCount,
            sessionCount,
            trainingCount,
            productCount,
            templateCount,
        ] = await Promise.all([
            prisma.aIAgent.count({ where: { companyId } }),
            prisma.whatsAppSession.count({ where: { companyId, status: "CONNECTED" } }),
            prisma.trainingData.count({
                where: {
                    agent: { companyId }
                }
            }),
            prisma.product.count({ where: { companyId, isActive: true } }),
            prisma.messageTemplate.count({ where: { companyId } }),
        ]);

        const data = {
            hasAgent: agentCount > 0,
            hasSession: sessionCount > 0,
            hasTraining: trainingCount > 0,
            hasProducts: productCount > 0,
            hasTemplate: templateCount > 0,
        };

        const completedCount = Object.values(data).filter(Boolean).length;

        return NextResponse.json(successResponse({
            ...data,
            completedCount,
            totalSteps: 5,
            progress: Math.round((completedCount / 5) * 100),
        }));
    } catch (error) {
        console.error("Onboarding API error:", error);
        return NextResponse.json(errorResponse("Erro ao buscar status"), { status: 500 });
    }
}
