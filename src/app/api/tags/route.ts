/**
 * API: Tags (CRM)
 * 
 * GET /api/tags - Listar tags da empresa
 * POST /api/tags - Criar nova tag
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { logger } from "@/lib/logger";

/**
 * GET /api/tags - List all tags for the company
 */
export async function GET() {
    try {
        const user = await getCurrentUser();
        if (!user || !user.companyId) {
            return NextResponse.json(
                { success: false, error: "Não autorizado" },
                { status: 401 }
            );
        }

        const tags = await prisma.tag.findMany({
            where: { companyId: user.companyId },
            orderBy: { name: "asc" },
        });

        return NextResponse.json({
            success: true,
            data: tags,
        });

    } catch (error) {
        logger.error("[Tags API] Error", { error, route: "/api/tags" });
        return NextResponse.json(
            { success: false, error: "Erro ao buscar tags" },
            { status: 500 }
        );
    }
}

/**
 * POST /api/tags - Create a new tag
 */
export async function POST(request: NextRequest) {
    try {
        const user = await getCurrentUser();
        if (!user || !user.companyId) {
            return NextResponse.json(
                { success: false, error: "Não autorizado" },
                { status: 401 }
            );
        }

        const body = await request.json();
        const { name, color } = body;

        if (!name || typeof name !== "string" || name.trim().length === 0) {
            return NextResponse.json(
                { success: false, error: "Nome da tag é obrigatório" },
                { status: 400 }
            );
        }

        // Check if tag already exists
        const existing = await prisma.tag.findUnique({
            where: {
                companyId_name: {
                    companyId: user.companyId,
                    name: name.trim(),
                },
            },
        });

        if (existing) {
            return NextResponse.json(
                { success: false, error: "Tag já existe" },
                { status: 409 }
            );
        }

        const tag = await prisma.tag.create({
            data: {
                companyId: user.companyId,
                name: name.trim(),
                color: color || "#a78bfa",
            },
        });

        return NextResponse.json({
            success: true,
            data: tag,
        });

    } catch (error) {
        logger.error("[Tags API] Error", { error, route: "/api/tags" });
        return NextResponse.json(
            { success: false, error: "Erro ao criar tag" },
            { status: 500 }
        );
    }
}
