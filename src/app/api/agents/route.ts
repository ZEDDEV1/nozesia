import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { agentSchema } from "@/lib/validations";
import { successResponse, errorResponse, handleApiError } from "@/lib/api-response";
import { getCompanyPlanInfo, hasAccess } from "@/lib/plan-features";

// GET - List all agents for the company
export async function GET() {
    try {
        const user = await getCurrentUser();

        if (!user || !user.companyId) {
            return NextResponse.json(errorResponse("Não autorizado"), { status: 401 });
        }

        const agents = await prisma.aIAgent.findMany({
            where: { companyId: user.companyId },
            include: {
                _count: {
                    select: {
                        trainingData: true,
                        conversations: true,
                    },
                },
            },
            orderBy: { createdAt: "desc" },
        });

        return NextResponse.json(successResponse(agents));
    } catch (error) {
        return NextResponse.json(handleApiError(error), { status: 500 });
    }
}

// POST - Create new agent
export async function POST(request: Request) {
    try {
        const user = await getCurrentUser();

        if (!user || !user.companyId) {
            return NextResponse.json(errorResponse("Não autorizado"), { status: 401 });
        }

        // Check access (trial or subscription)
        const accessCheck = await hasAccess(user.companyId);
        if (!accessCheck.hasAccess) {
            return NextResponse.json(
                errorResponse("⏰ Seu período de acesso expirou. Assine um plano para continuar!"),
                { status: 403 }
            );
        }

        const body = await request.json();
        const parsed = agentSchema.safeParse(body);

        if (!parsed.success) {
            return NextResponse.json(
                errorResponse(parsed.error.issues[0].message),
                { status: 400 }
            );
        }

        const data = parsed.data;

        // Check agent limit based on plan (works for trial and subscription)
        const planInfo = await getCompanyPlanInfo(user.companyId);
        const agentCount = await prisma.aIAgent.count({
            where: { companyId: user.companyId },
        });

        if (agentCount >= planInfo.limits.maxAgents) {
            return NextResponse.json(
                errorResponse(`🤖 Limite de ${planInfo.limits.maxAgents} agente(s) atingido. Faça upgrade do plano ou adicione um extra por R$29,99/mês!`),
                { status: 403 }
            );
        }

        // If this is default, unset other defaults
        if (data.isDefault) {
            await prisma.aIAgent.updateMany({
                where: { companyId: user.companyId, isDefault: true },
                data: { isDefault: false },
            });
        }

        const agent = await prisma.aIAgent.create({
            data: {
                companyId: user.companyId,
                name: data.name,
                description: data.description,
                personality: data.personality,
                tone: data.tone,
                canSell: data.canSell,
                canNegotiate: data.canNegotiate,
                canSchedule: data.canSchedule,
                transferToHuman: data.transferToHuman,
                workingHours: data.workingHours ? JSON.stringify(data.workingHours) : null,
                isActive: data.isActive,
                isDefault: data.isDefault,
            },
        });

        // Create audit log
        await prisma.auditLog.create({
            data: {
                action: "CREATE_AGENT",
                entity: "AIAgent",
                entityId: agent.id,
                userEmail: user.email,
                companyId: user.companyId,
            },
        });

        return NextResponse.json(
            successResponse(agent, "Agente criado com sucesso!"),
            { status: 201 }
        );
    } catch (error) {
        return NextResponse.json(handleApiError(error), { status: 500 });
    }
}
