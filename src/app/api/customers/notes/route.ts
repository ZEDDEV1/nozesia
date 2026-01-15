/**
 * API: Customer Notes
 * 
 * GET /api/customers/notes?phone=xxx - Get notes for a customer
 * POST /api/customers/notes - Create a new note
 * DELETE /api/customers/notes/[id] - Delete a note
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { successResponse, errorResponse } from "@/lib/api-response";
import { logger } from "@/lib/logger";

/**
 * GET /api/customers/notes?phone=xxx
 * List notes for a specific customer
 */
export async function GET(request: NextRequest) {
    try {
        const user = await getCurrentUser();
        if (!user || !user.companyId) {
            return NextResponse.json(errorResponse("Não autorizado"), { status: 401 });
        }

        const phone = request.nextUrl.searchParams.get("phone");

        if (!phone) {
            return NextResponse.json(errorResponse("Telefone é obrigatório"), { status: 400 });
        }

        const notes = await prisma.customerNote.findMany({
            where: {
                companyId: user.companyId,
                customerPhone: phone,
            },
            orderBy: { createdAt: "desc" },
        });

        return NextResponse.json(successResponse(notes));
    } catch (error) {
        logger.error("[Customer Notes API] GET error", { error, route: "/api/customers/notes" });
        return NextResponse.json(errorResponse("Erro ao buscar notas"), { status: 500 });
    }
}

/**
 * POST /api/customers/notes
 * Create a new note for a customer
 */
export async function POST(request: NextRequest) {
    try {
        const user = await getCurrentUser();
        if (!user || !user.companyId) {
            return NextResponse.json(errorResponse("Não autorizado"), { status: 401 });
        }

        const body = await request.json();
        const { customerPhone, customerName, content } = body;

        if (!customerPhone || !content) {
            return NextResponse.json(
                errorResponse("Telefone e conteúdo são obrigatórios"),
                { status: 400 }
            );
        }

        const note = await prisma.customerNote.create({
            data: {
                companyId: user.companyId,
                customerPhone,
                customerName: customerName || null,
                content,
                authorName: user.name || null,
            },
        });

        logger.info("[Customer Notes API] Note created", {
            noteId: note.id,
            customerPhone,
        });

        return NextResponse.json(successResponse(note, "Nota criada!"));
    } catch (error) {
        logger.error("[Customer Notes API] POST error", { error, route: "/api/customers/notes" });
        return NextResponse.json(errorResponse("Erro ao criar nota"), { status: 500 });
    }
}

/**
 * DELETE /api/customers/notes
 * Delete a note
 */
export async function DELETE(request: NextRequest) {
    try {
        const user = await getCurrentUser();
        if (!user || !user.companyId) {
            return NextResponse.json(errorResponse("Não autorizado"), { status: 401 });
        }

        const { searchParams } = new URL(request.url);
        const id = searchParams.get("id");

        if (!id) {
            return NextResponse.json(errorResponse("ID é obrigatório"), { status: 400 });
        }

        // Verify note belongs to company
        const note = await prisma.customerNote.findFirst({
            where: { id, companyId: user.companyId },
        });

        if (!note) {
            return NextResponse.json(errorResponse("Nota não encontrada"), { status: 404 });
        }

        await prisma.customerNote.delete({ where: { id } });

        return NextResponse.json(successResponse(null, "Nota deletada!"));
    } catch (error) {
        logger.error("[Customer Notes API] DELETE error", { error, route: "/api/customers/notes" });
        return NextResponse.json(errorResponse("Erro ao deletar nota"), { status: 500 });
    }
}
