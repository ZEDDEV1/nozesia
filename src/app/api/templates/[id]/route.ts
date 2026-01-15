/**
 * API: Template by ID
 * 
 * GET - Get template
 * PATCH - Update template
 * DELETE - Delete template
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { logger } from "@/lib/logger";

interface RouteParams {
    params: Promise<{ id: string }>;
}

const _AVAILABLE_VARIABLES = ["nome", "produto", "valor", "empresa", "data"];

/**
 * GET /api/templates/[id] - Get template details
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
    try {
        const user = await getCurrentUser();
        if (!user || !user.companyId) {
            return NextResponse.json(
                { success: false, error: "Não autorizado" },
                { status: 401 }
            );
        }

        const { id } = await params;

        const template = await prisma.messageTemplate.findFirst({
            where: { id, companyId: user.companyId },
        });

        if (!template) {
            return NextResponse.json(
                { success: false, error: "Template não encontrado" },
                { status: 404 }
            );
        }

        return NextResponse.json({
            success: true,
            data: template,
        });
    } catch (error) {
        logger.error("[API Templates] GET error", { error, route: "/api/templates/[id]", method: "GET" });
        return NextResponse.json(
            { success: false, error: "Erro ao buscar template" },
            { status: 500 }
        );
    }
}

/**
 * PATCH /api/templates/[id] - Update template
 */
export async function PATCH(request: NextRequest, { params }: RouteParams) {
    try {
        const user = await getCurrentUser();
        if (!user || !user.companyId) {
            return NextResponse.json(
                { success: false, error: "Não autorizado" },
                { status: 401 }
            );
        }

        const { id } = await params;
        const body = await request.json();
        const { name, content, category, isActive } = body;

        // Verify ownership
        const template = await prisma.messageTemplate.findFirst({
            where: { id, companyId: user.companyId },
        });

        if (!template) {
            return NextResponse.json(
                { success: false, error: "Template não encontrado" },
                { status: 404 }
            );
        }

        const updateData: Record<string, unknown> = {};

        if (name !== undefined) updateData.name = name;
        if (content !== undefined) {
            updateData.content = content;

            // Re-extract variables
            const variableRegex = /\{(\w+)\}/g;
            const matches = content.matchAll(variableRegex);
            updateData.variables = [...new Set([...matches].map((m: RegExpMatchArray) => m[1]))];
        }
        if (category !== undefined) updateData.category = category;
        if (isActive !== undefined) updateData.isActive = isActive;

        const updated = await prisma.messageTemplate.update({
            where: { id },
            data: updateData,
        });

        return NextResponse.json({
            success: true,
            data: updated,
        });
    } catch (error) {
        logger.error("[API Templates] PATCH error", { error, route: "/api/templates/[id]", method: "PATCH" });
        return NextResponse.json(
            { success: false, error: "Erro ao atualizar template" },
            { status: 500 }
        );
    }
}

/**
 * DELETE /api/templates/[id] - Delete template
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
    try {
        const user = await getCurrentUser();
        if (!user || !user.companyId) {
            return NextResponse.json(
                { success: false, error: "Não autorizado" },
                { status: 401 }
            );
        }

        const { id } = await params;

        // Verify ownership
        const template = await prisma.messageTemplate.findFirst({
            where: { id, companyId: user.companyId },
        });

        if (!template) {
            return NextResponse.json(
                { success: false, error: "Template não encontrado" },
                { status: 404 }
            );
        }

        await prisma.messageTemplate.delete({ where: { id } });

        return NextResponse.json({
            success: true,
            message: "Template excluído com sucesso",
        });
    } catch (error) {
        logger.error("[API Templates] DELETE error", { error, route: "/api/templates/[id]", method: "DELETE" });
        return NextResponse.json(
            { success: false, error: "Erro ao excluir template" },
            { status: 500 }
        );
    }
}
