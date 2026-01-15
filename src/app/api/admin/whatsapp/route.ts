import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { successResponse, errorResponse, handleApiError } from "@/lib/api-response";
import { logger } from "@/lib/logger";

// GET - All WhatsApp sessions across all companies
export async function GET() {
    try {
        const user = await getCurrentUser();

        if (!user || user.role !== "SUPER_ADMIN") {
            return NextResponse.json(errorResponse("Não autorizado"), { status: 401 });
        }

        const sessions = await prisma.whatsAppSession.findMany({
            orderBy: { updatedAt: "desc" },
            include: {
                company: {
                    select: {
                        id: true,
                        name: true,
                        email: true,
                    },
                },
                _count: {
                    select: {
                        conversations: true,
                    },
                },
            },
        });

        // Get message counts per session
        const sessionIds = sessions.map((s) => s.id);
        const messageCounts = await prisma.conversation.groupBy({
            by: ["sessionId"],
            where: { sessionId: { in: sessionIds } },
            _count: { _all: true },
        });

        const _messageCountMap = new Map(
            messageCounts.map((m) => [m.sessionId, m._count._all])
        );

        // Get stats
        const stats = {
            total: sessions.length,
            connected: sessions.filter((s) => s.status === "CONNECTED").length,
            disconnected: sessions.filter((s) => s.status === "DISCONNECTED").length,
            connecting: sessions.filter((s) => s.status === "CONNECTING").length,
        };

        const sessionsWithStats = sessions.map((session) => ({
            id: session.id,
            sessionName: session.sessionName,
            phoneNumber: session.phoneNumber,
            status: session.status,
            company: session.company,
            conversationsCount: session._count.conversations,
            lastSeenAt: session.lastSeenAt,
            createdAt: session.createdAt,
            updatedAt: session.updatedAt,
        }));

        return NextResponse.json(successResponse({
            stats,
            sessions: sessionsWithStats,
        }));
    } catch (error) {
        logger.error("[Admin WhatsApp] Error", { error, route: "/api/admin/whatsapp" });
        return NextResponse.json(handleApiError(error), { status: 500 });
    }
}
