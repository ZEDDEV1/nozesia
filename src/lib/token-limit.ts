/**
 * Token Limit Manager
 * 
 * Gerencia limites de tokens por empresa baseado no plano.
 * Verifica trial e subscription antes de permitir uso.
 */

import { prisma } from "./prisma";
import { logger } from "./logger";

// Cache em memória do uso atual
const usageCache = new Map<string, { tokens: number; timestamp: number }>();
const CACHE_TTL = 60 * 1000; // 1 minuto

// Default trial token limit
const TRIAL_TOKEN_LIMIT = 75000; // 75K for trial

export interface TokenUsageStatus {
    companyId: string;
    currentUsage: number;
    monthlyLimit: number;
    percentUsed: number;
    isLimitReached: boolean;
    remainingTokens: number;
    upgradeRequired: boolean;
    upgradeMessage?: string;
}

/**
 * Verifica se a empresa atingiu o limite de tokens
 * Agora lê corretamente do plano ou usa limite de trial
 */
export async function checkTokenLimit(companyId: string): Promise<TokenUsageStatus> {
    try {
        // Buscar empresa com plano e status de trial
        const company = await prisma.company.findUnique({
            where: { id: companyId },
            select: {
                id: true,
                trialEndsAt: true,
                monthlyTokenLimit: true, // Override manual
                subscription: {
                    include: { plan: true }
                }
            },
        });

        if (!company) {
            throw new Error("Company not found");
        }

        // Check subscription status
        const hasActiveSubscription =
            company.subscription?.status === "ACTIVE" &&
            (!company.subscription.currentPeriodEnd ||
                new Date(company.subscription.currentPeriodEnd) > new Date());

        // Check trial status
        const now = new Date();
        const isTrialActive = !hasActiveSubscription &&
            company.trialEndsAt &&
            new Date(company.trialEndsAt) > now;

        // If no access, block immediately
        if (!hasActiveSubscription && !isTrialActive) {
            return {
                companyId,
                currentUsage: 0,
                monthlyLimit: 0,
                percentUsed: 100,
                isLimitReached: true,
                remainingTokens: 0,
                upgradeRequired: true,
                upgradeMessage: "⏰ Seu período de teste expirou. Assine um plano para continuar atendendo!",
            };
        }

        // Determine the limit
        // Priority: manual override > plan limit > trial plan from db > default trial
        let monthlyLimit: number;

        if (company.monthlyTokenLimit && company.monthlyTokenLimit > 0) {
            // Admin set a manual limit
            monthlyLimit = company.monthlyTokenLimit;
        } else if (hasActiveSubscription && company.subscription?.plan) {
            // Use plan limit
            const planLimit = company.subscription.plan.maxTokensMonth;
            monthlyLimit = planLimit === -1 ? Infinity : planLimit;
        } else {
            // Trial: try to get from TRIAL plan in database, fallback to default
            const trialPlan = await prisma.plan.findFirst({
                where: { type: "TRIAL" },
                select: { maxTokensMonth: true }
            });
            monthlyLimit = trialPlan?.maxTokensMonth || TRIAL_TOKEN_LIMIT;
        }

        // Get current usage
        const currentUsage = await getCurrentMonthUsage(companyId);

        // Calculate status
        const isUnlimited = monthlyLimit === Infinity || monthlyLimit === -1;
        const percentUsed = isUnlimited ? 0 : (currentUsage / monthlyLimit) * 100;
        const isLimitReached = !isUnlimited && currentUsage >= monthlyLimit;
        const remainingTokens = isUnlimited ? Infinity : Math.max(0, monthlyLimit - currentUsage);

        // Generate upgrade message if at limit
        let upgradeMessage: string | undefined;
        if (isLimitReached) {
            upgradeMessage = "🔋 Você atingiu seu limite de tokens deste mês. Faça upgrade do seu plano para continuar!";
        } else if (percentUsed >= 80) {
            upgradeMessage = `⚠️ Atenção: ${percentUsed.toFixed(0)}% do limite de tokens usado.`;
        }

        return {
            companyId,
            currentUsage,
            monthlyLimit: isUnlimited ? -1 : monthlyLimit,
            percentUsed: Math.round(percentUsed * 100) / 100,
            isLimitReached,
            remainingTokens: isUnlimited ? -1 : remainingTokens,
            upgradeRequired: isLimitReached,
            upgradeMessage,
        };
    } catch (error) {
        logger.error("Error checking token limit", {
            companyId,
            error: error instanceof Error ? error.message : "Unknown"
        });

        // Em caso de erro, bloquear por segurança (fail-closed for billing)
        return {
            companyId,
            currentUsage: 0,
            monthlyLimit: 0,
            percentUsed: 100,
            isLimitReached: true,
            remainingTokens: 0,
            upgradeRequired: true,
            upgradeMessage: "Erro ao verificar limite. Entre em contato com o suporte.",
        };
    }
}

/**
 * Obtém o uso de tokens do mês atual
 */
async function getCurrentMonthUsage(companyId: string): Promise<number> {
    // Verificar cache
    const cached = usageCache.get(companyId);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
        return cached.tokens;
    }

    // Buscar do banco
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    const usage = await prisma.tokenUsage.findFirst({
        where: {
            companyId,
            month: monthStart,
        },
        select: {
            inputTokens: true,
            outputTokens: true,
        },
    });

    const totalTokens = (usage?.inputTokens || 0) + (usage?.outputTokens || 0);

    // Salvar no cache
    usageCache.set(companyId, { tokens: totalTokens, timestamp: Date.now() });

    return totalTokens;
}

/**
 * Invalida o cache de uso (chamar após registrar uso)
 */
export function invalidateUsageCache(companyId: string): void {
    usageCache.delete(companyId);
}

/**
 * Registra uso de tokens e verifica limite
 */
export async function registerTokenUsage(
    companyId: string,
    inputTokens: number,
    outputTokens: number
): Promise<{ registered: boolean; limitReached: boolean; warning?: string }> {
    try {
        const now = new Date();
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

        // Upsert para registrar uso
        await prisma.tokenUsage.upsert({
            where: {
                companyId_month: {
                    companyId,
                    month: monthStart,
                },
            },
            update: {
                inputTokens: { increment: inputTokens },
                outputTokens: { increment: outputTokens },
            },
            create: {
                companyId,
                month: monthStart,
                inputTokens,
                outputTokens,
            },
        });

        // Invalidar cache
        invalidateUsageCache(companyId);

        // Verificar limite
        const status = await checkTokenLimit(companyId);

        // Gerar warning se necessário
        let warning: string | undefined;
        if (status.percentUsed >= 90) {
            warning = `Atenção: ${status.percentUsed.toFixed(1)}% do limite de tokens usado`;
        }

        logger.debug("Token usage registered", {
            companyId,
            tokens: inputTokens + outputTokens,
            totalUsage: status.currentUsage,
            percentUsed: status.percentUsed,
        });

        return {
            registered: true,
            limitReached: status.isLimitReached,
            warning,
        };
    } catch (error) {
        logger.error("Error registering token usage", {
            companyId,
            error: error instanceof Error ? error.message : "Unknown",
        });

        return {
            registered: false,
            limitReached: false,
        };
    }
}

/**
 * Obtém uso de todas as empresas (para admin)
 */
export async function getAllCompaniesUsage(): Promise<TokenUsageStatus[]> {
    try {
        const now = new Date();
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

        const companies = await prisma.company.findMany({
            select: {
                id: true,
                name: true,
                monthlyTokenLimit: true,
                tokenUsage: {
                    where: { month: monthStart },
                    select: {
                        inputTokens: true,
                        outputTokens: true,
                    },
                },
            },
        });

        return companies.map(company => {
            const usage = company.tokenUsage[0];
            const currentUsage = (usage?.inputTokens || 0) + (usage?.outputTokens || 0);
            const monthlyLimit = company.monthlyTokenLimit || 0;
            const percentUsed = monthlyLimit > 0 ? (currentUsage / monthlyLimit) * 100 : 0;
            const isLimitReached = monthlyLimit > 0 && currentUsage >= monthlyLimit;

            return {
                companyId: company.id,
                currentUsage,
                monthlyLimit,
                percentUsed: Math.round(percentUsed * 100) / 100,
                isLimitReached,
                remainingTokens: monthlyLimit > 0 ? Math.max(0, monthlyLimit - currentUsage) : Infinity,
                upgradeRequired: isLimitReached,
                upgradeMessage: isLimitReached ? "Limite atingido" : undefined,
            };
        });
    } catch (error) {
        logger.error("Error getting all companies usage", {
            error: error instanceof Error ? error.message : "Unknown",
        });
        return [];
    }
}

/**
 * Atualiza limite de tokens de uma empresa (admin)
 */
export async function updateCompanyTokenLimit(
    companyId: string,
    newLimit: number
): Promise<boolean> {
    try {
        await prisma.company.update({
            where: { id: companyId },
            data: { monthlyTokenLimit: newLimit },
        });

        logger.info("Company token limit updated", { companyId, newLimit });
        return true;
    } catch (error) {
        logger.error("Error updating token limit", {
            companyId,
            error: error instanceof Error ? error.message : "Unknown",
        });
        return false;
    }
}

/**
 * Mensagem para quando limite é atingido
 */
export function getLimitReachedMessage(): string {
    return "Desculpe, não posso responder no momento. Por favor, entre em contato pelo telefone ou aguarde o próximo período. 📱";
}
