import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { trainingDataSchema } from "@/lib/validations";
import { successResponse, errorResponse, handleApiError } from "@/lib/api-response";
import { processTrainingData } from "@/lib/rag";
import { logger } from "@/lib/logger";
import { invalidateTrainingDataCache } from "@/lib/cache";
import { extractAndSaveWorkHours } from "@/lib/extract-work-hours";

interface RouteParams {
    params: Promise<{ id: string }>;
}

// GET - List training data for an agent
export async function GET(request: Request, { params }: RouteParams) {
    try {
        const user = await getCurrentUser();
        const { id: agentId } = await params;

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

        const trainingData = await prisma.trainingData.findMany({
            where: { agentId },
            orderBy: { createdAt: "desc" },
        });

        return NextResponse.json(successResponse(trainingData));
    } catch (error) {
        return NextResponse.json(handleApiError(error), { status: 500 });
    }
}

// POST - Add training data to an agent
export async function POST(request: Request, { params }: RouteParams) {
    try {
        const user = await getCurrentUser();
        const { id: agentId } = await params;

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

        const body = await request.json();
        const parsed = trainingDataSchema.safeParse(body);

        if (!parsed.success) {
            return NextResponse.json(
                errorResponse(parsed.error.issues[0].message),
                { status: 400 }
            );
        }

        const data = parsed.data;

        const trainingData = await prisma.trainingData.create({
            data: {
                agentId,
                type: data.type,
                title: data.title,
                content: data.content,
                metadata: data.metadata ? JSON.stringify(data.metadata) : null,
            },
        });

        // Create audit log
        await prisma.auditLog.create({
            data: {
                action: "ADD_TRAINING_DATA",
                entity: "TrainingData",
                entityId: trainingData.id,
                userEmail: user.email,
                companyId: user.companyId,
            },
        });

        // Process embeddings asynchronously (RAG)
        processTrainingData(trainingData.id).catch((error) => {
            logger.error("[RAG] Failed to process training data", { error, trainingDataId: trainingData.id });
        });

        // ✅ NOVO: Extração automática de horários de funcionamento
        // Se o título indica horário de funcionamento, extrair e salvar estruturado
        const titleLC = data.title.toLowerCase();
        if (titleLC.includes("horário") || titleLC.includes("horario") ||
            titleLC.includes("funcionamento") || titleLC.includes("expediente")) {
            extractAndSaveWorkHours(user.companyId, data.content).catch((error) => {
                logger.warn("[WorkHours] Failed to extract work hours", { error, trainingDataId: trainingData.id });
            });
        }

        // Invalidate cache so webhook uses fresh training data
        await invalidateTrainingDataCache(agentId);

        return NextResponse.json(
            successResponse(trainingData, "Dado de treinamento adicionado!"),
            { status: 201 }
        );
    } catch (error) {
        return NextResponse.json(handleApiError(error), { status: 500 });
    }
}
