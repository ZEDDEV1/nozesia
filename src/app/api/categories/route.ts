/**
 * API: Categories
 * 
 * GET - Lista categorias da empresa
 * POST - Cria nova categoria
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { successResponse, errorResponse } from "@/lib/api-response";
import { logger } from "@/lib/logger";

// GET - Listar categorias
export async function GET(request: NextRequest) {
    try {
        const companyId = request.headers.get("x-company-id");

        if (!companyId) {
            return NextResponse.json(
                errorResponse("Empresa não identificada"),
                { status: 401 }
            );
        }

        const categories = await prisma.category.findMany({
            where: { companyId },
            include: {
                _count: {
                    select: { products: true },
                },
            },
            orderBy: [{ order: "asc" }, { name: "asc" }],
        });

        return NextResponse.json(successResponse(categories));
    } catch (error) {
        logger.error("[API Categories] GET error", { error, route: "/api/categories", method: "GET" });
        return NextResponse.json(
            errorResponse("Erro ao buscar categorias"),
            { status: 500 }
        );
    }
}

// POST - Criar categoria
export async function POST(request: NextRequest) {
    try {
        const companyId = request.headers.get("x-company-id");

        if (!companyId) {
            return NextResponse.json(
                errorResponse("Empresa não identificada"),
                { status: 401 }
            );
        }

        const body = await request.json();
        const { name, description, color, icon } = body;

        if (!name || typeof name !== "string" || name.trim().length === 0) {
            return NextResponse.json(
                errorResponse("Nome da categoria é obrigatório"),
                { status: 400 }
            );
        }

        // Verificar se já existe
        const existing = await prisma.category.findFirst({
            where: { companyId, name: name.trim() },
        });

        if (existing) {
            return NextResponse.json(
                errorResponse("Já existe uma categoria com este nome"),
                { status: 400 }
            );
        }

        // Pegar a ordem máxima atual
        const maxOrder = await prisma.category.aggregate({
            where: { companyId },
            _max: { order: true },
        });

        const category = await prisma.category.create({
            data: {
                companyId,
                name: name.trim(),
                description: description?.trim() || null,
                color: color || "#a855f7",
                icon: icon || null,
                order: (maxOrder._max.order ?? 0) + 1,
            },
        });

        return NextResponse.json(successResponse(category), { status: 201 });
    } catch (error) {
        logger.error("[API Categories] POST error", { error, route: "/api/categories", method: "POST" });
        return NextResponse.json(
            errorResponse("Erro ao criar categoria"),
            { status: 500 }
        );
    }
}
