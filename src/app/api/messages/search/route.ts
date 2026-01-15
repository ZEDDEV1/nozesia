/**
 * API: Message Search
 * 
 * GET /api/messages/search?q=termo - Search messages across conversations
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { successResponse, errorResponse } from "@/lib/api-response";
import { logger } from "@/lib/logger";

/**
 * GET /api/messages/search?q=termo&limit=20
 * Search messages across all conversations of the company
 */
export async function GET(request: NextRequest) {
    try {
        const user = await getCurrentUser();
        if (!user || !user.companyId) {
            return NextResponse.json(errorResponse("Não autorizado"), { status: 401 });
        }

        const searchParams = request.nextUrl.searchParams;
        const query = searchParams.get("q");
        const limit = parseInt(searchParams.get("limit") || "20");

        if (!query || query.trim().length < 2) {
            return NextResponse.json(
                errorResponse("Busca deve ter pelo menos 2 caracteres"),
                { status: 400 }
            );
        }

        const messages = await prisma.message.findMany({
            where: {
                conversation: {
                    companyId: user.companyId,
                },
                content: {
                    contains: query,
                    mode: "insensitive",
                },
            },
            include: {
                conversation: {
                    select: {
                        id: true,
                        customerName: true,
                        customerPhone: true,
                    },
                },
            },
            orderBy: { createdAt: "desc" },
            take: limit,
        });

        // Group by conversation for better UX
        const groupedResults = messages.reduce((acc, msg) => {
            const convId = msg.conversationId;
            if (!acc[convId]) {
                acc[convId] = {
                    conversationId: convId,
                    customerName: msg.conversation.customerName,
                    customerPhone: msg.conversation.customerPhone,
                    messages: [],
                };
            }
            acc[convId].messages.push({
                id: msg.id,
                content: msg.content,
                sender: msg.sender,
                createdAt: msg.createdAt,
            });
            return acc;
        }, {} as Record<string, {
            conversationId: string;
            customerName: string | null;
            customerPhone: string;
            messages: Array<{
                id: string;
                content: string;
                sender: string;
                createdAt: Date;
            }>;
        }>);

        const results = Object.values(groupedResults);

        logger.info("[Message Search] Search completed", {
            query,
            resultCount: messages.length,
            conversationCount: results.length,
        });

        return NextResponse.json(successResponse({
            results,
            total: messages.length,
            query,
        }));
    } catch (error) {
        logger.error("[Message Search] Error", { error, route: "/api/messages/search" });
        return NextResponse.json(errorResponse("Erro na busca"), { status: 500 });
    }
}
