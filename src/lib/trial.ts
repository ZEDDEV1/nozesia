/**
 * Trial Period Management
 * 
 * Handles trial period validation and access control for companies.
 */

import { prisma } from "./prisma";
import { logger } from "./logger";

// Default trial duration in days
export const DEFAULT_TRIAL_DAYS = 7;

/**
 * Trial status for a company
 */
export type TrialStatus =
    | { status: "no_trial"; hasSubscription: boolean }
    | { status: "active"; daysRemaining: number; endsAt: Date }
    | { status: "expired"; expiredAt: Date; daysExpired: number }
    | { status: "converted"; subscriptionActive: boolean };

/**
 * Check trial status for a company
 */
export async function getTrialStatus(companyId: string): Promise<TrialStatus> {
    const company = await prisma.company.findUnique({
        where: { id: companyId },
        select: {
            trialEndsAt: true,
            trialUsed: true,
            subscription: {
                select: {
                    status: true,
                    currentPeriodEnd: true,
                },
            },
        },
    });

    if (!company) {
        return { status: "no_trial", hasSubscription: false };
    }

    const hasActiveSubscription = company.subscription?.status === "ACTIVE" &&
        (!company.subscription.currentPeriodEnd || company.subscription.currentPeriodEnd > new Date());

    // If has active subscription, trial doesn't matter
    if (hasActiveSubscription) {
        return { status: "converted", subscriptionActive: true };
    }

    // No trial set
    if (!company.trialEndsAt) {
        return { status: "no_trial", hasSubscription: false };
    }

    const now = new Date();
    const trialEndsAt = new Date(company.trialEndsAt);

    // Trial still active
    if (trialEndsAt > now) {
        const daysRemaining = Math.ceil((trialEndsAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
        return { status: "active", daysRemaining, endsAt: trialEndsAt };
    }

    // Trial expired
    const daysExpired = Math.ceil((now.getTime() - trialEndsAt.getTime()) / (1000 * 60 * 60 * 24));
    return { status: "expired", expiredAt: trialEndsAt, daysExpired };
}

/**
 * Check if company has access (either active trial or subscription)
 */
export async function hasAccess(companyId: string): Promise<boolean> {
    const status = await getTrialStatus(companyId);
    return status.status === "active" || status.status === "converted";
}

/**
 * Start trial for a company
 */
export async function startTrial(companyId: string, days: number = DEFAULT_TRIAL_DAYS): Promise<Date> {
    const trialEndsAt = new Date();
    trialEndsAt.setDate(trialEndsAt.getDate() + days);

    await prisma.company.update({
        where: { id: companyId },
        data: {
            trialEndsAt,
            trialUsed: true,
        },
    });

    logger.info("[Trial] Started trial", { companyId, endsAt: trialEndsAt, days });
    return trialEndsAt;
}

/**
 * Check if company can start trial (hasn't used it before)
 */
export async function canStartTrial(companyId: string): Promise<boolean> {
    const company = await prisma.company.findUnique({
        where: { id: companyId },
        select: { trialUsed: true },
    });

    return company ? !company.trialUsed : false;
}

/**
 * Extend trial for a company (admin action)
 */
export async function extendTrial(companyId: string, additionalDays: number): Promise<Date> {
    const company = await prisma.company.findUnique({
        where: { id: companyId },
        select: { trialEndsAt: true },
    });

    const currentEndDate = company?.trialEndsAt && new Date(company.trialEndsAt) > new Date()
        ? new Date(company.trialEndsAt)
        : new Date();

    const newEndDate = new Date(currentEndDate);
    newEndDate.setDate(newEndDate.getDate() + additionalDays);

    await prisma.company.update({
        where: { id: companyId },
        data: { trialEndsAt: newEndDate },
    });

    logger.info("[Trial] Extended trial", { companyId, newEndsAt: newEndDate, additionalDays });
    return newEndDate;
}

/**
 * Get formatted trial status message
 */
export function formatTrialStatusMessage(status: TrialStatus): string {
    switch (status.status) {
        case "active":
            if (status.daysRemaining <= 3) {
                return `⚠️ Seu período de teste expira em ${status.daysRemaining} dia${status.daysRemaining === 1 ? "" : "s"}`;
            }
            return `✨ ${status.daysRemaining} dias restantes no período de teste`;

        case "expired":
            return "❌ Período de teste expirado. Assine um plano para continuar.";

        case "converted":
            return "✅ Assinatura ativa";

        case "no_trial":
            return status.hasSubscription ? "ℹ️ Sem assinatura ativa" : "ℹ️ Inicie seu período de teste gratuito";
    }
}
