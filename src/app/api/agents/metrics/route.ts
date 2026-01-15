/**
 * API: Agent Metrics
 * 
 * GET /api/agents/metrics - Get performance metrics for all agents
 */

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { successResponse, errorResponse } from "@/lib/api-response";
import { logger } from "@/lib/logger";

interface AgentMetrics {
    id: string;
    name: string;
    isActive: boolean;
    totalConversations: number;
    resolvedConversations: number;
    totalMessages: number;
    avgResponseTime: number | null; // in minutes
    satisfactionRate: number | null; // percentage
    lastActivity: Date | null;
}

export async function GET() {
    try {
        const user = await getCurrentUser();

        if (!user || !user.companyId) {
            return NextResponse.json(
                errorResponse("Não autorizado"),
                { status: 401 }
            );
        }

        // Get all agents for the company
        const agents = await prisma.aIAgent.findMany({
            where: { companyId: user.companyId },
            select: {
                id: true,
                name: true,
                isActive: true,
                createdAt: true,
            },
        });

        // Get metrics for each agent
        const companyId = user.companyId as string;
        const metricsPromises = agents.map(async (agent): Promise<AgentMetrics> => {
            // Get conversations handled by this agent
            const [
                totalConversations,
                resolvedConversations,
                totalMessages,
                lastMessage,
            ] = await Promise.all([
                prisma.conversation.count({
                    where: {
                        companyId,
                        agentId: agent.id,
                    },
                }),
                prisma.conversation.count({
                    where: {
                        companyId,
                        agentId: agent.id,
                        status: "CLOSED",
                    },
                }),
                prisma.message.count({
                    where: {
                        conversation: {
                            companyId,
                            agentId: agent.id,
                        },
                        sender: "AI",
                    },
                }),
                prisma.message.findFirst({
                    where: {
                        conversation: {
                            companyId,
                            agentId: agent.id,
                        },
                        sender: "AI",
                    },
                    orderBy: { createdAt: "desc" },
                    select: { createdAt: true },
                }),
            ]);

            // Calculate resolution rate as satisfaction proxy
            const satisfactionRate = totalConversations > 0
                ? Math.round((resolvedConversations / totalConversations) * 100)
                : null;

            return {
                id: agent.id,
                name: agent.name,
                isActive: agent.isActive,
                totalConversations,
                resolvedConversations,
                totalMessages,
                avgResponseTime: null, // Would need message timestamps analysis
                satisfactionRate,
                lastActivity: lastMessage?.createdAt || null,
            };
        });

        const metrics = await Promise.all(metricsPromises);

        // Sort by total conversations (most active first)
        metrics.sort((a, b) => b.totalConversations - a.totalConversations);

        // Calculate totals
        const totals = {
            totalAgents: agents.length,
            activeAgents: agents.filter(a => a.isActive).length,
            totalConversations: metrics.reduce((sum, m) => sum + m.totalConversations, 0),
            totalMessages: metrics.reduce((sum, m) => sum + m.totalMessages, 0),
            avgSatisfaction: metrics.length > 0
                ? Math.round(metrics.reduce((sum, m) => sum + (m.satisfactionRate || 0), 0) / metrics.length)
                : null,
        };

        logger.info("[Agent Metrics] Metrics fetched", {
            agentCount: metrics.length,
            totalConversations: totals.totalConversations,
        });

        return NextResponse.json(successResponse({
            agents: metrics,
            totals,
        }));

    } catch (error) {
        logger.error("[Agent Metrics] Error", { error, route: "/api/agents/metrics" });
        return NextResponse.json(
            errorResponse("Erro ao buscar métricas dos agentes"),
            { status: 500 }
        );
    }
}
