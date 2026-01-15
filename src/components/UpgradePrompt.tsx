"use client";

import { ArrowRight, Zap, TrendingUp } from "lucide-react";
import Link from "next/link";

interface UpgradePromptProps {
    /** What resource/limit was reached */
    resource: "tokens" | "whatsapp" | "agents" | "products" | "templates" | "campaigns" | "webhooks" | "team";
    /** Current usage */
    current?: number;
    /** Maximum allowed */
    max?: number;
    /** Optional custom message */
    message?: string;
    /** Show compact version */
    compact?: boolean;
    /** Show add extra option */
    showExtras?: boolean;
    /** Extra price if applicable */
    extraPrice?: number;
}

const resourceMessages: Record<string, { title: string; description: string; icon: React.ReactNode }> = {
    tokens: {
        title: "Limite de Tokens Atingido",
        description: "Você usou todos os tokens do mês. Faça upgrade para continuar atendendo seus clientes!",
        icon: <Zap className="w-6 h-6" />,
    },
    whatsapp: {
        title: "Limite de WhatsApp Atingido",
        description: "Você atingiu o máximo de números WhatsApp. Adicione mais ou faça upgrade!",
        icon: <TrendingUp className="w-6 h-6" />,
    },
    agents: {
        title: "Limite de Agentes Atingido",
        description: "Você atingiu o máximo de agentes IA. Adicione mais ou faça upgrade!",
        icon: <TrendingUp className="w-6 h-6" />,
    },
    products: {
        title: "Limite de Produtos Atingido",
        description: "Você atingiu o máximo de produtos cadastrados.",
        icon: <TrendingUp className="w-6 h-6" />,
    },
    templates: {
        title: "Limite de Templates Atingido",
        description: "Você atingiu o máximo de templates de mensagem.",
        icon: <TrendingUp className="w-6 h-6" />,
    },
    campaigns: {
        title: "Limite de Campanhas do Mês",
        description: "Você atingiu o máximo de campanhas para este mês.",
        icon: <TrendingUp className="w-6 h-6" />,
    },
    webhooks: {
        title: "Limite de Webhooks Atingido",
        description: "Você atingiu o máximo de webhooks configurados.",
        icon: <TrendingUp className="w-6 h-6" />,
    },
    team: {
        title: "Limite de Equipe Atingido",
        description: "Você atingiu o máximo de membros da equipe.",
        icon: <TrendingUp className="w-6 h-6" />,
    },
};

/**
 * Upgrade prompt component shown when user hits a limit
 */
export function UpgradePrompt({
    resource,
    current,
    max,
    message,
    compact = false,
    showExtras = false,
    extraPrice = 29.99,
}: UpgradePromptProps) {
    const resourceInfo = resourceMessages[resource] || resourceMessages.tokens;

    if (compact) {
        return (
            <div className="flex items-center justify-between p-3 bg-amber-500/10 border border-amber-500/30 rounded-lg">
                <div className="flex items-center gap-2">
                    <span className="text-amber-500">{resourceInfo.icon}</span>
                    <span className="text-sm text-amber-200">
                        {message || resourceInfo.title}
                    </span>
                </div>
                <Link
                    href="/dashboard/billing"
                    className="text-sm text-amber-400 hover:text-amber-300 font-medium flex items-center gap-1"
                >
                    Upgrade <ArrowRight className="w-3 h-3" />
                </Link>
            </div>
        );
    }

    return (
        <div className="p-6 bg-gradient-to-br from-purple-500/10 to-blue-500/10 border border-purple-500/30 rounded-xl">
            <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-full bg-purple-500/20 flex items-center justify-center text-purple-400">
                    {resourceInfo.icon}
                </div>
                <div className="flex-1">
                    <h3 className="text-lg font-semibold text-white mb-1">
                        {resourceInfo.title}
                    </h3>
                    <p className="text-gray-400 text-sm mb-4">
                        {message || resourceInfo.description}
                    </p>

                    {current !== undefined && max !== undefined && max > 0 && (
                        <div className="mb-4">
                            <div className="flex justify-between text-xs text-gray-400 mb-1">
                                <span>Uso atual</span>
                                <span>{current.toLocaleString()} / {max.toLocaleString()}</span>
                            </div>
                            <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
                                <div
                                    className="h-full bg-gradient-to-r from-red-500 to-amber-500"
                                    style={{ width: `${Math.min(100, (current / max) * 100)}%` }}
                                />
                            </div>
                        </div>
                    )}

                    <div className="flex flex-wrap gap-3">
                        <Link
                            href="/dashboard/billing"
                            className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-purple-500 to-blue-500 text-white rounded-lg font-medium hover:opacity-90 transition-opacity"
                        >
                            <TrendingUp className="w-4 h-4" />
                            Ver Planos
                        </Link>

                        {showExtras && (resource === "whatsapp" || resource === "agents") && (
                            <Link
                                href={`/dashboard/billing?addExtra=${resource}`}
                                className="inline-flex items-center gap-2 px-4 py-2 border border-purple-500/50 text-purple-400 rounded-lg font-medium hover:bg-purple-500/10 transition-colors"
                            >
                                + Adicionar por R${extraPrice.toFixed(2)}/mês
                            </Link>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}

/**
 * Token usage warning banner
 */
interface TokenWarningProps {
    percentUsed: number;
    current: number;
    max: number;
}

export function TokenWarning({ percentUsed, current, max }: TokenWarningProps) {
    if (percentUsed < 80) return null;

    const isAtLimit = percentUsed >= 100;
    const bgColor = isAtLimit
        ? "bg-red-500/10 border-red-500/30"
        : "bg-amber-500/10 border-amber-500/30";
    const textColor = isAtLimit ? "text-red-400" : "text-amber-400";

    return (
        <div className={`p-3 ${bgColor} border rounded-lg flex items-center justify-between`}>
            <div className="flex items-center gap-2">
                <Zap className={`w-4 h-4 ${textColor}`} />
                <span className={`text-sm ${textColor}`}>
                    {isAtLimit
                        ? "⚠️ Limite de tokens atingido!"
                        : `⚠️ ${percentUsed.toFixed(0)}% dos tokens usados`
                    }
                </span>
            </div>
            <span className="text-xs text-gray-400">
                {current.toLocaleString()}/{max.toLocaleString()}
            </span>
        </div>
    );
}
