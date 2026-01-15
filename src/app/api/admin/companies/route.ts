import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { successResponse, handleApiError } from "@/lib/api-response";

// GET - List all companies (SUPER_ADMIN only)
export async function GET() {
    try {
        await requireRole(["SUPER_ADMIN"]);

        // Get all companies with aggregated data
        const companies = await prisma.company.findMany({
            include: {
                _count: {
                    select: {
                        users: true,
                        agents: true,
                        sessions: true,
                        conversations: true,
                    },
                },
                subscription: {
                    include: {
                        plan: true,
                    },
                },
            },
            orderBy: { createdAt: "desc" },
        });

        // Transform data for frontend
        const formattedCompanies = companies.map((company) => {
            // Check subscription expiration first, then fall back to trial
            const hasSubscription = company.subscription?.plan;
            const subscriptionExpiresAt = company.subscription?.currentPeriodEnd;
            const trialExpiresAt = company.trialEndsAt;

            // Use subscription date if available, otherwise trial date
            const expiresAt = hasSubscription ? subscriptionExpiresAt : trialExpiresAt;
            const daysRemaining = expiresAt
                ? Math.ceil((new Date(expiresAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
                : null;

            // Determine plan info - if no subscription but has trial, show "Free Trial"
            let planType = "NONE";
            let planName = "Sem plano";
            let subscriptionStatus = "NONE";

            if (hasSubscription) {
                planType = company.subscription!.plan!.type;
                planName = company.subscription!.plan!.name;
                subscriptionStatus = company.subscription!.status;
            } else if (trialExpiresAt) {
                planType = "FREE";
                planName = "Free Trial";
                // If trial is still valid, show as TRIAL status
                if (daysRemaining !== null && daysRemaining > 0) {
                    subscriptionStatus = "TRIAL";
                } else {
                    subscriptionStatus = "EXPIRED";
                }
            }

            return {
                id: company.id,
                name: company.name,
                email: company.email,
                phone: company.phone,
                status: company.status,
                plan: planType,
                planName: planName,
                subscriptionStatus: subscriptionStatus,
                expiresAt: expiresAt?.toISOString() || null,
                daysRemaining,
                agentsCount: company._count.agents,
                sessionsCount: company._count.sessions,
                usersCount: company._count.users,
                messagesCount: company._count.conversations,
                createdAt: company.createdAt.toISOString(),
            };
        });

        // Calculate stats
        const stats = {
            total: companies.length,
            active: companies.filter((c) => c.status === "ACTIVE").length,
            pending: companies.filter((c) => c.status === "PENDING").length,
            suspended: companies.filter((c) => c.status === "SUSPENDED").length,
        };

        return NextResponse.json(
            successResponse({
                companies: formattedCompanies,
                stats,
            })
        );
    } catch (error) {
        return NextResponse.json(handleApiError(error), { status: 500 });
    }
}
