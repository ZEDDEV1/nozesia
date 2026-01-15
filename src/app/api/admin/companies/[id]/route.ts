import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { adminUpdateCompanySchema, validateRequest } from "@/lib/validations";
import { successResponse, errorResponse, handleApiError } from "@/lib/api-response";
import { logger } from "@/lib/logger";

interface RouteParams {
    params: Promise<{ id: string }>;
}

// GET - Company details
export async function GET(request: Request, { params }: RouteParams) {
    try {
        const user = await getCurrentUser();
        const { id } = await params;

        if (!user || user.role !== "SUPER_ADMIN") {
            return NextResponse.json(errorResponse("Não autorizado"), { status: 401 });
        }

        const company = await prisma.company.findUnique({
            where: { id },
            include: {
                subscription: {
                    include: { plan: true },
                },
                users: {
                    select: {
                        id: true,
                        name: true,
                        email: true,
                        role: true,
                        createdAt: true,
                        lastLoginAt: true,
                    },
                },
                agents: true,
                sessions: true,
                conversations: {
                    take: 10,
                    orderBy: { updatedAt: "desc" },
                    include: {
                        _count: { select: { messages: true } },
                    },
                },
                tokenUsage: {
                    take: 6,
                    orderBy: { month: "desc" },
                },
                _count: {
                    select: {
                        users: true,
                        agents: true,
                        sessions: true,
                        conversations: true,
                    },
                },
            },
        });

        if (!company) {
            return NextResponse.json(errorResponse("Empresa não encontrada"), { status: 404 });
        }

        // Get total messages count
        const messagesCount = await prisma.message.count({
            where: { conversation: { companyId: id } }
        });

        // Map field names to match frontend expectations
        const responseData = {
            ...company,
            aiAgents: company.agents, // Frontend expects aiAgents, not agents
            whatsAppSessions: company.sessions, // Frontend expects whatsAppSessions, not sessions
            _count: {
                ...company._count,
                aiAgents: company._count.agents,
                whatsAppSessions: company._count.sessions,
                messages: messagesCount,
            }
        };

        return NextResponse.json(successResponse(responseData));
    } catch (error) {
        logger.error("[Admin Companies] Error fetching company:", { error });
        return NextResponse.json(handleApiError(error), { status: 500 });
    }
}

// PUT - Update company
export async function PUT(request: Request, { params }: RouteParams) {
    try {
        const user = await getCurrentUser();
        const { id } = await params;

        if (!user || user.role !== "SUPER_ADMIN") {
            return NextResponse.json(errorResponse("Não autorizado"), { status: 401 });
        }

        const body = await request.json();

        // Validar com Zod
        const validation = validateRequest(adminUpdateCompanySchema, body);
        if (!validation.success) {
            return validation.response;
        }

        const { name, email, phone, document, status, planId, timezone, monthlyTokenLimit, extraAgents, extraWhatsApps } = validation.data;

        // Update company
        const company = await prisma.company.update({
            where: { id },
            data: {
                ...(name && { name }),
                ...(email && { email }),
                ...(phone !== undefined && { phone }),
                ...(document !== undefined && { document }),
                ...(status && { status }),
                ...(timezone && { timezone }),
                ...(monthlyTokenLimit !== undefined && { monthlyTokenLimit }),
                ...(extraAgents !== undefined && { extraAgents }),
                ...(extraWhatsApps !== undefined && { extraWhatsApps }),
            },
        });

        // Update plan if provided
        if (planId) {
            await prisma.subscription.upsert({
                where: { companyId: id },
                update: { planId },
                create: {
                    companyId: id,
                    planId,
                    status: "ACTIVE",
                    currentPeriodStart: new Date(),
                    currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
                },
            });
        }

        logger.info("[Admin Companies] Company updated:", { companyId: id });

        return NextResponse.json(successResponse(company));
    } catch (error) {
        logger.error("[Admin Companies] Error updating company:", { error });
        return NextResponse.json(handleApiError(error), { status: 500 });
    }
}

// DELETE - Delete company
export async function DELETE(request: Request, { params }: RouteParams) {
    try {
        const user = await getCurrentUser();
        const { id } = await params;

        if (!user || user.role !== "SUPER_ADMIN") {
            return NextResponse.json(errorResponse("Não autorizado"), { status: 401 });
        }

        // Delete in order to respect foreign keys
        await prisma.$transaction([
            prisma.message.deleteMany({ where: { conversation: { companyId: id } } }),
            prisma.conversation.deleteMany({ where: { companyId: id } }),
            prisma.trainingData.deleteMany({ where: { agent: { companyId: id } } }),
            prisma.aIAgent.deleteMany({ where: { companyId: id } }),
            prisma.whatsAppSession.deleteMany({ where: { companyId: id } }),
            prisma.tokenUsage.deleteMany({ where: { companyId: id } }),
            prisma.subscription.deleteMany({ where: { companyId: id } }),
            prisma.user.deleteMany({ where: { companyId: id } }),
            prisma.company.delete({ where: { id } }),
        ]);

        logger.warn("[Admin Companies] Company deleted:", { companyId: id, deletedBy: user.email });

        return NextResponse.json(successResponse({ message: "Empresa excluída com sucesso" }));
    } catch (error) {
        logger.error("[Admin Companies] Error deleting company:", { error });
        return NextResponse.json(handleApiError(error), { status: 500 });
    }
}
