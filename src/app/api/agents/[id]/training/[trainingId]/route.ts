import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { successResponse, errorResponse, handleApiError } from "@/lib/api-response";

interface RouteParams {
    params: Promise<{ id: string; trainingId: string }>;
}

// DELETE - Remove training data
export async function DELETE(request: Request, { params }: RouteParams) {
    try {
        const user = await getCurrentUser();
        const { id: agentId, trainingId } = await params;

        if (!user || !user.companyId) {
            return NextResponse.json(errorResponse("Não autorizado"), { status: 401 });
        }

        // Verify agent belongs to company
        const agent = await prisma.aIAgent.findFirst({
            where: { id: agentId, companyId: user.companyId },
        });

        if (!agent) {
            return NextResponse.json(errorResponse("Agente não encontrado"), { status: 404 });
        }

        const trainingData = await prisma.trainingData.findFirst({
            where: { id: trainingId, agentId },
        });

        if (!trainingData) {
            return NextResponse.json(errorResponse("Dado de treinamento não encontrado"), { status: 404 });
        }

        await prisma.trainingData.delete({ where: { id: trainingId } });

        // Create audit log
        await prisma.auditLog.create({
            data: {
                action: "DELETE_TRAINING_DATA",
                entity: "TrainingData",
                entityId: trainingId,
                userEmail: user.email,
                companyId: user.companyId,
            },
        });

        return NextResponse.json(successResponse(null, "Dado de treinamento removido!"));
    } catch (error) {
        return NextResponse.json(handleApiError(error), { status: 500 });
    }
}
