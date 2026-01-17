import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { successResponse, errorResponse, handleApiError } from "@/lib/api-response";

export async function GET() {
    try {
        const user = await getCurrentUser();

        if (!user || !user.companyId) {
            return NextResponse.json(errorResponse("Não autorizado"), { status: 401 });
        }

        const companyId = user.companyId;

        // Define date ranges for trend calculation
        const now = new Date();
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);

        // Get counts
        const [
            agentsCount,
            activeAgentsCount,
            sessionsCount,
            connectedSessionsCount,
            conversationsCount,
            waitingResponseCount,
            messagesCount,
            trainingCount,
            // Trends - current month
            conversationsThisMonth,
            messagesThisMonth,
            // Trends - last month
            conversationsLastMonth,
            messagesLastMonth,
        ] = await Promise.all([
            prisma.aIAgent.count({ where: { companyId } }),
            prisma.aIAgent.count({ where: { companyId, isActive: true } }),
            prisma.whatsAppSession.count({ where: { companyId } }),
            prisma.whatsAppSession.count({ where: { companyId, status: "CONNECTED" } }),
            prisma.conversation.count({ where: { companyId } }),
            prisma.conversation.count({ where: { companyId, status: "WAITING_RESPONSE" } }),
            prisma.message.count({
                where: {
                    conversation: { companyId }
                }
            }),
            prisma.trainingData.count({
                where: {
                    agent: { companyId }
                }
            }),
            // Current month conversations
            prisma.conversation.count({
                where: {
                    companyId,
                    createdAt: { gte: startOfMonth },
                }
            }),
            // Current month messages
            prisma.message.count({
                where: {
                    conversation: { companyId },
                    createdAt: { gte: startOfMonth },
                }
            }),
            // Last month conversations
            prisma.conversation.count({
                where: {
                    companyId,
                    createdAt: { gte: startOfLastMonth, lte: endOfLastMonth },
                }
            }),
            // Last month messages
            prisma.message.count({
                where: {
                    conversation: { companyId },
                    createdAt: { gte: startOfLastMonth, lte: endOfLastMonth },
                }
            }),
        ]);

        // Calculate trends (percentage change)
        const calculateTrend = (current: number, previous: number): number | null => {
            if (previous === 0) return current > 0 ? 100 : null;
            return Math.round(((current - previous) / previous) * 100);
        };

        const trends = {
            conversations: calculateTrend(conversationsThisMonth, conversationsLastMonth),
            messages: calculateTrend(messagesThisMonth, messagesLastMonth),
        };

        // Get recent conversations
        const recentConversations = await prisma.conversation.findMany({
            where: { companyId },
            take: 5,
            orderBy: { lastMessageAt: "desc" },
            include: {
                messages: {
                    take: 1,
                    orderBy: { createdAt: "desc" },
                },
            },
        });

        // Get company subscription info
        const company = await prisma.company.findUnique({
            where: { id: companyId },
            include: {
                subscription: {
                    include: { plan: true },
                },
            },
        });

        return NextResponse.json(successResponse({
            stats: {
                agents: agentsCount,
                activeAgents: activeAgentsCount,
                sessions: sessionsCount,
                connectedSessions: connectedSessionsCount,
                conversations: conversationsCount,
                waitingResponse: waitingResponseCount,
                messages: messagesCount,
                trainingData: trainingCount,
            },
            trends, // Novo: trends calculados dinamicamente
            recentConversations: recentConversations.map((conv) => ({
                id: conv.id,
                customerName: conv.customerName || "Cliente",
                customerPhone: conv.customerPhone,
                lastMessage: conv.messages[0]?.content || "",
                lastMessageAt: conv.lastMessageAt,
                unreadCount: conv.unreadCount,
                status: conv.status,
            })),
            subscription: company?.subscription ? {
                planName: company.subscription.plan.name,
                planType: company.subscription.plan.type,
                status: company.subscription.status,
                maxAgents: company.subscription.plan.maxAgents,
                maxSessions: company.subscription.plan.maxWhatsAppNumbers,
                maxMessages: company.subscription.plan.maxMessagesMonth,
            } : null,
        }));
    } catch (error) {
        return NextResponse.json(handleApiError(error), { status: 500 });
    }
}
