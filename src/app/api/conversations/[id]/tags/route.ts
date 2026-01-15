/**
 * API: Conversation Tags
 * 
 * GET - List tags for a conversation
 * PUT - Update tags for a conversation (set tags)
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { successResponse, errorResponse, handleApiError } from "@/lib/api-response";
import { logger } from "@/lib/logger";

interface RouteParams {
    params: Promise<{ id: string }>;
}

/**
 * GET /api/conversations/[id]/tags - Get tags for a conversation
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
    try {
        const user = await getCurrentUser();
        const { id } = await params;

        if (!user || !user.companyId) {
            return NextResponse.json(errorResponse("Não autorizado"), { status: 401 });
        }

        const conversation = await prisma.conversation.findFirst({
            where: { id, companyId: user.companyId },
            include: {
                tags: {
                    select: {
                        id: true,
                        name: true,
                        color: true,
                    },
                },
            },
        });

        if (!conversation) {
            return NextResponse.json(errorResponse("Conversa não encontrada"), { status: 404 });
        }

        return NextResponse.json(successResponse(conversation.tags));
    } catch (error) {
        logger.error("[Conversation Tags API] GET error", { error, route: "/api/conversations/[id]/tags" });
        return NextResponse.json(handleApiError(error), { status: 500 });
    }
}

/**
 * PUT /api/conversations/[id]/tags - Update tags for a conversation
 * Body: { tagIds: string[] }
 */
export async function PUT(request: NextRequest, { params }: RouteParams) {
    try {
        const user = await getCurrentUser();
        const { id } = await params;

        if (!user || !user.companyId) {
            return NextResponse.json(errorResponse("Não autorizado"), { status: 401 });
        }

        const conversation = await prisma.conversation.findFirst({
            where: { id, companyId: user.companyId },
        });

        if (!conversation) {
            return NextResponse.json(errorResponse("Conversa não encontrada"), { status: 404 });
        }

        const body = await request.json();
        const { tagIds } = body;

        if (!Array.isArray(tagIds)) {
            return NextResponse.json(errorResponse("tagIds deve ser um array"), { status: 400 });
        }

        // Verify all tags belong to the company
        if (tagIds.length > 0) {
            const validTags = await prisma.tag.findMany({
                where: {
                    id: { in: tagIds },
                    companyId: user.companyId,
                },
            });

            if (validTags.length !== tagIds.length) {
                return NextResponse.json(errorResponse("Uma ou mais tags são inválidas"), { status: 400 });
            }
        }

        // Update conversation tags (set - replaces all existing)
        const updated = await prisma.conversation.update({
            where: { id },
            data: {
                tags: {
                    set: tagIds.map((tagId: string) => ({ id: tagId })),
                },
            },
            include: {
                tags: {
                    select: {
                        id: true,
                        name: true,
                        color: true,
                    },
                },
            },
        });

        logger.info("[Conversation Tags API] Updated tags", {
            conversationId: id,
            tagCount: updated.tags.length,
            companyId: user.companyId
        });

        return NextResponse.json(successResponse(updated.tags, "Tags atualizadas!"));
    } catch (error) {
        logger.error("[Conversation Tags API] PUT error", { error, route: "/api/conversations/[id]/tags" });
        return NextResponse.json(handleApiError(error), { status: 500 });
    }
}
