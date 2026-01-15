/**
 * CRM Automation - Pipeline automático
 * 
 * Cria/atualiza deals automaticamente quando:
 * - Cliente demonstra interesse em produto
 * - Cliente faz um pedido
 */

import { prisma } from "@/lib/prisma";
import { DealStage } from "@prisma/client";

interface CreateDealParams {
    companyId: string;
    customerPhone: string;
    customerName?: string | null;
    title: string;
    value?: number;
    stage?: DealStage;
    source: "INTEREST" | "ORDER" | "CONVERSATION";
}

/**
 * Cria ou atualiza deal no pipeline automaticamente
 */
export async function autoCreateOrUpdateDeal(params: CreateDealParams) {
    try {
        const { companyId, customerPhone, customerName, title, value, stage, source } = params;

        // Limpar telefone
        const cleanPhone = customerPhone.replace(/\D/g, "");

        // Verificar se já existe deal ativo para este cliente
        const existingDeal = await prisma.deal.findFirst({
            where: {
                companyId,
                customerPhone: cleanPhone,
                stage: { notIn: ["CLOSED_WON", "CLOSED_LOST"] },
            },
            orderBy: { createdAt: "desc" },
        });

        if (existingDeal) {
            // Atualizar deal existente
            const updates: { value?: number; stage?: DealStage; notes?: string; closedAt?: Date | null } = {};

            // Se veio de ORDER, mover para CLOSED_WON
            if (source === "ORDER") {
                updates.stage = "CLOSED_WON";
                updates.closedAt = new Date();
            }

            // Somar ao valor se tiver valor novo
            if (value && value > 0) {
                updates.value = existingDeal.value + value;
            }

            if (Object.keys(updates).length > 0) {
                await prisma.deal.update({
                    where: { id: existingDeal.id },
                    data: updates,
                });
            }

            return { action: "updated", dealId: existingDeal.id };
        }

        // Criar novo deal
        const newDeal = await prisma.deal.create({
            data: {
                companyId,
                customerPhone: cleanPhone,
                customerName: customerName || null,
                title,
                value: value || 0,
                stage: stage || (source === "ORDER" ? "CLOSED_WON" : "LEAD"),
                notes: `Criado automaticamente via ${source}`,
                closedAt: source === "ORDER" ? new Date() : null,
            },
        });

        return { action: "created", dealId: newDeal.id };
    } catch (error) {
        console.error("[CRM Automation] Error creating/updating deal:", error);
        return { action: "error", error };
    }
}

/**
 * Move deal para INTERESTED quando cliente demonstra interesse
 */
export async function moveDealToInterested(companyId: string, customerPhone: string) {
    try {
        const cleanPhone = customerPhone.replace(/\D/g, "");

        const deal = await prisma.deal.findFirst({
            where: {
                companyId,
                customerPhone: cleanPhone,
                stage: "LEAD",
            },
        });

        if (deal) {
            await prisma.deal.update({
                where: { id: deal.id },
                data: { stage: "INTERESTED" },
            });
            return { action: "moved", dealId: deal.id };
        }

        return { action: "not_found" };
    } catch (error) {
        console.error("[CRM Automation] Error moving deal:", error);
        return { action: "error", error };
    }
}

/**
 * Move deal para CLOSED_WON quando cliente fecha pedido
 */
export async function moveDealToClosed(companyId: string, customerPhone: string, orderValue?: number) {
    try {
        const cleanPhone = customerPhone.replace(/\D/g, "");

        const deal = await prisma.deal.findFirst({
            where: {
                companyId,
                customerPhone: cleanPhone,
                stage: { notIn: ["CLOSED_WON", "CLOSED_LOST"] },
            },
            orderBy: { createdAt: "desc" },
        });

        if (deal) {
            await prisma.deal.update({
                where: { id: deal.id },
                data: {
                    stage: "CLOSED_WON",
                    closedAt: new Date(),
                    value: orderValue ? deal.value + orderValue : deal.value,
                },
            });
            return { action: "closed", dealId: deal.id };
        }

        return { action: "not_found" };
    } catch (error) {
        console.error("[CRM Automation] Error closing deal:", error);
        return { action: "error", error };
    }
}
