/**
 * Socket Emit via HTTP
 * 
 * Este módulo emite eventos para o socket server via HTTP.
 * Usa o endpoint interno /_internal/emit do server.ts.
 * 
 * IMPORTANTE: Este endpoint só funciona quando rodando com npm run start:socket
 */

import { logger } from "./logger";

// Tipos de dados
interface MessageData {
    id: string;
    content: string;
    type: string;
    sender: "CUSTOMER" | "AI" | "HUMAN";
    createdAt: string;
    mediaUrl?: string | null;
}

interface ConversationData {
    id: string;
    customerName: string | null;
    customerPhone: string;
    status: string;
    unreadCount: number;
    lastMessageAt: string;
}

const SOCKET_SERVER_URL = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

/**
 * Emite evento via HTTP para o socket server
 */
async function emitViaHttp(data: Record<string, unknown>): Promise<boolean> {
    try {
        const response = await fetch(`${SOCKET_SERVER_URL}/_internal/emit`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify(data),
        });

        if (!response.ok) {
            logger.warn("[SocketEmit] HTTP emit failed", {
                status: response.status,
                statusText: response.statusText
            });
            return false;
        }

        return true;
    } catch (error) {
        // Em desenvolvimento (npm run dev), o endpoint não existe
        // Isso é esperado e não deve logar como erro
        logger.debug("[SocketEmit] HTTP emit unavailable (expected in dev mode)", {
            error: error instanceof Error ? error.message : "Unknown"
        });
        return false;
    }
}

/**
 * Emite nova mensagem via Socket.io (via HTTP)
 */
export async function emitSocketMessage(conversationId: string, companyId: string, message: MessageData): Promise<void> {
    const success = await emitViaHttp({
        type: "message",
        conversationId,
        companyId,
        message,
    });

    if (success) {
        logger.info("[SocketEmit] Message emitted via HTTP", {
            conversationId,
            messageId: message.id
        });
    }
}

/**
 * Emite nova conversa via Socket.io (via HTTP)
 */
export async function emitSocketConversation(companyId: string, conversation: ConversationData): Promise<void> {
    const success = await emitViaHttp({
        type: "conversation",
        companyId,
        conversation,
    });

    if (success) {
        logger.info("[SocketEmit] Conversation emitted via HTTP", {
            conversationId: conversation.id
        });
    }
}

/**
 * Emite atualização de status do WhatsApp via Socket.io (via HTTP)
 */
export async function emitSocketWhatsAppStatus(companyId: string, sessionId: string, status: string, qrCode?: string): Promise<void> {
    await emitViaHttp({
        type: "whatsapp",
        companyId,
        sessionId,
        status,
        qrCode,
    });
}
