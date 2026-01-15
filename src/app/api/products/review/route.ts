/**
 * API: Products Review
 * 
 * PATCH - Aprovar/Rejeitar produtos extraídos em batch
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { successResponse, errorResponse } from "@/lib/api-response";
import { logger } from "@/lib/logger";

interface ReviewAction {
    productId: string;
    action: "approve" | "reject" | "update";
    updates?: {
        name?: string;
        description?: string;
        price?: number;
    };
}

// PATCH - Revisar produtos em batch
export async function PATCH(request: NextRequest) {
    try {
        const companyId = request.headers.get("x-company-id");

        if (!companyId) {
            return NextResponse.json(
                errorResponse("Empresa não identificada"),
                { status: 401 }
            );
        }

        const body = await request.json();
        const { actions }: { actions: ReviewAction[] } = body;

        if (!Array.isArray(actions) || actions.length === 0) {
            return NextResponse.json(
                errorResponse("Lista de ações é obrigatória"),
                { status: 400 }
            );
        }

        const results = {
            approved: 0,
            rejected: 0,
            updated: 0,
            errors: [] as string[],
        };

        for (const action of actions) {
            try {
                // Verificar se produto existe e pertence à empresa
                const product = await prisma.product.findFirst({
                    where: {
                        id: action.productId,
                        companyId,
                    },
                });

                if (!product) {
                    results.errors.push(`Produto ${action.productId} não encontrado`);
                    continue;
                }

                if (action.action === "approve") {
                    // Aprovar: marcar como revisado
                    await prisma.product.update({
                        where: { id: action.productId },
                        data: { needsReview: false },
                    });
                    results.approved++;
                } else if (action.action === "reject") {
                    // Rejeitar: deletar produto
                    await prisma.product.delete({
                        where: { id: action.productId },
                    });
                    results.rejected++;
                } else if (action.action === "update") {
                    // Atualizar e aprovar
                    const updates: Record<string, unknown> = {
                        needsReview: false,
                    };

                    if (action.updates?.name) {
                        updates.name = action.updates.name.trim();
                    }
                    if (action.updates?.description !== undefined) {
                        updates.description = action.updates.description?.trim() || null;
                    }
                    if (action.updates?.price !== undefined) {
                        updates.price = Math.max(0, action.updates.price);
                    }

                    await prisma.product.update({
                        where: { id: action.productId },
                        data: updates,
                    });
                    results.updated++;
                }
            } catch (actionError) {
                logger.warn("[API Products Review] Action failed", {
                    action: JSON.stringify(action),
                    error: actionError,
                });
                results.errors.push(`Erro ao processar ${action.productId}`);
            }
        }

        logger.info("[API Products Review] Batch review completed", {
            companyId,
            ...results,
        });

        return NextResponse.json(successResponse({
            ...results,
            total: results.approved + results.rejected + results.updated,
            message: `${results.approved} aprovados, ${results.rejected} rejeitados, ${results.updated} atualizados`,
        }));
    } catch (error) {
        logger.error("[API Products Review] PATCH error", { error });
        return NextResponse.json(
            errorResponse("Erro ao revisar produtos"),
            { status: 500 }
        );
    }
}

// GET - Contar produtos pendentes de revisão
export async function GET(request: NextRequest) {
    try {
        const companyId = request.headers.get("x-company-id");

        if (!companyId) {
            return NextResponse.json(
                errorResponse("Empresa não identificada"),
                { status: 401 }
            );
        }

        const pendingCount = await prisma.product.count({
            where: {
                companyId,
                needsReview: true,
            },
        });

        return NextResponse.json(successResponse({
            pendingCount,
            hasPending: pendingCount > 0,
        }));
    } catch (error) {
        logger.error("[API Products Review] GET error", { error });
        return NextResponse.json(
            errorResponse("Erro ao contar produtos pendentes"),
            { status: 500 }
        );
    }
}
