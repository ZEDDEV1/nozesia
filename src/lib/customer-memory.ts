/**
 * Customer Memory Service
 * 
 * Gerencia a memória de longo prazo dos clientes.
 * Permite que a IA "lembre" de conversas anteriores.
 * 
 * Uso:
 *   const memory = await getCustomerMemory(companyId, phone);
 *   const context = formatMemoryForPrompt(memory);
 */

import { prisma } from "./prisma";
import { logger } from "./logger";
import openai from "./openai";

// ============================================
// TYPES
// ============================================

export interface CustomerMemoryData {
    id: string;
    companyId: string;
    customerPhone: string;
    summary: string;
    preferences: Record<string, unknown> | null;
    lastProducts: string[] | null;
    tags: string[];
    totalConversations: number;
    totalMessages: number;
    lastContactAt: Date;
}

// ============================================
// CORE FUNCTIONS
// ============================================

/**
 * Busca memória do cliente
 */
export async function getCustomerMemory(
    companyId: string,
    customerPhone: string
): Promise<CustomerMemoryData | null> {
    try {
        const memory = await prisma.customerMemory.findUnique({
            where: {
                companyId_customerPhone: {
                    companyId,
                    customerPhone: normalizePhone(customerPhone),
                },
            },
        });

        if (!memory) return null;

        return {
            id: memory.id,
            companyId: memory.companyId,
            customerPhone: memory.customerPhone,
            summary: memory.summary,
            preferences: memory.preferences ? safeJsonParse(memory.preferences) : null,
            lastProducts: memory.lastProducts ? safeJsonParse(memory.lastProducts) : null,
            tags: memory.tags ? memory.tags.split(",").map((t: string) => t.trim()) : [],
            totalConversations: memory.totalConversations,
            totalMessages: memory.totalMessages,
            lastContactAt: memory.lastContactAt,
        };
    } catch (error) {
        logger.error("[CustomerMemory] Error getting memory", { companyId, customerPhone, error });
        return null;
    }
}

/**
 * Cria ou atualiza memória do cliente após conversa
 */
export async function updateCustomerMemory(
    companyId: string,
    customerPhone: string,
    newConversationSummary: string,
    messageCount: number = 0,
    detectedProducts?: string[],
    detectedPreferences?: Record<string, unknown>
): Promise<void> {
    const phone = normalizePhone(customerPhone);

    try {
        const existing = await prisma.customerMemory.findUnique({
            where: { companyId_customerPhone: { companyId, customerPhone: phone } },
        });

        if (existing) {
            // Merge do resumo existente com o novo
            const mergedSummary = await mergeMemorySummaries(
                existing.summary,
                newConversationSummary
            );

            // Merge produtos
            const existingProducts: string[] = existing.lastProducts
                ? safeJsonParse(existing.lastProducts) || []
                : [];
            const mergedProducts = [...new Set([...existingProducts, ...(detectedProducts || [])])].slice(-10);

            // Merge preferências
            const existingPrefs: Record<string, unknown> = existing.preferences
                ? safeJsonParse(existing.preferences) || {}
                : {};
            const mergedPrefs = { ...existingPrefs, ...detectedPreferences };

            await prisma.customerMemory.update({
                where: { id: existing.id },
                data: {
                    summary: mergedSummary,
                    lastProducts: mergedProducts.length > 0 ? JSON.stringify(mergedProducts) : null,
                    preferences: Object.keys(mergedPrefs).length > 0 ? JSON.stringify(mergedPrefs) : null,
                    totalConversations: { increment: 1 },
                    totalMessages: { increment: messageCount },
                    lastContactAt: new Date(),
                },
            });

            logger.info("[CustomerMemory] Updated memory", { companyId, phone });
        } else {
            // Criar nova memória
            await prisma.customerMemory.create({
                data: {
                    companyId,
                    customerPhone: phone,
                    summary: newConversationSummary,
                    lastProducts: detectedProducts?.length ? JSON.stringify(detectedProducts) : null,
                    preferences: detectedPreferences ? JSON.stringify(detectedPreferences) : null,
                    totalMessages: messageCount,
                },
            });

            logger.info("[CustomerMemory] Created new memory", { companyId, phone });
        }
    } catch (error) {
        logger.error("[CustomerMemory] Error updating memory", { companyId, phone, error });
    }
}

/**
 * Gera resumo de uma conversa para memória
 */
export async function generateConversationSummary(
    messages: Array<{ role: "user" | "assistant"; content: string }>,
    customerName?: string
): Promise<string> {
    if (messages.length < 2) {
        return "Conversa curta sem contexto significativo.";
    }

    const conversationText = messages
        .map(m => `${m.role === "user" ? "Cliente" : "Atendente"}: ${m.content}`)
        .join("\n");

    try {
        const response = await openai.chat.completions.create({
            model: "gpt-4o-mini",
            messages: [
                {
                    role: "system",
                    content: `Você cria resumos MUITO concisos de conversas para memória de longo prazo.
Destaque APENAS informações importantes para atendimentos futuros:
- O que o cliente queria/precisava
- Decisões tomadas ou produtos de interesse
- Qualquer informação pessoal relevante (nome, preferências)
- Problemas ou reclamações

Responda em NO MÁXIMO 2-3 frases. Seja direto e objetivo.
${customerName ? `O nome do cliente é ${customerName}.` : ""}`,
                },
                {
                    role: "user",
                    content: `Resuma esta conversa para memória futura:\n\n${conversationText}`,
                },
            ],
            max_tokens: 150,
            temperature: 0.3,
        });

        return response.choices[0]?.message?.content || "Conversa sem resumo.";
    } catch (error) {
        logger.error("[CustomerMemory] Error generating summary", { error });
        return "Erro ao gerar resumo.";
    }
}

/**
 * Formata memória para injetar no prompt da IA
 */
export function formatMemoryForPrompt(memory: CustomerMemoryData | null): string {
    if (!memory) return "";

    const parts: string[] = [];

    parts.push(`=== HISTÓRICO COM ESTE CLIENTE (APENAS REFERÊNCIA) ===`);
    parts.push(`⚠️ IMPORTANTE: Foque na CONVERSA ATUAL. Use este histórico apenas se o cliente mencionar algo do passado.`);
    parts.push(`Conversas anteriores: ${memory.totalConversations}`);
    parts.push(`Último contato: ${formatDate(memory.lastContactAt)}`);

    // Resumo mais curto para não poluir o contexto
    if (memory.summary && memory.summary.length > 0) {
        const shortSummary = memory.summary.substring(0, 200) + (memory.summary.length > 200 ? "..." : "");
        parts.push(`\nResumo geral (não mencione a menos que relevante): ${shortSummary}`);
    }

    // Só incluir produtos se forem poucos e relevantes
    if (memory.lastProducts && memory.lastProducts.length > 0 && memory.lastProducts.length <= 3) {
        parts.push(`\nProdutos anteriores (apenas referência): ${memory.lastProducts.join(", ")}`);
    }

    parts.push(`\n⚠️ REGRA: Responda APENAS sobre o que o cliente está perguntando AGORA. NÃO mencione produtos ou assuntos de conversas passadas a menos que o cliente pergunte especificamente.`);

    return parts.join("\n");
}

// ============================================
// HELPER FUNCTIONS
// ============================================

function normalizePhone(phone: string): string {
    return phone.replace(/@.*$/, "").replace(/\D/g, "");
}

function safeJsonParse<T>(str: string): T | null {
    try {
        return JSON.parse(str) as T;
    } catch {
        return null;
    }
}

function formatDate(date: Date): string {
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));

    if (days === 0) return "hoje";
    if (days === 1) return "ontem";
    if (days < 7) return `há ${days} dias`;
    if (days < 30) return `há ${Math.floor(days / 7)} semanas`;
    return `há ${Math.floor(days / 30)} meses`;
}

/**
 * Merge dois resumos mantendo informações importantes
 */
async function mergeMemorySummaries(
    existingSummary: string,
    newSummary: string
): Promise<string> {
    try {
        const response = await openai.chat.completions.create({
            model: "gpt-4o-mini",
            messages: [
                {
                    role: "system",
                    content: `Você combina resumos de conversas em uma memória consolidada.
Mantenha apenas informações importantes e relevantes.
O resultado deve ter NO MÁXIMO 3-4 frases.
Priorize: nome do cliente, preferências, produtos de interesse, problemas recorrentes.`,
                },
                {
                    role: "user",
                    content: `Combine estes resumos em um só:

RESUMO ANTERIOR:
${existingSummary}

NOVA CONVERSA:
${newSummary}`,
                },
            ],
            max_tokens: 200,
            temperature: 0.3,
        });

        return response.choices[0]?.message?.content || newSummary;
    } catch (error) {
        logger.error("[CustomerMemory] Error merging summaries", { error });
        // Em caso de erro, concatena simples
        return `${existingSummary}\n\nAtualização: ${newSummary}`;
    }
}

// ============================================
// EXPORTS
// ============================================

export {
    normalizePhone,
};
