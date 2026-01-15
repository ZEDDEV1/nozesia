import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { successResponse, errorResponse, handleApiError } from "@/lib/api-response";
import { logger } from "@/lib/logger";

interface RouteParams {
    params: Promise<{ id: string }>;
}

// GET - Get plan details
export async function GET(request: Request, { params }: RouteParams) {
    try {
        const user = await getCurrentUser();
        const { id } = await params;

        if (!user || user.role !== "SUPER_ADMIN") {
            return NextResponse.json(errorResponse("Não autorizado"), { status: 401 });
        }

        const plan = await prisma.plan.findUnique({
            where: { id },
            include: {
                subscriptions: {
                    include: {
                        company: true,
                    },
                },
            },
        });

        if (!plan) {
            return NextResponse.json(errorResponse("Plano não encontrado"), { status: 404 });
        }

        return NextResponse.json(successResponse(plan));
    } catch (error) {
        logger.error("[Admin Plans] Error", { error, route: "/api/admin/plans/[id]" });
        return NextResponse.json(handleApiError(error), { status: 500 });
    }
}

// PUT - Update plan
export async function PUT(request: Request, { params }: RouteParams) {
    try {
        const user = await getCurrentUser();
        const { id } = await params;

        if (!user || user.role !== "SUPER_ADMIN") {
            return NextResponse.json(errorResponse("Não autorizado"), { status: 401 });
        }

        const body = await request.json();
        const {
            name,
            price,
            features,
            maxAgents,
            maxWhatsAppNumbers,
            maxTokensMonth,
            maxMessagesMonth,
            isActive,
        } = body;

        const plan = await prisma.plan.update({
            where: { id },
            data: {
                ...(name && { name }),
                ...(price !== undefined && { price: parseFloat(price) }),
                ...(features && { features }),
                ...(maxAgents !== undefined && { maxAgents }),
                ...(maxWhatsAppNumbers !== undefined && { maxWhatsAppNumbers }),
                ...(maxTokensMonth !== undefined && { maxTokensMonth }),
                ...(maxMessagesMonth !== undefined && { maxMessagesMonth }),
                ...(isActive !== undefined && { isActive }),
            },
        });

        return NextResponse.json(successResponse(plan));
    } catch (error) {
        logger.error("[Admin Plans] Error", { error, route: "/api/admin/plans/[id]" });
        return NextResponse.json(handleApiError(error), { status: 500 });
    }
}

// DELETE - Delete plan
export async function DELETE(request: Request, { params }: RouteParams) {
    try {
        const user = await getCurrentUser();
        const { id } = await params;

        if (!user || user.role !== "SUPER_ADMIN") {
            return NextResponse.json(errorResponse("Não autorizado"), { status: 401 });
        }

        // Check if plan has active subscriptions
        const subscriptions = await prisma.subscription.count({
            where: { planId: id, status: "ACTIVE" },
        });

        if (subscriptions > 0) {
            return NextResponse.json(
                errorResponse("Não é possível excluir plano com assinaturas ativas"),
                { status: 400 }
            );
        }

        await prisma.plan.delete({
            where: { id },
        });

        return NextResponse.json(successResponse({ message: "Plano excluído com sucesso" }));
    } catch (error) {
        logger.error("[Admin Plans] Error", { error, route: "/api/admin/plans/[id]" });
        return NextResponse.json(handleApiError(error), { status: 500 });
    }
}
