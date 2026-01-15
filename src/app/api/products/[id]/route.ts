/**
 * API: Product by ID
 * 
 * GET - Buscar produto por ID
 * PATCH - Atualizar produto
 * DELETE - Excluir produto
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { successResponse, errorResponse } from "@/lib/api-response";
import { deleteFile } from "@/lib/upload";
import { logger } from "@/lib/logger";

interface Params {
    params: Promise<{ id: string }>;
}

// GET - Buscar produto por ID
export async function GET(request: NextRequest, { params }: Params) {
    try {
        const { id } = await params;
        const companyId = request.headers.get("x-company-id");

        if (!companyId) {
            return NextResponse.json(
                errorResponse("Empresa não identificada"),
                { status: 401 }
            );
        }

        const product = await prisma.product.findFirst({
            where: { id, companyId },
            include: {
                category: {
                    select: { id: true, name: true, color: true },
                },
            },
        });

        if (!product) {
            return NextResponse.json(
                errorResponse("Produto não encontrado"),
                { status: 404 }
            );
        }

        return NextResponse.json(successResponse(product));
    } catch (error) {
        logger.error("[API Products] GET by ID error", { error, route: "/api/products/[id]", method: "GET" });
        return NextResponse.json(
            errorResponse("Erro ao buscar produto"),
            { status: 500 }
        );
    }
}

// PATCH - Atualizar produto
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

        const existing = await prisma.product.findFirst({
            where: { id, companyId },
        });

        if (!existing) {
            return NextResponse.json(
                errorResponse("Produto não encontrado"),
                { status: 404 }
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
            stockEnabled,
            stockQuantity,
            isActive,
            // Novos campos de moda
            sizes,
            colors,
            material,
            sku,
            gender,
        } = body;

        const updateData: Record<string, unknown> = {};

        if (name !== undefined) {
            if (typeof name !== "string" || name.trim().length === 0) {
                return NextResponse.json(
                    errorResponse("Nome do produto é obrigatório"),
                    { status: 400 }
                );
            }
            updateData.name = name.trim();
        }

        if (price !== undefined) {
            if (isNaN(parseFloat(price)) || parseFloat(price) < 0) {
                return NextResponse.json(
                    errorResponse("Preço deve ser um número válido"),
                    { status: 400 }
                );
            }
            updateData.price = parseFloat(price);
        }

        if (description !== undefined) updateData.description = description?.trim() || null;

        // Se trocou a imagem, deletar a antiga do Cloudinary
        if (imageUrl !== undefined) {
            if (existing.imagePublicId && imagePublicId !== existing.imagePublicId) {
                await deleteFile(existing.imagePublicId);
            }
            updateData.imageUrl = imageUrl || null;
        }
        if (imagePublicId !== undefined) updateData.imagePublicId = imagePublicId || null;

        if (categoryId !== undefined) {
            if (categoryId) {
                // Verificar se categoria existe
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
            updateData.categoryId = categoryId || null;
        }

        if (stockEnabled !== undefined) updateData.stockEnabled = Boolean(stockEnabled);
        if (stockQuantity !== undefined) updateData.stockQuantity = parseInt(stockQuantity) || 0;
        if (isActive !== undefined) updateData.isActive = Boolean(isActive);

        // Novos campos de moda
        if (sizes !== undefined) updateData.sizes = Array.isArray(sizes) ? sizes : [];
        if (colors !== undefined) updateData.colors = Array.isArray(colors) ? colors : [];
        if (material !== undefined) updateData.material = material?.trim() || null;
        if (sku !== undefined) updateData.sku = sku?.trim() || null;
        if (gender !== undefined) updateData.gender = gender || null;

        const product = await prisma.product.update({
            where: { id },
            data: updateData,
            include: {
                category: {
                    select: { id: true, name: true, color: true },
                },
            },
        });

        return NextResponse.json(successResponse(product));
    } catch (error) {
        logger.error("[API Products] PATCH error", { error, route: "/api/products/[id]", method: "PATCH" });
        return NextResponse.json(
            errorResponse("Erro ao atualizar produto"),
            { status: 500 }
        );
    }
}

// DELETE - Excluir produto
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

        const existing = await prisma.product.findFirst({
            where: { id, companyId },
        });

        if (!existing) {
            return NextResponse.json(
                errorResponse("Produto não encontrado"),
                { status: 404 }
            );
        }

        // Deletar imagem do Cloudinary se existir
        if (existing.imagePublicId) {
            await deleteFile(existing.imagePublicId);
        }

        await prisma.product.delete({
            where: { id },
        });

        return NextResponse.json(successResponse({ deleted: true }));
    } catch (error) {
        logger.error("[API Products] DELETE error", { error, route: "/api/products/[id]", method: "DELETE" });
        return NextResponse.json(
            errorResponse("Erro ao excluir produto"),
            { status: 500 }
        );
    }
}
