import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { successResponse, errorResponse, handleApiError } from "@/lib/api-response";
import { parseCursorParams, formatCursorPaginatedResponse, getPrismaCursorParams } from "@/lib/pagination";

// GET - List all conversations for the company (with pagination)
export async function GET(request: Request) {
    try {
        const user = await getCurrentUser();

        if (!user || !user.companyId) {
            return NextResponse.json(errorResponse("Não autorizado"), { status: 401 });
        }

        const { searchParams } = new URL(request.url);
        const status = searchParams.get("status");
        const search = searchParams.get("search");

        // Paginação cursor-based
        const { cursor, limit } = parseCursorParams(searchParams);
        const cursorParams = getPrismaCursorParams(cursor, limit);

        const whereClause: Record<string, unknown> = {
            companyId: user.companyId,
        };

        if (status && status !== "all") {
            whereClause.status = status;
        }

        if (search) {
            whereClause.OR = [
                { customerName: { contains: search, mode: "insensitive" } },
                { customerPhone: { contains: search } },
            ];
        }

        const conversations = await prisma.conversation.findMany({
            where: whereClause,
            orderBy: { lastMessageAt: "desc" },
            ...cursorParams,
            include: {
                agent: {
                    select: { id: true, name: true },
                },
                session: {
                    select: { id: true, sessionName: true, phoneNumber: true },
                },
                messages: {
                    take: 1,
                    orderBy: { createdAt: "desc" },
                    select: {
                        id: true,
                        content: true,
                        sender: true,
                        type: true,
                        createdAt: true,
                    },
                },
            },
        });

        // Formatar resposta paginada
        const paginatedResponse = formatCursorPaginatedResponse(conversations, limit);

        return NextResponse.json(successResponse(paginatedResponse));
    } catch (error) {
        return NextResponse.json(handleApiError(error), { status: 500 });
    }
}

