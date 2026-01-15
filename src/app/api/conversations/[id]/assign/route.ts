/**
 * API: Assign Conversation to Team Member
 * 
 * PUT /api/conversations/[id]/assign - Assign/unassign conversation
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { successResponse, errorResponse } from "@/lib/api-response";

type RouteParams = { params: Promise<{ id: string }> };

export async function PUT(request: NextRequest, { params }: RouteParams) {
    try {
        const user = await getCurrentUser();
        if (!user || !user.companyId) {
            return NextResponse.json(errorResponse("Não autorizado"), { status: 401 });
        }

        const { id } = await params;
        const { userId } = await request.json();

        // Verify conversation belongs to company
        const conversation = await prisma.conversation.findFirst({
            where: { id, companyId: user.companyId },
        });

        if (!conversation) {
            return NextResponse.json(errorResponse("Conversa não encontrada"), { status: 404 });
        }

        // If assigning, verify user belongs to same company
        if (userId) {
            const targetUser = await prisma.user.findFirst({
                where: { id: userId, companyId: user.companyId },
            });

            if (!targetUser) {
                return NextResponse.json(errorResponse("Usuário não encontrado"), { status: 404 });
            }
        }

        // Update conversation
        const updated = await prisma.conversation.update({
            where: { id },
            data: {
                assignedToId: userId || null,
                status: userId ? "HUMAN_HANDLING" : conversation.status,
            },
            include: {
                assignedTo: {
                    select: { id: true, name: true, email: true },
                },
            },
        });

        return NextResponse.json(successResponse({
            id: updated.id,
            assignedToId: updated.assignedToId,
            assignedTo: updated.assignedTo,
            status: updated.status,
        }, userId ? "Conversa atribuída!" : "Atribuição removida!"));
    } catch (error) {
        console.error("Assign conversation error:", error);
        return NextResponse.json(errorResponse("Erro ao atribuir"), { status: 500 });
    }
}

// GET team members for assignment dropdown
export async function GET(_request: NextRequest, { params: _params }: RouteParams) {
    try {
        const user = await getCurrentUser();
        if (!user || !user.companyId) {
            return NextResponse.json(errorResponse("Não autorizado"), { status: 401 });
        }

        // Get all team members from same company
        const teamMembers = await prisma.user.findMany({
            where: { companyId: user.companyId },
            select: {
                id: true,
                name: true,
                email: true,
                role: true,
            },
            orderBy: { name: "asc" },
        });

        return NextResponse.json(successResponse(teamMembers));
    } catch (error) {
        console.error("Get team members error:", error);
        return NextResponse.json(errorResponse("Erro ao buscar equipe"), { status: 500 });
    }
}
