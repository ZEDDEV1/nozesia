import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { agentSchema } from "@/lib/validations";
import { successResponse, errorResponse, handleApiError } from "@/lib/api-response";

interface RouteParams {
    params: Promise<{ id: string }>;
}

// GET - Get single agent
export async function GET(request: Request, { params }: RouteParams) {
    try {
        const user = await getCurrentUser();
        const { id } = await params;

        if (!user || !user.companyId) {
            return NextResponse.json(errorResponse("Não autorizado"), { status: 401 });
        }

        const agent = await prisma.aIAgent.findFirst({
            where: {
                id,
                companyId: user.companyId,
            },
            include: {
                trainingData: {
                    orderBy: { createdAt: "desc" },
                },
                company: {
                    select: {
                        niche: true,
                        name: true,
                    },
                },
                _count: {
                    select: {
                        conversations: true,
                    },
                },
            },
        });

        if (!agent) {
            return NextResponse.json(errorResponse("Agente não encontrado"), { status: 404 });
        }

        return NextResponse.json(successResponse(agent));
    } catch (error) {
        return NextResponse.json(handleApiError(error), { status: 500 });
    }
}

// PUT - Update agent
export async function PUT(request: Request, { params }: RouteParams) {
    try {
        const user = await getCurrentUser();
        const { id } = await params;

        if (!user || !user.companyId) {
            return NextResponse.json(errorResponse("Não autorizado"), { status: 401 });
        }

        const existingAgent = await prisma.aIAgent.findFirst({
            where: { id, companyId: user.companyId },
        });

        if (!existingAgent) {
            return NextResponse.json(errorResponse("Agente não encontrado"), { status: 404 });
        }

        const body = await request.json();
        const parsed = agentSchema.partial().safeParse(body);

        if (!parsed.success) {
            return NextResponse.json(
                errorResponse(parsed.error.issues[0].message),
                { status: 400 }
            );
        }

        const data = parsed.data;

        // If setting as default, unset others
        if (data.isDefault) {
            await prisma.aIAgent.updateMany({
                where: { companyId: user.companyId, isDefault: true, id: { not: id } },
                data: { isDefault: false },
            });
        }

        const agent = await prisma.aIAgent.update({
            where: { id },
            data: {
                ...(data.name && { name: data.name }),
                ...(data.description !== undefined && { description: data.description }),
                ...(data.personality && { personality: data.personality }),
                ...(data.tone !== undefined && { tone: data.tone }),
                ...(data.canSell !== undefined && { canSell: data.canSell }),
                ...(data.canNegotiate !== undefined && { canNegotiate: data.canNegotiate }),
                ...(data.canSchedule !== undefined && { canSchedule: data.canSchedule }),
                ...(data.transferToHuman !== undefined && { transferToHuman: data.transferToHuman }),
                ...(data.workingHours !== undefined && { workingHours: data.workingHours ? JSON.stringify(data.workingHours) : null }),
                ...(data.isActive !== undefined && { isActive: data.isActive }),
                ...(data.isDefault !== undefined && { isDefault: data.isDefault }),
                // Voice Synthesis settings
                ...(data.voiceEnabled !== undefined && { voiceEnabled: data.voiceEnabled }),
                ...(data.voiceId !== undefined && { voiceId: data.voiceId }),
            },
        });

        // Create audit log
        await prisma.auditLog.create({
            data: {
                action: "UPDATE_AGENT",
                entity: "AIAgent",
                entityId: agent.id,
                userEmail: user.email,
                companyId: user.companyId,
                changes: JSON.stringify(data),
            },
        });

        return NextResponse.json(successResponse(agent, "Agente atualizado com sucesso!"));
    } catch (error) {
        return NextResponse.json(handleApiError(error), { status: 500 });
    }
}

// DELETE - Delete agent
export async function DELETE(request: Request, { params }: RouteParams) {
    try {
        const user = await getCurrentUser();
        const { id } = await params;

        if (!user || !user.companyId) {
            return NextResponse.json(errorResponse("Não autorizado"), { status: 401 });
        }

        const existingAgent = await prisma.aIAgent.findFirst({
            where: { id, companyId: user.companyId },
        });

        if (!existingAgent) {
            return NextResponse.json(errorResponse("Agente não encontrado"), { status: 404 });
        }

        await prisma.aIAgent.delete({ where: { id } });

        // Create audit log
        await prisma.auditLog.create({
            data: {
                action: "DELETE_AGENT",
                entity: "AIAgent",
                entityId: id,
                userEmail: user.email,
                companyId: user.companyId,
            },
        });

        return NextResponse.json(successResponse(null, "Agente excluído com sucesso!"));
    } catch (error) {
        return NextResponse.json(handleApiError(error), { status: 500 });
    }
}
