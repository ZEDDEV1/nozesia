/**
 * API: Agent Playground (Test messages)
 * 
 * POST /api/agents/[id]/playground - Send test message to agent
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { successResponse, errorResponse } from "@/lib/api-response";
import { logger } from "@/lib/logger";

// Import the AI processing function (simplified version)
async function processTestMessage(
    agentId: string,
    message: string,
    _companyId: string
): Promise<string> {
    // Get agent with training data
    const agent = await prisma.aIAgent.findUnique({
        where: { id: agentId },
        include: {
            trainingData: {
                take: 20,
                orderBy: { createdAt: "desc" },
            },
        },
    });

    if (!agent) {
        throw new Error("Agente não encontrado");
    }

    // Build context from training data
    const _trainingContext = agent.trainingData
        .map(t => `[${t.type}] ${t.title}: ${t.content}`)
        .join("\n\n");

    // Simple placeholder response (in production, this would call OpenAI/Gemini)
    // For now, return a simulated response based on training
    const lowerMessage = message.toLowerCase();

    // Try to find a matching FAQ/QA
    for (const training of agent.trainingData) {
        const titleLower = training.title.toLowerCase();
        const _contentWords = training.content.toLowerCase().split(/\s+/);

        // Check if message contains keywords from title
        if (titleLower.split(/\s+/).some(word =>
            word.length > 3 && lowerMessage.includes(word)
        )) {
            return `${agent.personality ? `[${agent.personality}] ` : ""}${training.content}`;
        }
    }

    // Default response
    return `Olá! Sou o ${agent.name}. ${agent.personality || "Como posso ajudá-lo hoje?"}

[MODO PLAYGROUND - Esta é uma simulação. Em produção, usaria a API de IA para gerar respostas contextuais baseadas nos ${agent.trainingData.length} itens de treinamento.]`;
}

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
        const body = await request.json();
        const { message } = body;

        if (!message || typeof message !== "string") {
            return NextResponse.json(
                errorResponse("Mensagem é obrigatória"),
                { status: 400 }
            );
        }

        // Verify agent belongs to company
        const agent = await prisma.aIAgent.findFirst({
            where: { id: agentId, companyId: user.companyId },
        });

        if (!agent) {
            return NextResponse.json(
                errorResponse("Agente não encontrado"),
                { status: 404 }
            );
        }

        // Process test message
        const response = await processTestMessage(agentId, message, user.companyId);

        logger.info("[Agent Playground] Test message processed", {
            agentId,
            messageLength: message.length,
        });

        return NextResponse.json(successResponse({
            message: response,
            agentName: agent.name,
        }));
    } catch (error) {
        logger.error("[Agent Playground] Error", { error, route: "/api/agents/[id]/playground" });
        return NextResponse.json(
            errorResponse("Erro ao processar mensagem de teste"),
            { status: 500 }
        );
    }
}
