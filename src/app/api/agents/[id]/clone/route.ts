/**
 * API: Clone Agent
 * 
 * POST /api/agents/[id]/clone - Clone an agent with all training data
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { successResponse, errorResponse } from "@/lib/api-response";
import { getCompanyPlanInfo, hasAccess } from "@/lib/plan-features";
import { logger } from "@/lib/logger";

export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const user = await getCurrentUser();
        if (!user || !user.companyId) {
            return NextResponse.json(errorResponse("Não autorizado"), { status: 401 });
        }

        const { id: agentId } = await params;

        // Check access
        const accessCheck = await hasAccess(user.companyId);
        if (!accessCheck.hasAccess) {
            return NextResponse.json(
                errorResponse("Acesso expirado. Assine um plano!"),
                { status: 403 }
            );
        }

        // Check agent limit
        const planInfo = await getCompanyPlanInfo(user.companyId);
        const agentCount = await prisma.aIAgent.count({
            where: { companyId: user.companyId },
        });

        if (agentCount >= planInfo.limits.maxAgents) {
            return NextResponse.json(
                errorResponse(`Limite de ${planInfo.limits.maxAgents} agente(s) atingido`),
                { status: 403 }
            );
        }

        // Get original agent with training data
        const original = await prisma.aIAgent.findFirst({
            where: { id: agentId, companyId: user.companyId },
            include: { trainingData: true },
        });

        if (!original) {
            return NextResponse.json(errorResponse("Agente não encontrado"), { status: 404 });
        }

        // Get optional new name from body
        const body = await request.json().catch(() => ({}));
        const newName = body.name || `${original.name} (Cópia)`;

        // Create cloned agent
        const cloned = await prisma.aIAgent.create({
            data: {
                companyId: user.companyId,
                name: newName,
                description: original.description,
                personality: original.personality,
                tone: original.tone,
                canSell: original.canSell,
                canNegotiate: original.canNegotiate,
                canSchedule: original.canSchedule,
                transferToHuman: original.transferToHuman,
                workingHours: original.workingHours,
                voiceEnabled: original.voiceEnabled,
                voiceId: original.voiceId,
                isActive: false, // Clone starts inactive
                isDefault: false, // Clone is not default
            },
        });

        // Clone training data
        if (original.trainingData.length > 0) {
            await prisma.trainingData.createMany({
                data: original.trainingData.map(t => ({
                    agentId: cloned.id,
                    type: t.type,
                    title: t.title,
                    content: t.content,
                })),
            });
        }

        // Create audit log
        await prisma.auditLog.create({
            data: {
                action: "CLONE_AGENT",
                entity: "AIAgent",
                entityId: cloned.id,
                userEmail: user.email,
                companyId: user.companyId,
            },
        });

        logger.info("[Agent Clone] Agent cloned", {
            originalId: agentId,
            clonedId: cloned.id,
            trainingCount: original.trainingData.length,
        });

        return NextResponse.json(
            successResponse(cloned, `Agente clonado! ${original.trainingData.length} treinamentos copiados.`),
            { status: 201 }
        );
    } catch (error) {
        logger.error("[Agent Clone] Error", { error, route: "/api/agents/[id]/clone" });
        return NextResponse.json(errorResponse("Erro ao clonar agente"), { status: 500 });
    }
}
