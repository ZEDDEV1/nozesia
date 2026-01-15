/**
 * API: Product Import via CSV
 * 
 * POST /api/products/import - Import products from CSV data
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { successResponse, errorResponse } from "@/lib/api-response";
import { logger } from "@/lib/logger";

interface ProductRow {
    name: string;
    description?: string;
    price: number;
    category?: string;
    imageUrl?: string;
}

/**
 * POST /api/products/import
 * Import products from CSV data
 * 
 * Body: { products: ProductRow[] }
 */
export async function POST(request: NextRequest) {
    try {
        const user = await getCurrentUser();
        if (!user || !user.companyId) {
            return NextResponse.json(errorResponse("Não autorizado"), { status: 401 });
        }

        const body = await request.json();
        const { products } = body as { products: ProductRow[] };

        if (!products || !Array.isArray(products) || products.length === 0) {
            return NextResponse.json(
                errorResponse("Lista de produtos é obrigatória"),
                { status: 400 }
            );
        }

        if (products.length > 500) {
            return NextResponse.json(
                errorResponse("Máximo de 500 produtos por importação"),
                { status: 400 }
            );
        }

        const results = {
            created: 0,
            updated: 0,
            errors: [] as string[],
        };

        // Process products
        for (const product of products) {
            try {
                // Validate required fields
                if (!product.name || typeof product.name !== "string") {
                    results.errors.push(`Produto sem nome válido`);
                    continue;
                }

                const price = parseFloat(String(product.price));
                if (isNaN(price) || price < 0) {
                    results.errors.push(`${product.name}: preço inválido`);
                    continue;
                }

                // Find or create category if provided
                let categoryId: string | null = null;
                if (product.category && product.category.trim()) {
                    const category = await prisma.category.upsert({
                        where: {
                            companyId_name: {
                                companyId: user.companyId,
                                name: product.category.trim(),
                            },
                        },
                        create: {
                            companyId: user.companyId,
                            name: product.category.trim(),
                        },
                        update: {},
                    });
                    categoryId = category.id;
                }

                // Check if product exists (by name)
                const existing = await prisma.product.findFirst({
                    where: {
                        companyId: user.companyId,
                        name: product.name.trim(),
                    },
                });

                if (existing) {
                    // Update existing
                    await prisma.product.update({
                        where: { id: existing.id },
                        data: {
                            description: product.description || existing.description,
                            price,
                            categoryId: categoryId || existing.categoryId,
                            imageUrl: product.imageUrl || existing.imageUrl,
                        },
                    });
                    results.updated++;
                } else {
                    // Create new
                    await prisma.product.create({
                        data: {
                            companyId: user.companyId,
                            name: product.name.trim(),
                            description: product.description || null,
                            price,
                            categoryId,
                            imageUrl: product.imageUrl || null,
                        },
                    });
                    results.created++;
                }
            } catch (_err) {
                results.errors.push(`${product.name}: erro ao processar`);
            }
        }

        logger.info("[Product Import] Completed", {
            companyId: user.companyId,
            created: results.created,
            updated: results.updated,
            errors: results.errors.length,
        });

        return NextResponse.json(successResponse({
            ...results,
            total: products.length,
        }, `Importação concluída: ${results.created} criados, ${results.updated} atualizados`));
    } catch (error) {
        logger.error("[Product Import] Error", { error, route: "/api/products/import" });
        return NextResponse.json(errorResponse("Erro na importação"), { status: 500 });
    }
}
