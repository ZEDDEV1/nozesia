import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { successResponse, errorResponse, handleApiError } from "@/lib/api-response";
import { logger } from "@/lib/logger";

// GET - Token usage across all companies
export async function GET() {
    try {
        const user = await getCurrentUser();

        if (!user || user.role !== "SUPER_ADMIN") {
            return NextResponse.json(errorResponse("Não autorizado"), { status: 401 });
        }

        // Get current month
        const now = new Date();
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

        // Token usage by company this month
        const tokenUsage = await prisma.tokenUsage.findMany({
            where: {
                month: { gte: startOfMonth },
            },
            include: {
                company: {
                    select: {
                        id: true,
                        name: true,
                        email: true,
                        subscription: {
                            include: { plan: true },
                        },
                    },
                },
            },
            orderBy: { inputTokens: "desc" },
        });

        // Calculate totals
        const totals = tokenUsage.reduce(
            (acc, usage) => ({
                inputTokens: acc.inputTokens + usage.inputTokens,
                outputTokens: acc.outputTokens + usage.outputTokens,
            }),
            { inputTokens: 0, outputTokens: 0 }
        );

        // Format for response
        const usageWithStats = tokenUsage.map((usage) => {
            const maxTokens = usage.company?.subscription?.plan?.maxTokensMonth || 10000;
            const totalTokens = usage.inputTokens + usage.outputTokens;
            const percentUsed = Math.round((totalTokens / maxTokens) * 100);

            return {
                id: usage.id,
                companyId: usage.companyId,
                companyName: usage.company?.name,
                companyEmail: usage.company?.email,
                plan: usage.company?.subscription?.plan?.name || "FREE",
                inputTokens: usage.inputTokens,
                outputTokens: usage.outputTokens,
                totalTokens,
                maxTokens,
                percentUsed: Math.min(percentUsed, 100),
                isOverLimit: totalTokens > maxTokens,
                month: usage.month,
            };
        });

        // Get companies approaching limit (>80%)
        const nearLimit = usageWithStats.filter((u) => u.percentUsed >= 80 && !u.isOverLimit);
        const overLimit = usageWithStats.filter((u) => u.isOverLimit);

        return NextResponse.json(successResponse({
            totals: {
                inputTokens: totals.inputTokens,
                outputTokens: totals.outputTokens,
                totalTokens: totals.inputTokens + totals.outputTokens,
            },
            alerts: {
                nearLimit: nearLimit.length,
                overLimit: overLimit.length,
            },
            usage: usageWithStats,
        }));
    } catch (error) {
        logger.error("[Admin Tokens] Error", { error, route: "/api/admin/tokens" });
        return NextResponse.json(handleApiError(error), { status: 500 });
    }
}
