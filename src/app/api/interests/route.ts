/**
 * API: Customer Interests
 * 
 * GET - Lista interesses de clientes da empresa
 * PATCH - Atualiza status de um interesse
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";

export async function GET(request: NextRequest) {
    try {
        const companyId = request.headers.get("x-company-id");

        if (!companyId) {
            return NextResponse.json(
                { success: false, error: "Empresa não identificada" },
                { status: 401 }
            );
        }

        const { searchParams } = new URL(request.url);
        const status = searchParams.get("status");
        const page = parseInt(searchParams.get("page") || "1");
        const limit = parseInt(searchParams.get("limit") || "20");

        const where: Record<string, unknown> = { companyId };
        if (status && status !== "all") {
            where.status = status;
        }

        const [interests, total] = await Promise.all([
            prisma.customerInterest.findMany({
                where,
                include: {
                    conversation: {
                        select: {
                            id: true,
                            customerPhone: true,
                            customerName: true,
                            lastMessageAt: true,
                        },
                    },
                },
                orderBy: { createdAt: "desc" },
                skip: (page - 1) * limit,
                take: limit,
            }),
            prisma.customerInterest.count({ where }),
        ]);

        return NextResponse.json({
            success: true,
            data: interests,
            pagination: {
                page,
                limit,
                total,
                pages: Math.ceil(total / limit),
            },
        });
    } catch (error) {
        logger.error("[API Interests] Error", { error, route: "/api/interests" });
        return NextResponse.json(
            { success: false, error: "Erro ao buscar interesses" },
            { status: 500 }
        );
    }
}

export async function PATCH(request: NextRequest) {
    try {
        const companyId = request.headers.get("x-company-id");

        if (!companyId) {
            return NextResponse.json(
                { success: false, error: "Empresa não identificada" },
                { status: 401 }
            );
        }

        const body = await request.json();
        const { id, status, priority, estimatedValue } = body;

        if (!id) {
            return NextResponse.json(
                { success: false, error: "ID é obrigatório" },
                { status: 400 }
            );
        }

        // Verificar se interesse pertence à empresa
        const interest = await prisma.customerInterest.findFirst({
            where: { id, companyId },
        });

        if (!interest) {
            return NextResponse.json(
                { success: false, error: "Interesse não encontrado" },
                { status: 404 }
            );
        }

        // Build update data
        const updateData: Record<string, unknown> = {};
        if (status) updateData.status = status;
        if (priority !== undefined) updateData.priority = priority;
        if (estimatedValue !== undefined) updateData.estimatedValue = estimatedValue;

        const updated = await prisma.customerInterest.update({
            where: { id },
            data: updateData,
        });

        return NextResponse.json({
            success: true,
            data: updated,
        });
    } catch (error) {
        logger.error("[API Interests] Error", { error, route: "/api/interests" });
        return NextResponse.json(
            { success: false, error: "Erro ao atualizar interesse" },
            { status: 500 }
        );
    }
}
