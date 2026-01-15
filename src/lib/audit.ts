/**
 * Audit Log Helper - Registro automático de operações críticas
 * 
 * PARA QUE SERVE:
 * - Registrar quem fez o quê e quando
 * - Compliance e segurança
 * - Debug de problemas
 * 
 * QUANDO USAR:
 * - Criação/edição/exclusão de dados
 * - Login/logout
 * - Alterações de configuração
 * - Operações sensíveis
 */

import { prisma } from "./prisma";
import { logger } from "./logger";

// ============================================
// TIPOS
// ============================================

export type AuditAction =
    // Auth
    | "LOGIN"
    | "LOGOUT"
    | "LOGIN_FAILED"
    | "PASSWORD_CHANGED"
    | "PASSWORD_RESET_REQUESTED"
    // Agents
    | "AGENT_CREATED"
    | "AGENT_UPDATED"
    | "AGENT_DELETED"
    | "TRAINING_ADDED"
    | "TRAINING_DELETED"
    // WhatsApp
    | "SESSION_CREATED"
    | "SESSION_CONNECTED"
    | "SESSION_DISCONNECTED"
    | "SESSION_DELETED"
    // Conversations
    | "CONVERSATION_TRANSFERRED"
    | "CONVERSATION_CLOSED"
    // Orders
    | "ORDER_CREATED"
    | "ORDER_UPDATED"
    | "PAYMENT_RECEIVED"
    // Company
    | "COMPANY_UPDATED"
    | "PLAN_CHANGED"
    | "USER_INVITED"
    | "USER_REMOVED"
    // Webhooks
    | "WEBHOOK_CREATED"
    | "WEBHOOK_UPDATED"
    | "WEBHOOK_DELETED"
    // Admin
    | "ADMIN_ACTION"
    | "SETTINGS_CHANGED";

export interface AuditLogData {
    action: AuditAction;
    entity: string;              // Nome da entidade (Agent, User, etc)
    entityId?: string;           // ID da entidade
    companyId?: string;          // ID da empresa
    userId?: string;             // ID do usuário que executou
    userEmail?: string;          // Email do usuário
    details?: Record<string, unknown>;  // Detalhes adicionais
    ipAddress?: string;          // IP do cliente
}

// ============================================
// FUNÇÃO PRINCIPAL
// ============================================

/**
 * Registra uma ação no audit log
 * 
 * @example
 * await audit({
 *     action: "AGENT_CREATED",
 *     entity: "Agent",
 *     entityId: agent.id,
 *     companyId: company.id,
 *     userEmail: "admin@example.com",
 *     details: { agentName: "Vendas" }
 * });
 */
export async function audit(data: AuditLogData): Promise<void> {
    try {
        await prisma.auditLog.create({
            data: {
                action: data.action,
                entity: data.entity,
                entityId: data.entityId,
                companyId: data.companyId,
                userEmail: data.userEmail || data.userId || "system",
                changes: data.details ? JSON.stringify(data.details) : null,
                ipAddress: data.ipAddress,
            },
        });

        logger.debug(`[Audit] ${data.action} on ${data.entity}`, {
            entityId: data.entityId,
            userEmail: data.userEmail,
        });
    } catch (error) {
        // Não falhar a operação principal por causa do audit log
        logger.error("[Audit] Failed to create audit log", { error, data });
    }
}

// ============================================
// HELPERS ESPECÍFICOS
// ============================================

/**
 * Audit de login
 */
export async function auditLogin(
    userEmail: string,
    success: boolean,
    ipAddress?: string,
    details?: Record<string, unknown>
): Promise<void> {
    await audit({
        action: success ? "LOGIN" : "LOGIN_FAILED",
        entity: "User",
        userEmail,
        ipAddress,
        details: { success, ...details },
    });
}

/**
 * Audit de criação de agente
 */
export async function auditAgentCreated(
    agentId: string,
    agentName: string,
    companyId: string,
    userEmail: string
): Promise<void> {
    await audit({
        action: "AGENT_CREATED",
        entity: "Agent",
        entityId: agentId,
        companyId,
        userEmail,
        details: { agentName },
    });
}

/**
 * Audit de atualização de agente
 */
export async function auditAgentUpdated(
    agentId: string,
    companyId: string,
    userEmail: string,
    changes: Record<string, unknown>
): Promise<void> {
    await audit({
        action: "AGENT_UPDATED",
        entity: "Agent",
        entityId: agentId,
        companyId,
        userEmail,
        details: { changes },
    });
}

/**
 * Audit de sessão WhatsApp
 */
export async function auditWhatsAppSession(
    action: "SESSION_CREATED" | "SESSION_CONNECTED" | "SESSION_DISCONNECTED" | "SESSION_DELETED",
    sessionId: string,
    companyId: string,
    userEmail?: string,
    details?: Record<string, unknown>
): Promise<void> {
    await audit({
        action,
        entity: "WhatsAppSession",
        entityId: sessionId,
        companyId,
        userEmail,
        details,
    });
}

/**
 * Audit de transferência para humano
 */
export async function auditConversationTransferred(
    conversationId: string,
    companyId: string,
    reason?: string
): Promise<void> {
    await audit({
        action: "CONVERSATION_TRANSFERRED",
        entity: "Conversation",
        entityId: conversationId,
        companyId,
        details: { reason },
    });
}

/**
 * Audit de venda/pedido
 */
export async function auditOrderCreated(
    orderId: string,
    companyId: string,
    totalValue: number,
    customerPhone: string
): Promise<void> {
    await audit({
        action: "ORDER_CREATED",
        entity: "Order",
        entityId: orderId,
        companyId,
        details: { totalValue, customerPhone },
    });
}

/**
 * Audit de mudança de configurações
 */
export async function auditSettingsChanged(
    companyId: string,
    userEmail: string,
    settingName: string,
    oldValue: unknown,
    newValue: unknown
): Promise<void> {
    await audit({
        action: "SETTINGS_CHANGED",
        entity: "Settings",
        companyId,
        userEmail,
        details: { settingName, oldValue, newValue },
    });
}

/**
 * Audit de webhook
 */
export async function auditWebhook(
    action: "WEBHOOK_CREATED" | "WEBHOOK_UPDATED" | "WEBHOOK_DELETED",
    webhookId: string,
    companyId: string,
    userEmail: string,
    details?: Record<string, unknown>
): Promise<void> {
    await audit({
        action,
        entity: "Webhook",
        entityId: webhookId,
        companyId,
        userEmail,
        details,
    });
}

// ============================================
// BUSCAR LOGS
// ============================================

interface AuditLogFilters {
    companyId?: string;
    action?: AuditAction;
    entity?: string;
    userEmail?: string;
    startDate?: Date;
    endDate?: Date;
    limit?: number;
}

/**
 * Busca logs de auditoria com filtros
 */
export async function getAuditLogs(filters: AuditLogFilters = {}) {
    const { companyId, action, entity, userEmail, startDate, endDate, limit = 100 } = filters;

    return prisma.auditLog.findMany({
        where: {
            ...(companyId && { companyId }),
            ...(action && { action }),
            ...(entity && { entity }),
            ...(userEmail && { userEmail }),
            ...(startDate || endDate) && {
                createdAt: {
                    ...(startDate && { gte: startDate }),
                    ...(endDate && { lte: endDate }),
                },
            },
        },
        orderBy: { createdAt: "desc" },
        take: limit,
    });
}

/**
 * Busca últimas ações de um usuário
 */
export async function getUserAuditLogs(userEmail: string, limit = 50) {
    return getAuditLogs({ userEmail, limit });
}

/**
 * Busca últimas ações em uma empresa
 */
export async function getCompanyAuditLogs(companyId: string, limit = 100) {
    return getAuditLogs({ companyId, limit });
}
