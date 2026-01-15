/**
 * API: Products
 * 
 * GET - Lista produtos da empresa
 * POST - Cria novo produto
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { successResponse, errorResponse } from "@/lib/api-response";
import { logger } from "@/lib/logger";

// GET - Listar produtos
export async function GET(request: NextRequest) {
    try {
        const companyId = request.headers.get("x-company-id");

        if (!companyId) {
            return NextResponse.json(
                errorResponse("Empresa não identificada"),
                { status: 401 }
            );
        }

        const { searchParams } = new URL(request.url);
        const search = searchParams.get("search") || "";
        const categoryId = searchParams.get("categoryId");
        const status = searchParams.get("status"); // "active" | "inactive" | "all"
        const page = parseInt(searchParams.get("page") || "1");
        const limit = parseInt(searchParams.get("limit") || "50");

        // Build where clause
        const where: Record<string, unknown> = { companyId };

        if (search) {
            where.OR = [
                { name: { contains: search, mode: "insensitive" } },
                { description: { contains: search, mode: "insensitive" } },
            ];
        }

        if (categoryId) {
            where.categoryId = categoryId;
        }

        if (status === "active") {
            where.isActive = true;
        } else if (status === "inactive") {
            where.isActive = false;
        }

        // Filtro para produtos pendentes de revisão (extraídos via IA)
        const needsReview = searchParams.get("needsReview");
        if (needsReview === "true") {
            where.needsReview = true;
        } else if (needsReview === "false") {
            where.needsReview = false;
        }

        // Filtro para produtos extraídos via IA
        const extractedFromAI = searchParams.get("extractedFromAI");
        if (extractedFromAI === "true") {
            where.extractedFromAI = true;
        }

        const [products, total] = await Promise.all([
            prisma.product.findMany({
                where,
                include: {
                    category: {
                        select: {
                            id: true,
                            name: true,
                            color: true,
                        },
                    },
                },
                orderBy: { createdAt: "desc" },
                skip: (page - 1) * limit,
                take: limit,
            }),
            prisma.product.count({ where }),
        ]);

        return NextResponse.json(successResponse({
            products,
            pagination: {
                page,
                limit,
                total,
                pages: Math.ceil(total / limit),
            },
        }));
    } catch (error) {
        logger.error("[API Products] GET error", { error, route: "/api/products", method: "GET" });
        return NextResponse.json(
            errorResponse("Erro ao buscar produtos"),
            { status: 500 }
        );
    }
}

// POST - Criar produto
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
        const {
            name,
            description,
            price,
            imageUrl,
            imagePublicId,
            categoryId,
            stockEnabled = false,
            stockQuantity = 0,
            isActive = true,
            // Novos campos de moda
            sizes = [],
            colors = [],
            material,
            sku,
            gender,
        } = body;

        // Validações
        if (!name || typeof name !== "string" || name.trim().length === 0) {
            return NextResponse.json(
                errorResponse("Nome do produto é obrigatório"),
                { status: 400 }
            );
        }

        if (price === undefined || price === null || isNaN(parseFloat(price)) || parseFloat(price) < 0) {
            return NextResponse.json(
                errorResponse("Preço deve ser um número válido"),
                { status: 400 }
            );
        }

        // Verificar se categoria existe (se informada)
        if (categoryId) {
            const categoryExists = await prisma.category.findFirst({
                where: { id: categoryId, companyId },
            });
            if (!categoryExists) {
                return NextResponse.json(
                    errorResponse("Categoria não encontrada"),
                    { status: 400 }
                );
            }
        }

        const product = await prisma.product.create({
            data: {
                companyId,
                name: name.trim(),
                description: description?.trim() || null,
                price: parseFloat(price),
                imageUrl: imageUrl || null,
                imagePublicId: imagePublicId || null,
                categoryId: categoryId || null,
                stockEnabled: Boolean(stockEnabled),
                stockQuantity: parseInt(stockQuantity) || 0,
                isActive: Boolean(isActive),
                // Novos campos de moda
                sizes: Array.isArray(sizes) ? sizes : [],
                colors: Array.isArray(colors) ? colors : [],
                material: material?.trim() || null,
                sku: sku?.trim() || null,
                gender: gender || null,
            },
            include: {
                category: {
                    select: { id: true, name: true, color: true },
                },
            },
        });

        return NextResponse.json(successResponse(product), { status: 201 });
    } catch (error) {
        logger.error("[API Products] POST error", { error, route: "/api/products", method: "POST" });
        return NextResponse.json(
            errorResponse("Erro ao criar produto"),
            { status: 500 }
        );
    }
}
