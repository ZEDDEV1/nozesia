/**
 * Conversation Timeout Service
 * 
 * Gerencia timeout de conversas por inatividade de forma INTELIGENTE:
 * 
 * REGRA PRINCIPAL:
 * - Só envia aviso se cliente PAROU NO MEIO do processo
 * - NÃO envia aviso se IA já terminou seu trabalho (pedido feito, consulta marcada)
 * 
 * Critérios para considerar "IA já terminou":
 * 1. Existe Order com status != CANCELLED (pedido criado)
 * 2. Existe Appointment com status CONFIRMED ou COMPLETED
 * 3. Conversa já está CLOSED
 * 4. Última mensagem foi da IA com despedida (função finalizarConversa chamada)
 * 
 * Critérios para considerar "cliente parou no meio":
 * 1. Conversa está AI_HANDLING
 * 2. Última mensagem foi da IA (esperando resposta)
 * 3. Não há pedido ou agendamento pendente
 * 4. Passou X minutos sem resposta do cliente
 */

import { prisma } from "./prisma";
import { logger } from "./logger";
import { wppConnect } from "./wppconnect";
import { emitSocketMessage } from "./socket-emit";
import { generateConversationSummary, updateCustomerMemory } from "./customer-memory";

// ============================================
// CONFIGURATION
// ============================================

export const TIMEOUT_CONFIG = {
    // Tempo sem resposta do cliente para enviar aviso (minutos)
    warningAfterMinutes: 15,

    // Tempo sem resposta para fechar conversa (minutos)
    closeAfterMinutes: 30,

    // Máximo de conversas para processar por execução
    maxConversationsPerRun: 50,
};

// ============================================
// TYPES
// ============================================

interface ConversationToProcess {
    id: string;
    companyId: string;
    customerPhone: string;
    customerName: string | null;
    lastMessageAt: Date;
    status: string;
    session: {
        sessionName: string;
    };
    customerWhatsAppId: string | null;
}

interface TimeoutResult {
    conversationId: string;
    action: "WARNING_SENT" | "CLOSED" | "SKIPPED" | "ERROR";
    reason: string;
}

// ============================================
// CORE FUNCTIONS
// ============================================

/**
 * Verifica se a IA já completou seu trabalho nesta conversa
 * Se sim, NÃO deve enviar aviso de inatividade
 * 
 * DETECÇÃO GENÉRICA PARA TODOS OS NICHOS:
 * - Restaurante/Loja: Order criado
 * - Clínica/Consultório: Appointment confirmado
 * - Agência/Escritório: Reunião agendada (via AuditLog)
 * - Qualquer nicho: Orçamento solicitado, Lead capturado, Transferência para humano
 * - Qualquer nicho: IA se despediu (finalizarConversa)
 */
async function hasAICompletedWork(conversationId: string): Promise<{ completed: boolean; reason: string }> {
    // Período recente para verificar ações (última hora)
    const recentPeriod = new Date(Date.now() - 60 * 60 * 1000);

    // ============================================
    // 1. RESTAURANTE/LOJA: Order (pedido) criado
    // ============================================
    const order = await prisma.order.findFirst({
        where: {
            conversationId,
            status: { not: "CANCELLED" },
        },
        orderBy: { createdAt: "desc" },
    });

    if (order) {
        return {
            completed: true,
            reason: `Order exists with status ${order.status} (restaurante/loja)`,
        };
    }

    // ============================================
    // 2. CLÍNICA/CONSULTÓRIO/AGÊNCIA: Appointment criado
    // Covers: CONSULTATION (clínica), MEETING (agência), SERVICE (salão)
    // ============================================
    const appointment = await prisma.appointment.findFirst({
        where: {
            conversationId,
            status: { in: ["PENDING", "CONFIRMED", "COMPLETED"] },
        },
        orderBy: { createdAt: "desc" },
    });

    if (appointment) {
        return {
            completed: true,
            reason: `${appointment.type} scheduled with status ${appointment.status}`,
        };
    }

    // ============================================
    // 3. QUALQUER NICHO: Ações registradas em AuditLog
    // - AI_TRANSFER_TO_HUMAN: Transferido para atendente
    // - AI_CONVERSATION_CLOSED: IA finalizou conversa
    // ============================================
    const completedAction = await prisma.auditLog.findFirst({
        where: {
            entityId: conversationId,
            action: {
                in: [
                    "AI_CONVERSATION_CLOSED",  // IA se despediu
                    "AI_TRANSFER_TO_HUMAN",    // Transferido para humano
                ],
            },
            createdAt: { gte: recentPeriod },
        },
        orderBy: { createdAt: "desc" },
    });

    if (completedAction) {
        const actionDescriptions: Record<string, string> = {
            "AI_CONVERSATION_CLOSED": "IA finalizou a conversa",
            "AI_TRANSFER_TO_HUMAN": "Conversa transferida para atendente humano",
        };
        return {
            completed: true,
            reason: actionDescriptions[completedAction.action] || completedAction.action,
        };
    }

    // ============================================
    // 4. QUALQUER NICHO: Interesse registrado recente
    // Pode indicar que negócio está em andamento externamente
    // ============================================
    const recentInterest = await prisma.customerInterest.findFirst({
        where: {
            conversationId,
            createdAt: { gte: recentPeriod },
        },
    });

    if (recentInterest) {
        return {
            completed: true,
            reason: `Interest registered: ${recentInterest.productName}`,
        };
    }

    // ============================================
    // 5. QUALQUER NICHO: Deal (negócio) em estágio avançado
    // Se existe deal NEGOTIATING ou CLOSED_WON, trabalho foi feito
    // ============================================
    // Buscar telefone do cliente para verificar deals
    const conversation = await prisma.conversation.findUnique({
        where: { id: conversationId },
        select: { customerPhone: true, companyId: true },
    });

    if (conversation) {
        const activeDeal = await prisma.deal.findFirst({
            where: {
                companyId: conversation.companyId,
                customerPhone: conversation.customerPhone,
                stage: { in: ["NEGOTIATING", "CLOSED_WON"] },
                updatedAt: { gte: recentPeriod },
            },
        });

        if (activeDeal) {
            return {
                completed: true,
                reason: `Deal in stage ${activeDeal.stage}: ${activeDeal.title}`,
            };
        }
    }

    // ============================================
    // NENHUM TRABALHO CONCLUÍDO DETECTADO
    // Cliente pode ter parado no meio do processo
    // ============================================
    return {
        completed: false,
        reason: "No completed work found - customer may have stopped mid-process",
    };
}

/**
 * Verifica se a última mensagem foi da IA (cliente não respondeu)
 */
async function wasLastMessageFromAI(conversationId: string): Promise<boolean> {
    const lastMessage = await prisma.message.findFirst({
        where: { conversationId },
        orderBy: { createdAt: "desc" },
        select: { sender: true },
    });

    return lastMessage?.sender === "AI";
}

/**
 * Verifica se já enviamos aviso recentemente para esta conversa
 */
async function hasRecentWarning(conversationId: string): Promise<boolean> {
    const recentWarning = await prisma.auditLog.findFirst({
        where: {
            entityId: conversationId,
            action: "INACTIVITY_WARNING_SENT",
            createdAt: { gte: new Date(Date.now() - TIMEOUT_CONFIG.warningAfterMinutes * 60 * 1000) },
        },
    });

    return !!recentWarning;
}

/**
 * Envia mensagem de aviso de inatividade
 */
async function sendInactivityWarning(
    conversation: ConversationToProcess,
    sessionName: string
): Promise<boolean> {
    const customerName = conversation.customerName !== "Cliente" ? conversation.customerName : null;
    const customerWhatsAppId = conversation.customerWhatsAppId || `${conversation.customerPhone}@c.us`;

    const message = customerName
        ? `${customerName}, notei que você não respondeu ainda. 😊\n\nPosso te ajudar com mais alguma coisa? Se não precisar de mais nada, vou encerrar nosso atendimento por aqui, ok?`
        : `Oi! Notei que você não respondeu ainda. 😊\n\nPosso te ajudar com mais alguma coisa? Se não precisar de mais nada, vou encerrar nosso atendimento por aqui, ok?`;

    try {
        // Enviar via WhatsApp
        await wppConnect.sendTextMessage(sessionName, customerWhatsAppId, message);

        // Salvar mensagem no banco
        const savedMessage = await prisma.message.create({
            data: {
                conversationId: conversation.id,
                type: "TEXT",
                content: message,
                sender: "AI",
            },
        });

        // Emitir via WebSocket
        emitSocketMessage(conversation.id, conversation.companyId, {
            id: savedMessage.id,
            content: message,
            type: "TEXT",
            sender: "AI",
            createdAt: savedMessage.createdAt.toISOString(),
            mediaUrl: null,
        });

        // Registrar no AuditLog
        await prisma.auditLog.create({
            data: {
                action: "INACTIVITY_WARNING_SENT",
                entity: "Conversation",
                entityId: conversation.id,
                companyId: conversation.companyId,
                changes: JSON.stringify({ customerPhone: conversation.customerPhone }),
                userEmail: "system@timeout",
            },
        });

        logger.info("[ConversationTimeout] Warning sent", {
            conversationId: conversation.id,
            customerPhone: conversation.customerPhone,
        });

        return true;
    } catch (error) {
        logger.error("[ConversationTimeout] Failed to send warning", {
            conversationId: conversation.id,
            error,
        });
        return false;
    }
}

/**
 * Fecha conversa por inatividade
 */
async function closeInactiveConversation(
    conversation: ConversationToProcess,
    sessionName: string
): Promise<boolean> {
    const customerName = conversation.customerName !== "Cliente" ? conversation.customerName : null;
    const customerWhatsAppId = conversation.customerWhatsAppId || `${conversation.customerPhone}@c.us`;

    const message = customerName
        ? `${customerName}, como não recebi retorno, estou encerrando nosso atendimento por aqui. 📋\n\nSe precisar de algo, é só me chamar novamente! Tenha um ótimo dia! 💚`
        : `Como não recebi retorno, estou encerrando nosso atendimento por aqui. 📋\n\nSe precisar de algo, é só me chamar novamente! Tenha um ótimo dia! 💚`;

    try {
        // Enviar via WhatsApp
        await wppConnect.sendTextMessage(sessionName, customerWhatsAppId, message);

        // Salvar mensagem no banco
        const savedMessage = await prisma.message.create({
            data: {
                conversationId: conversation.id,
                type: "TEXT",
                content: message,
                sender: "AI",
            },
        });

        // Emitir via WebSocket
        emitSocketMessage(conversation.id, conversation.companyId, {
            id: savedMessage.id,
            content: message,
            type: "TEXT",
            sender: "AI",
            createdAt: savedMessage.createdAt.toISOString(),
            mediaUrl: null,
        });

        // Atualizar status da conversa para CLOSED
        await prisma.conversation.update({
            where: { id: conversation.id },
            data: { status: "CLOSED" },
        });

        // Gerar resumo e salvar na memória do cliente
        try {
            const recentMessages = await prisma.message.findMany({
                where: { conversationId: conversation.id },
                orderBy: { createdAt: "desc" },
                take: 10,
            });

            const messagesForMemory = recentMessages.reverse().map(m => ({
                role: (m.sender === "CUSTOMER" ? "user" : "assistant") as "user" | "assistant",
                content: m.content,
            }));

            const summary = await generateConversationSummary(messagesForMemory, customerName || undefined);
            await updateCustomerMemory(
                conversation.companyId,
                conversation.customerPhone,
                summary,
                messagesForMemory.length
            );
        } catch (memError) {
            logger.error("[ConversationTimeout] Failed to update memory", { error: memError });
        }

        // Registrar no AuditLog
        await prisma.auditLog.create({
            data: {
                action: "CONVERSATION_CLOSED_INACTIVITY",
                entity: "Conversation",
                entityId: conversation.id,
                companyId: conversation.companyId,
                changes: JSON.stringify({
                    customerPhone: conversation.customerPhone,
                    reason: "No response after warning",
                }),
                userEmail: "system@timeout",
            },
        });

        logger.info("[ConversationTimeout] Conversation closed", {
            conversationId: conversation.id,
            customerPhone: conversation.customerPhone,
        });

        return true;
    } catch (error) {
        logger.error("[ConversationTimeout] Failed to close conversation", {
            conversationId: conversation.id,
            error,
        });
        return false;
    }
}

// ============================================
// MAIN FUNCTION
// ============================================

/**
 * Processa conversas inativas para uma empresa
 * Retorna lista de ações tomadas
 */
export async function processInactiveConversations(companyId?: string): Promise<TimeoutResult[]> {
    const results: TimeoutResult[] = [];

    const warningCutoff = new Date(Date.now() - TIMEOUT_CONFIG.warningAfterMinutes * 60 * 1000);
    const closeCutoff = new Date(Date.now() - TIMEOUT_CONFIG.closeAfterMinutes * 60 * 1000);

    // Buscar conversas AI_HANDLING sem atividade recente
    const conversations = await prisma.conversation.findMany({
        where: {
            status: "AI_HANDLING" as const,
            lastMessageAt: { lt: warningCutoff },
            ...(companyId && { companyId }),
        },
        include: {
            session: true,
        },
        orderBy: { lastMessageAt: "asc" },
        take: TIMEOUT_CONFIG.maxConversationsPerRun,
    });

    logger.info("[ConversationTimeout] Found conversations to process", {
        count: conversations.length,
        companyId: companyId || "all",
    });

    for (const conversation of conversations) {
        // Pular se sessão não está conectada
        if (conversation.session.status !== "CONNECTED") {
            results.push({
                conversationId: conversation.id,
                action: "SKIPPED",
                reason: "Session not connected",
            });
            continue;
        }

        // Verificar se IA já completou seu trabalho
        const workStatus = await hasAICompletedWork(conversation.id);
        if (workStatus.completed) {
            // Não precisa enviar aviso, mas podemos fechar silenciosamente se passou muito tempo
            if (conversation.lastMessageAt < closeCutoff) {
                await prisma.conversation.update({
                    where: { id: conversation.id },
                    data: { status: "CLOSED" },
                });
                results.push({
                    conversationId: conversation.id,
                    action: "CLOSED",
                    reason: `AI completed work: ${workStatus.reason} - closed silently`,
                });
            } else {
                results.push({
                    conversationId: conversation.id,
                    action: "SKIPPED",
                    reason: `AI completed work: ${workStatus.reason}`,
                });
            }
            continue;
        }

        // Verificar se última mensagem foi da IA (cliente não respondeu)
        const aiWasLast = await wasLastMessageFromAI(conversation.id);
        if (!aiWasLast) {
            results.push({
                conversationId: conversation.id,
                action: "SKIPPED",
                reason: "Last message was from customer - not waiting for response",
            });
            continue;
        }

        const sessionName = `${conversation.session.companyId}_${conversation.session.sessionName}`.toLowerCase().replace(/\s/g, "_");

        // Preparar dados da conversa para as funções auxiliares
        const conversationData: ConversationToProcess = {
            id: conversation.id,
            companyId: conversation.companyId,
            customerPhone: conversation.customerPhone,
            customerName: conversation.customerName,
            lastMessageAt: conversation.lastMessageAt,
            status: conversation.status,
            session: { sessionName },
            customerWhatsAppId: conversation.customerWhatsAppId,
        };

        // Verificar se deve fechar (passou mais tempo que o limite de fechar)
        if (conversation.lastMessageAt < closeCutoff) {
            // Verificar se já enviamos aviso
            const hasWarning = await hasRecentWarning(conversation.id);

            if (hasWarning) {
                // Já avisamos, agora fechar
                const success = await closeInactiveConversation(conversationData, sessionName);
                results.push({
                    conversationId: conversation.id,
                    action: success ? "CLOSED" : "ERROR",
                    reason: success ? "Closed after warning" : "Failed to close",
                });
            } else {
                // Não enviamos aviso ainda, enviar primeiro
                const success = await sendInactivityWarning(conversationData, sessionName);
                results.push({
                    conversationId: conversation.id,
                    action: success ? "WARNING_SENT" : "ERROR",
                    reason: success ? "Warning sent (late)" : "Failed to send warning",
                });
            }
        } else {
            // Ainda no período de aviso
            const hasWarning = await hasRecentWarning(conversation.id);

            if (!hasWarning) {
                const success = await sendInactivityWarning(conversationData, sessionName);
                results.push({
                    conversationId: conversation.id,
                    action: success ? "WARNING_SENT" : "ERROR",
                    reason: success ? "Warning sent" : "Failed to send warning",
                });
            } else {
                results.push({
                    conversationId: conversation.id,
                    action: "SKIPPED",
                    reason: "Warning already sent, waiting for response or close time",
                });
            }
        }
    }

    return results;
}

