import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { successResponse, errorResponse, handleApiError } from "@/lib/api-response";
import { logger } from "@/lib/logger";

// GET - Dashboard statistics
export async function GET() {
    try {
        const user = await getCurrentUser();

        if (!user || user.role !== "SUPER_ADMIN") {
            return NextResponse.json(errorResponse("Não autorizado"), { status: 401 });
        }

        // Get current date info
        const now = new Date();
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0);

        // Total companies
        const totalCompanies = await prisma.company.count();

        // Active companies (ACTIVE status)
        const activeCompanies = await prisma.company.count({
            where: { status: "ACTIVE" },
        });

        // New companies this month
        const newCompaniesMonth = await prisma.company.count({
            where: {
                createdAt: { gte: startOfMonth },
            },
        });

        // New companies last month (for growth calculation)
        const newCompaniesLastMonth = await prisma.company.count({
            where: {
                createdAt: {
                    gte: startOfLastMonth,
                    lte: endOfLastMonth,
                },
            },
        });

        // Total messages
        const totalMessages = await prisma.message.count();

        // Messages this month
        const messagesThisMonth = await prisma.message.count({
            where: {
                createdAt: { gte: startOfMonth },
            },
        });

        // Active WhatsApp sessions
        const activeWhatsApp = await prisma.whatsAppSession.count({
            where: { status: "CONNECTED" },
        });

        // Total WhatsApp sessions
        const totalWhatsApp = await prisma.whatsAppSession.count();

        // Token usage this month
        const tokenUsageThisMonth = await prisma.tokenUsage.aggregate({
            where: {
                month: { gte: startOfMonth },
            },
            _sum: {
                inputTokens: true,
                outputTokens: true,
            },
        });

        // Revenue calculation (based on active subscriptions)
        const subscriptions = await prisma.subscription.findMany({
            where: {
                status: "ACTIVE",
            },
            include: {
                plan: true,
            },
        });

        const monthlyRevenue = subscriptions.reduce((sum, sub) => {
            return sum + Number(sub.plan.price);
        }, 0);

        // Revenue by plan
        const revenueByPlan = await prisma.plan.findMany({
            include: {
                _count: {
                    select: { subscriptions: { where: { status: "ACTIVE" } } },
                },
                subscriptions: {
                    where: { status: "ACTIVE" },
                    select: { id: true },
                },
            },
        });

        const planRevenue = revenueByPlan.map((plan) => ({
            name: plan.name,
            count: plan._count.subscriptions,
            revenue: Number(plan.price) * plan._count.subscriptions,
            color: plan.name === "BASIC" ? "slate" : plan.name === "PRO" ? "purple" : "pink",
        }));

        // Total AI agents
        const totalAgents = await prisma.aIAgent.count();

        // Active conversations
        const activeConversations = await prisma.conversation.count({
            where: { status: "AI_HANDLING" },
        });

        // Recent companies
        const recentCompanies = await prisma.company.findMany({
            take: 5,
            orderBy: { createdAt: "desc" },
            include: {
                subscription: {
                    include: { plan: true },
                },
                _count: {
                    select: { conversations: true },
                },
            },
        });

        // Calculate monthly growth percentage
        const monthlyGrowth = newCompaniesLastMonth > 0
            ? ((newCompaniesMonth - newCompaniesLastMonth) / newCompaniesLastMonth) * 100
            : newCompaniesMonth > 0 ? 100 : 0;

        return NextResponse.json(successResponse({
            stats: {
                totalCompanies,
                activeCompanies,
                newCompaniesMonth,
                monthlyGrowth: Math.round(monthlyGrowth * 10) / 10,
                totalMessages,
                messagesThisMonth,
                activeWhatsApp,
                totalWhatsApp,
                totalAgents,
                activeConversations,
                monthlyRevenue: Math.round(monthlyRevenue * 100) / 100,
                totalTokens: (tokenUsageThisMonth._sum.inputTokens || 0) + (tokenUsageThisMonth._sum.outputTokens || 0),
            },
            planRevenue,
            recentCompanies: recentCompanies.map((c) => ({
                id: c.id,
                name: c.name,
                email: c.email,
                status: c.status,
                plan: c.subscription?.plan?.name || "FREE",
                revenue: c.subscription?.plan?.price || 0,
                messagesCount: c._count.conversations,
                createdAt: c.createdAt,
            })),
        }));
    } catch (error) {
        logger.error("[Admin Dashboard] Error", { error, route: "/api/admin/dashboard" });
        return NextResponse.json(handleApiError(error), { status: 500 });
    }
}
