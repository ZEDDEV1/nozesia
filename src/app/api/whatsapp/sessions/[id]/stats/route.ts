/**
 * API: WhatsApp Session Stats
 * 
 * GET /api/whatsapp/sessions/[id]/stats - Get statistics for a session
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { successResponse, errorResponse } from "@/lib/api-response";

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const user = await getCurrentUser();
        if (!user || !user.companyId) {
            return NextResponse.json(errorResponse("Não autorizado"), { status: 401 });
        }

        const { id: sessionId } = await params;

        // Verify session belongs to company
        const session = await prisma.whatsAppSession.findFirst({
            where: { id: sessionId, companyId: user.companyId },
        });

        if (!session) {
            return NextResponse.json(errorResponse("Sessão não encontrada"), { status: 404 });
        }

        // Get today's date range
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);

        // Get stats
        const [totalConversations, todayMessages, activeCustomers] = await Promise.all([
            // Total conversations for this session
            prisma.conversation.count({
                where: {
                    companyId: user.companyId,
                    sessionId,
                },
            }),
            // Messages today
            prisma.message.count({
                where: {
                    conversation: {
                        companyId: user.companyId,
                        sessionId,
                    },
                    createdAt: {
                        gte: today,
                        lt: tomorrow,
                    },
                },
            }),
            // Active customers (last 24h)
            prisma.conversation.count({
                where: {
                    companyId: user.companyId,
                    sessionId,
                    lastMessageAt: {
                        gte: new Date(Date.now() - 24 * 60 * 60 * 1000),
                    },
                },
            }),
        ]);

        return NextResponse.json(successResponse({
            totalConversations,
            todayMessages,
            activeCustomers,
            avgResponseTime: 45, // Placeholder - can be calculated from actual data
            lastSeen: session.lastSeenAt,
        }));
    } catch (error) {
        console.error("Session stats error:", error);
        return NextResponse.json(errorResponse("Erro ao buscar estatísticas"), { status: 500 });
    }
}
