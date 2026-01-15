/**
 * Plan Features Manager
 * 
 * Centralized feature access control based on subscription plan.
 * Handles limit checking and feature flag validation.
 */

import { prisma } from "./prisma";
import { logger } from "./logger";

// Default trial limits
export const TRIAL_LIMITS = {
    maxTokensMonth: 75000, // 75K for trial
    maxWhatsAppNumbers: 1,
    maxAgents: 1,
    maxProducts: 50,
    maxTemplates: 3,
    maxCampaignsMonth: 0,
    maxWebhooks: 0,
    maxDeliveryZones: 3,
    maxTeamMembers: 1,
    maxCreativesMonth: 0,
};

// Feature keys that can be checked
export type FeatureKey =
    | "audio"
    | "voice"
    | "humanTransfer"
    | "apiAccess"
    | "whiteLabel"
    | "analytics"
    | "calendar"
    | "crm"
    | "deals"
    | "campaigns"
    | "autoRecovery"
    | "webhooks"
    | "creatives";

// Limit keys that can be checked
export type LimitKey =
    | "tokens"
    | "whatsapp"
    | "agents"
    | "products"
    | "templates"
    | "campaigns"
    | "webhooks"
    | "deliveryZones"
    | "teamMembers"
    | "creatives";

export interface PlanLimits {
    maxTokensMonth: number;
    maxWhatsAppNumbers: number;
    maxAgents: number;
    maxProducts: number;
    maxTemplates: number;
    maxCampaignsMonth: number;
    maxWebhooks: number;
    maxDeliveryZones: number;
    maxTeamMembers: number;
    maxCreativesMonth: number;
    // Extras
    extraAgents: number;
    extraWhatsApps: number;
}

export interface PlanFeatures {
    allowAudio: boolean;
    allowVoice: boolean;
    allowHumanTransfer: boolean;
    allowApiAccess: boolean;
    allowWhiteLabel: boolean;
    allowAnalytics: boolean;
    allowCalendar: boolean;
    allowCRM: boolean;
    allowDeals: boolean;
    allowCampaigns: boolean;
    allowAutoRecovery: boolean;
}

export interface CompanyPlanInfo {
    planId: string | null;
    planName: string;
    planType: string;
    hasPaid: boolean;
    isTrialActive: boolean;
    trialDaysRemaining: number;
    limits: PlanLimits;
    features: PlanFeatures;
    extraAgentPrice: number;
    extraWhatsAppPrice: number;
}

/**
 * Get complete plan info for a company
 */
export async function getCompanyPlanInfo(companyId: string): Promise<CompanyPlanInfo> {
    const company = await prisma.company.findUnique({
        where: { id: companyId },
        select: {
            trialEndsAt: true,
            extraAgents: true,
            extraWhatsApps: true,
            subscription: {
                include: { plan: true }
            }
        }
    });

    if (!company) {
        throw new Error("Company not found");
    }

    const hasSubscription = !!company.subscription?.status && company.subscription.status === "ACTIVE";
    const plan = company.subscription?.plan;

    // Check trial status
    const now = new Date();
    const isTrialActive = !hasSubscription && company.trialEndsAt && new Date(company.trialEndsAt) > now;
    const trialDaysRemaining = isTrialActive && company.trialEndsAt
        ? Math.ceil((new Date(company.trialEndsAt).getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
        : 0;

    // Use plan limits or trial defaults
    const limits: PlanLimits = {
        maxTokensMonth: plan?.maxTokensMonth ?? TRIAL_LIMITS.maxTokensMonth,
        maxWhatsAppNumbers: (plan?.maxWhatsAppNumbers ?? TRIAL_LIMITS.maxWhatsAppNumbers) + (company.extraWhatsApps ?? 0),
        maxAgents: (plan?.maxAgents ?? TRIAL_LIMITS.maxAgents) + (company.extraAgents ?? 0),
        maxProducts: plan?.maxProducts ?? TRIAL_LIMITS.maxProducts,
        maxTemplates: plan?.maxTemplates ?? TRIAL_LIMITS.maxTemplates,
        maxCampaignsMonth: plan?.maxCampaignsMonth ?? TRIAL_LIMITS.maxCampaignsMonth,
        maxWebhooks: plan?.maxWebhooks ?? TRIAL_LIMITS.maxWebhooks,
        maxDeliveryZones: plan?.maxDeliveryZones ?? TRIAL_LIMITS.maxDeliveryZones,
        maxTeamMembers: plan?.maxTeamMembers ?? TRIAL_LIMITS.maxTeamMembers,
        maxCreativesMonth: plan?.maxCreativesMonth ?? TRIAL_LIMITS.maxCreativesMonth,
        extraAgents: company.extraAgents ?? 0,
        extraWhatsApps: company.extraWhatsApps ?? 0,
    };

    // Use plan features or trial defaults (mostly false)
    const features: PlanFeatures = {
        allowAudio: plan?.allowAudio ?? false,
        allowVoice: plan?.allowVoice ?? false,
        allowHumanTransfer: plan?.allowHumanTransfer ?? false,
        allowApiAccess: plan?.allowApiAccess ?? false,
        allowWhiteLabel: plan?.allowWhiteLabel ?? false,
        allowAnalytics: plan?.allowAnalytics ?? false,
        allowCalendar: plan?.allowCalendar ?? false,
        allowCRM: plan?.allowCRM ?? false,
        allowDeals: plan?.allowDeals ?? false,
        allowCampaigns: plan?.allowCampaigns ?? false,
        allowAutoRecovery: plan?.allowAutoRecovery ?? false,
    };

    return {
        planId: plan?.id ?? null,
        planName: plan?.name ?? "Trial",
        planType: plan?.type ?? "TRIAL",
        hasPaid: hasSubscription,
        isTrialActive: !!isTrialActive,
        trialDaysRemaining,
        limits,
        features,
        extraAgentPrice: plan?.extraAgentPrice ?? 29.99,
        extraWhatsAppPrice: plan?.extraWhatsAppPrice ?? 29.99,
    };
}

/**
 * Check if a feature is allowed for the company's plan
 */
export async function canUseFeature(companyId: string, feature: FeatureKey): Promise<boolean> {
    try {
        const planInfo = await getCompanyPlanInfo(companyId);

        // No access if no plan and trial expired
        if (!planInfo.hasPaid && !planInfo.isTrialActive) {
            return false;
        }

        const featureMap: Record<FeatureKey, boolean> = {
            audio: planInfo.features.allowAudio,
            voice: planInfo.features.allowVoice,
            humanTransfer: planInfo.features.allowHumanTransfer,
            apiAccess: planInfo.features.allowApiAccess,
            whiteLabel: planInfo.features.allowWhiteLabel,
            analytics: planInfo.features.allowAnalytics,
            calendar: planInfo.features.allowCalendar,
            crm: planInfo.features.allowCRM,
            deals: planInfo.features.allowDeals,
            campaigns: planInfo.features.allowCampaigns,
            autoRecovery: planInfo.features.allowAutoRecovery,
            webhooks: planInfo.limits.maxWebhooks !== 0,
            creatives: planInfo.limits.maxCreativesMonth !== 0,
        };

        return featureMap[feature] ?? false;
    } catch (error) {
        logger.error("Error checking feature access", { companyId, feature, error });
        return false;
    }
}

/**
 * Check if the company has access (trial or subscription)
 */
export async function hasAccess(companyId: string): Promise<{
    hasAccess: boolean;
    reason: string;
    upgradeRequired: boolean;
}> {
    try {
        const planInfo = await getCompanyPlanInfo(companyId);

        if (planInfo.hasPaid) {
            return { hasAccess: true, reason: "subscription_active", upgradeRequired: false };
        }

        if (planInfo.isTrialActive) {
            return { hasAccess: true, reason: "trial_active", upgradeRequired: false };
        }

        return { hasAccess: false, reason: "trial_expired", upgradeRequired: true };
    } catch (error) {
        logger.error("Error checking access", { companyId, error });
        return { hasAccess: false, reason: "error", upgradeRequired: true };
    }
}

/**
 * Get limit status for a specific resource
 */
export async function getLimitStatus(
    companyId: string,
    limitKey: LimitKey
): Promise<{
    current: number;
    max: number;
    remaining: number;
    isUnlimited: boolean;
    isAtLimit: boolean;
    percentUsed: number;
}> {
    const planInfo = await getCompanyPlanInfo(companyId);

    // Get current usage based on limit type
    let current = 0;
    let max = 0;

    switch (limitKey) {
        case "tokens":
            const tokenUsage = await getCurrentTokenUsage(companyId);
            current = tokenUsage;
            max = planInfo.limits.maxTokensMonth;
            break;
        case "whatsapp":
            current = await prisma.whatsAppSession.count({ where: { companyId } });
            max = planInfo.limits.maxWhatsAppNumbers;
            break;
        case "agents":
            current = await prisma.aIAgent.count({ where: { companyId } });
            max = planInfo.limits.maxAgents;
            break;
        case "products":
            current = await prisma.product.count({ where: { companyId } });
            max = planInfo.limits.maxProducts;
            break;
        case "templates":
            current = await prisma.messageTemplate.count({ where: { companyId } });
            max = planInfo.limits.maxTemplates;
            break;
        case "campaigns":
            const monthStart = new Date();
            monthStart.setDate(1);
            monthStart.setHours(0, 0, 0, 0);
            current = await prisma.campaign.count({
                where: { companyId, createdAt: { gte: monthStart } }
            });
            max = planInfo.limits.maxCampaignsMonth;
            break;
        case "webhooks":
            current = await prisma.webhook.count({ where: { companyId } });
            max = planInfo.limits.maxWebhooks;
            break;
        case "deliveryZones":
            current = await prisma.deliveryZone.count({ where: { companyId } });
            max = planInfo.limits.maxDeliveryZones;
            break;
        case "teamMembers":
            current = await prisma.user.count({ where: { companyId } });
            max = planInfo.limits.maxTeamMembers;
            break;
        // case "creatives": handled separately as it requires tracking
    }

    const isUnlimited = max === -1;
    const isAtLimit = !isUnlimited && current >= max;
    const remaining = isUnlimited ? Infinity : Math.max(0, max - current);
    const percentUsed = isUnlimited ? 0 : max > 0 ? Math.round((current / max) * 100) : 0;

    return { current, max, remaining, isUnlimited, isAtLimit, percentUsed };
}

/**
 * Get current token usage for the month
 */
async function getCurrentTokenUsage(companyId: string): Promise<number> {
    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);

    const usage = await prisma.tokenUsage.findFirst({
        where: { companyId, month: monthStart },
        select: { inputTokens: true, outputTokens: true }
    });

    return (usage?.inputTokens ?? 0) + (usage?.outputTokens ?? 0);
}

/**
 * Get upgrade suggestion message based on what limit was hit
 */
export function getUpgradeMessage(limitKey: LimitKey): string {
    const messages: Record<LimitKey, string> = {
        tokens: "🔋 Você atingiu seu limite de tokens deste mês. Faça upgrade para continuar atendendo seus clientes!",
        whatsapp: "📱 Você atingiu o limite de WhatsApps. Adicione mais por R$29,99/mês ou faça upgrade de plano!",
        agents: "🤖 Limite de agentes atingido. Adicione mais por R$29,99/mês ou faça upgrade!",
        products: "📦 Limite de produtos atingido. Faça upgrade para cadastrar mais!",
        templates: "📝 Limite de templates atingido. Faça upgrade para criar mais!",
        campaigns: "📣 Limite de campanhas do mês atingido. Faça upgrade para enviar mais!",
        webhooks: "🔗 Limite de webhooks atingido. Faça upgrade para integrar mais sistemas!",
        deliveryZones: "🚚 Limite de taxas de entrega atingido. Faça upgrade para mais bairros!",
        teamMembers: "👥 Limite de membros da equipe atingido. Faça upgrade para mais usuários!",
        creatives: "🎨 Limite de criativos do mês atingido. Faça upgrade para gerar mais imagens!",
    };

    return messages[limitKey];
}

/**
 * Get all features status for dashboard display
 */
export async function getAllFeaturesStatus(companyId: string): Promise<{
    feature: FeatureKey;
    name: string;
    allowed: boolean;
    requiredPlan: string;
}[]> {
    const planInfo = await getCompanyPlanInfo(companyId);

    const featureList: { feature: FeatureKey; name: string; requiredPlan: string }[] = [
        // BASIC features
        { feature: "analytics", name: "Analytics", requiredPlan: "Basic" },
        { feature: "calendar", name: "Calendário", requiredPlan: "Basic" },
        // PRO features
        { feature: "crm", name: "CRM / Clientes", requiredPlan: "Pro" },
        { feature: "deals", name: "Pipeline de Vendas", requiredPlan: "Pro" },
        { feature: "campaigns", name: "Campanhas", requiredPlan: "Pro" },
        { feature: "autoRecovery", name: "Recuperação Automática", requiredPlan: "Pro" },
        { feature: "audio", name: "Transcrição de Áudio", requiredPlan: "Pro" },
        { feature: "humanTransfer", name: "Transferir para Humano", requiredPlan: "Pro" },
        // ENTERPRISE features (Premium)
        { feature: "webhooks", name: "Webhooks", requiredPlan: "Enterprise" },
        { feature: "creatives", name: "Criativos IA", requiredPlan: "Enterprise" },
        { feature: "voice", name: "Voz TTS", requiredPlan: "Enterprise" },
        { feature: "apiAccess", name: "API Access", requiredPlan: "Enterprise" },
        { feature: "whiteLabel", name: "White Label", requiredPlan: "Enterprise" },
    ];

    return featureList.map(f => ({
        ...f,
        allowed: canUseFeatureSync(planInfo, f.feature),
    }));
}

/**
 * Sync version of canUseFeature (uses pre-fetched plan info)
 */
function canUseFeatureSync(planInfo: CompanyPlanInfo, feature: FeatureKey): boolean {
    if (!planInfo.hasPaid && !planInfo.isTrialActive) return false;

    const featureMap: Record<FeatureKey, boolean> = {
        audio: planInfo.features.allowAudio,
        voice: planInfo.features.allowVoice,
        humanTransfer: planInfo.features.allowHumanTransfer,
        apiAccess: planInfo.features.allowApiAccess,
        whiteLabel: planInfo.features.allowWhiteLabel,
        analytics: planInfo.features.allowAnalytics,
        calendar: planInfo.features.allowCalendar,
        crm: planInfo.features.allowCRM,
        deals: planInfo.features.allowDeals,
        campaigns: planInfo.features.allowCampaigns,
        autoRecovery: planInfo.features.allowAutoRecovery,
        webhooks: planInfo.limits.maxWebhooks !== 0,
        creatives: planInfo.limits.maxCreativesMonth !== 0,
    };

    return featureMap[feature] ?? false;
}
