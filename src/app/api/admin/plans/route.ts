import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { planSchema, validateRequest } from "@/lib/validations";
import { successResponse, errorResponse, handleApiError } from "@/lib/api-response";
import { logger } from "@/lib/logger";

// GET - List all plans with statistics
export async function GET() {
    try {
        const user = await getCurrentUser();

        if (!user || user.role !== "SUPER_ADMIN") {
            return NextResponse.json(errorResponse("Não autorizado"), { status: 401 });
        }

        const plans = await prisma.plan.findMany({
            orderBy: { price: "asc" },
            include: {
                _count: {
                    select: {
                        subscriptions: true,
                    },
                },
                subscriptions: {
                    where: { status: "ACTIVE" },
                    select: { id: true },
                },
            },
        });

        const plansWithStats = plans.map((plan) => ({
            id: plan.id,
            name: plan.name,
            type: plan.type,
            price: Number(plan.price),
            features: plan.features,
            maxAgents: plan.maxAgents,
            maxWhatsAppNumbers: plan.maxWhatsAppNumbers,
            maxTokensPerMonth: plan.maxTokensMonth,
            maxMessagesPerMonth: plan.maxMessagesMonth,
            isActive: plan.isActive,
            allowAudio: plan.allowAudio,
            allowVoice: plan.allowVoice,
            allowHumanTransfer: plan.allowHumanTransfer,
            allowApiAccess: plan.allowApiAccess,
            allowWhiteLabel: plan.allowWhiteLabel,
            totalSubscriptions: plan._count.subscriptions,
            activeSubscriptions: plan.subscriptions.length,
            monthlyRevenue: Number(plan.price) * plan.subscriptions.length,
            createdAt: plan.createdAt,
        }));

        return NextResponse.json(successResponse(plansWithStats));
    } catch (error) {
        logger.error("[Admin Plans] Error fetching plans:", { error });
        return NextResponse.json(handleApiError(error), { status: 500 });
    }
}

// POST - Create new plan
export async function POST(request: Request) {
    try {
        const user = await getCurrentUser();

        if (!user || user.role !== "SUPER_ADMIN") {
            return NextResponse.json(errorResponse("Não autorizado"), { status: 401 });
        }

        const body = await request.json();

        // Adaptar campos do frontend para o schema
        const schemaData = {
            name: body.name,
            type: body.type,
            price: typeof body.price === 'string' ? parseFloat(body.price) : body.price,
            features: body.features ? (Array.isArray(body.features) ? body.features : JSON.parse(body.features)) : [],
            maxAgents: body.maxAgents || 1,
            maxWhatsAppNumbers: body.maxWhatsAppNumbers || 1,
            maxTokensMonth: body.maxTokensPerMonth || body.maxTokensMonth || 10000,
            maxMessagesMonth: body.maxMessagesPerMonth || body.maxMessagesMonth || 1000,
            allowAudio: body.allowAudio || false,
            allowVoice: body.allowVoice || false,
            allowHumanTransfer: body.allowHumanTransfer || false,
            allowApiAccess: body.allowApiAccess || false,
            allowWhiteLabel: body.allowWhiteLabel || false,
            isActive: body.isActive !== false,
        };

        // Validar com Zod
        const validation = validateRequest(planSchema, schemaData);
        if (!validation.success) {
            return validation.response;
        }

        const data = validation.data;

        const plan = await prisma.plan.create({
            data: {
                name: data.name,
                type: data.type,
                price: data.price,
                features: JSON.stringify(data.features),
                maxAgents: data.maxAgents,
                maxWhatsAppNumbers: data.maxWhatsAppNumbers,
                maxTokensMonth: data.maxTokensMonth,
                maxMessagesMonth: data.maxMessagesMonth,
                allowAudio: data.allowAudio,
                allowVoice: data.allowVoice,
                allowHumanTransfer: data.allowHumanTransfer,
                allowApiAccess: data.allowApiAccess,
                allowWhiteLabel: data.allowWhiteLabel,
                isActive: data.isActive,
            },
        });

        logger.info("[Admin Plans] Plan created:", { planId: plan.id, name: plan.name });

        return NextResponse.json(successResponse(plan), { status: 201 });
    } catch (error) {
        logger.error("[Admin Plans] Error creating plan:", { error });
        return NextResponse.json(handleApiError(error), { status: 500 });
    }
}
