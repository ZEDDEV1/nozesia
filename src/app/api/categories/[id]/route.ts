/**
 * API: Category by ID
 * 
 * PATCH - Atualizar categoria
 * DELETE - Excluir categoria
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { successResponse, errorResponse } from "@/lib/api-response";
import { logger } from "@/lib/logger";

interface Params {
    params: Promise<{ id: string }>;
}

// PATCH - Atualizar categoria
export async function PATCH(request: NextRequest, { params }: Params) {
    try {
        const { id } = await params;
        const companyId = request.headers.get("x-company-id");

        if (!companyId) {
            return NextResponse.json(
                errorResponse("Empresa não identificada"),
                { status: 401 }
            );
        }

        const existing = await prisma.category.findFirst({
            where: { id, companyId },
        });

        if (!existing) {
            return NextResponse.json(
                errorResponse("Categoria não encontrada"),
                { status: 404 }
            );
        }

        const body = await request.json();
        const { name, description, color, icon, order, isActive } = body;

        const updateData: Record<string, unknown> = {};

        if (name !== undefined) {
            if (typeof name !== "string" || name.trim().length === 0) {
                return NextResponse.json(
                    errorResponse("Nome da categoria é obrigatório"),
                    { status: 400 }
                );
            }
            // Check for duplicate name
            const duplicate = await prisma.category.findFirst({
                where: { companyId, name: name.trim(), id: { not: id } },
            });
            if (duplicate) {
                return NextResponse.json(
                    errorResponse("Já existe uma categoria com este nome"),
                    { status: 400 }
                );
            }
            updateData.name = name.trim();
        }

        if (description !== undefined) updateData.description = description?.trim() || null;
        if (color !== undefined) updateData.color = color;
        if (icon !== undefined) updateData.icon = icon;
        if (order !== undefined) updateData.order = parseInt(order) || 0;
        if (isActive !== undefined) updateData.isActive = Boolean(isActive);

        const category = await prisma.category.update({
            where: { id },
            data: updateData,
        });

        return NextResponse.json(successResponse(category));
    } catch (error) {
        logger.error("[API Categories] PATCH error", { error, route: "/api/categories/[id]", method: "PATCH" });
        return NextResponse.json(
            errorResponse("Erro ao atualizar categoria"),
            { status: 500 }
        );
    }
}

// DELETE - Excluir categoria
export async function DELETE(request: NextRequest, { params }: Params) {
    try {
        const { id } = await params;
        const companyId = request.headers.get("x-company-id");

        if (!companyId) {
            return NextResponse.json(
                errorResponse("Empresa não identificada"),
                { status: 401 }
            );
        }

        const existing = await prisma.category.findFirst({
            where: { id, companyId },
        });

        if (!existing) {
            return NextResponse.json(
                errorResponse("Categoria não encontrada"),
                { status: 404 }
            );
        }

        // Remove a categoria (produtos ficam sem categoria via SetNull)
        await prisma.category.delete({
            where: { id },
        });

        return NextResponse.json(successResponse({ deleted: true }));
    } catch (error) {
        logger.error("[API Categories] DELETE error", { error, route: "/api/categories/[id]", method: "DELETE" });
        return NextResponse.json(
            errorResponse("Erro ao excluir categoria"),
            { status: 500 }
        );
    }
}
