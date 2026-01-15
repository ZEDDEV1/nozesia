/**
 * Socket Bridge via Redis Pub/Sub
 * 
 * Permite que processos separados (como o worker) emitam eventos
 * para o socket server via Redis pub/sub.
 * 
 * NOTA: Se REDIS_URL não estiver configurada ou apontar para Upstash REST API,
 * o pub/sub não será usado. O sistema usa socket-emit.ts como fallback.
 * 
 * IMPORTANTE: O Upstash REST API (https://) NÃO suporta pub/sub.
 * Para usar pub/sub, você precisa de um Redis com conexão TCP (redis:// ou rediss://).
 */

import IORedis from "ioredis";
import { logger } from "./logger";

// Redis channels
const CHANNEL_MESSAGE = "socket:message:new";
const CHANNEL_CONVERSATION = "socket:conversation:new";
const CHANNEL_WHATSAPP = "socket:whatsapp:status";

// Singleton pub/sub connections
let publisher: IORedis | null = null;
let subscriber: IORedis | null = null;

// Flag para indicar se o Redis pub/sub está disponível
let redisAvailable: boolean | null = null;
let hasLoggedWarning = false;
let initializationFailed = false;

// Types
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

// Get Redis connection URL (returns null if not configured)
function getRedisUrl(): string | null {
    const url = process.env.REDIS_URL;

    // Se não está configurado, retorna null (não tenta localhost)
    if (!url) {
        return null;
    }

    return url;
}

/**
 * Verifica se o Redis pub/sub está disponível
 * 
 * Regras:
 * 1. REDIS_URL não configurado → Não disponível (usa fallback socket-emit)
 * 2. REDIS_URL é HTTPS (Upstash REST) → Não suporta pub/sub
 * 3. REDIS_URL é redis:// → Disponível
 */
function isRedisPubSubAvailable(): boolean {
    const redisUrl = getRedisUrl();

    // Não configurado - usa fallback silenciosamente
    if (!redisUrl) {
        if (!hasLoggedWarning && process.env.NODE_ENV === "development") {
            // Em dev, loga apenas uma vez como info (não warning)
            console.log("[SocketBridge] REDIS_URL não configurada. Pub/sub desabilitado. Socket-emit será usado como fallback.");
            hasLoggedWarning = true;
        }
        return false;
    }

    // Upstash REST API usa https://, não suporta pub/sub
    if (redisUrl.startsWith("https://") || redisUrl.startsWith("http://")) {
        if (!hasLoggedWarning) {
            logger.warn("[SocketBridge] Redis URL parece ser REST API (Upstash). Pub/Sub não disponível. Usando socket-emit como fallback.");
            hasLoggedWarning = true;
        }
        return false;
    }

    // redis:// URL - disponível para pub/sub
    return true;
}

/**
 * Verifica e retorna se o Redis está disponível
 */
export function isSocketBridgeAvailable(): boolean {
    // Se já falhou a inicialização, não tenta de novo
    if (initializationFailed) return false;
    if (redisAvailable !== null) return redisAvailable;
    redisAvailable = isRedisPubSubAvailable();
    return redisAvailable;
}

/**
 * Marca a inicialização como falha e limpa conexões
 */
function markInitializationFailed(): void {
    initializationFailed = true;
    redisAvailable = false;

    // Limpa as conexões existentes para evitar erros
    if (publisher) {
        publisher.disconnect();
        publisher = null;
    }
    if (subscriber) {
        subscriber.disconnect();
        subscriber = null;
    }
}

// Initialize publisher (used by worker)
function getPublisher(): IORedis | null {
    if (!isSocketBridgeAvailable()) return null;

    if (!publisher) {
        try {
            publisher = new IORedis(getRedisUrl()!, {
                maxRetriesPerRequest: null,
                enableReadyCheck: false,
                lazyConnect: true, // Não conecta automaticamente
                retryStrategy: (times) => {
                    if (times > 3) {
                        if (!hasLoggedWarning) {
                            logger.warn("[SocketBridge] Redis não disponível após 3 tentativas. Usando socket-emit como fallback.");
                            hasLoggedWarning = true;
                        }
                        markInitializationFailed();
                        return null; // Para de tentar
                    }
                    return Math.min(times * 100, 3000);
                },
            });

            publisher.on("error", (err) => {
                if (!hasLoggedWarning) {
                    logger.warn("[SocketBridge] Redis publisher error:", { error: err.message });
                    hasLoggedWarning = true;
                }
                markInitializationFailed();
            });

            publisher.on("close", () => {
                if (!initializationFailed && !hasLoggedWarning) {
                    hasLoggedWarning = true;
                }
            });
        } catch (error) {
            logger.warn("[SocketBridge] Failed to create publisher:", { error });
            markInitializationFailed();
            return null;
        }
    }
    return publisher;
}

// Initialize subscriber (used by socket server)
function getSubscriber(): IORedis | null {
    if (!isSocketBridgeAvailable()) return null;

    if (!subscriber) {
        try {
            subscriber = new IORedis(getRedisUrl()!, {
                maxRetriesPerRequest: null,
                enableReadyCheck: false,
                lazyConnect: true, // Não conecta automaticamente
                retryStrategy: (times) => {
                    if (times > 3) {
                        if (!hasLoggedWarning) {
                            logger.warn("[SocketBridge] Redis não disponível após 3 tentativas. Usando socket-emit como fallback.");
                            hasLoggedWarning = true;
                        }
                        markInitializationFailed();
                        return null; // Para de tentar
                    }
                    return Math.min(times * 100, 3000);
                },
            });

            subscriber.on("error", (err) => {
                if (!hasLoggedWarning) {
                    logger.warn("[SocketBridge] Redis subscriber error:", { error: err.message });
                    hasLoggedWarning = true;
                }
                markInitializationFailed();
            });

            subscriber.on("close", () => {
                if (!initializationFailed && !hasLoggedWarning) {
                    hasLoggedWarning = true;
                }
            });
        } catch (error) {
            logger.warn("[SocketBridge] Failed to create subscriber:", { error });
            markInitializationFailed();
            return null;
        }
    }
    return subscriber;
}

// ============================================
// PUBLISH FUNCTIONS (used by worker)
// ============================================

/**
 * Publica nova mensagem via Redis
 */
export async function publishNewMessage(
    conversationId: string,
    companyId: string,
    message: MessageData
): Promise<void> {
    const pub = getPublisher();
    if (!pub) return; // Redis não disponível, socket-emit será usado como fallback

    try {
        const payload = JSON.stringify({ conversationId, companyId, message });
        await pub.publish(CHANNEL_MESSAGE, payload);
        logger.debug("[SocketBridge] Published message", { conversationId, messageId: message.id });
    } catch (error) {
        logger.error("[SocketBridge] Failed to publish message", { error });
    }
}

/**
 * Publica nova conversa via Redis
 */
export async function publishNewConversation(
    companyId: string,
    conversation: ConversationData
): Promise<void> {
    const pub = getPublisher();
    if (!pub) return; // Redis não disponível, socket-emit será usado como fallback

    try {
        const payload = JSON.stringify({ companyId, conversation });
        await pub.publish(CHANNEL_CONVERSATION, payload);
        logger.debug("[SocketBridge] Published conversation", { conversationId: conversation.id });
    } catch (error) {
        logger.error("[SocketBridge] Failed to publish conversation", { error });
    }
}

/**
 * Publica status do WhatsApp via Redis
 */
export async function publishWhatsAppStatus(
    companyId: string,
    sessionId: string,
    status: string,
    qrCode?: string
): Promise<void> {
    const pub = getPublisher();
    if (!pub) return; // Redis não disponível, socket-emit será usado como fallback

    try {
        const payload = JSON.stringify({ companyId, sessionId, status, qrCode });
        await pub.publish(CHANNEL_WHATSAPP, payload);
        logger.debug("[SocketBridge] Published WhatsApp status", { sessionId, status });
    } catch (error) {
        logger.error("[SocketBridge] Failed to publish WhatsApp status", { error });
    }
}

// ============================================
// SUBSCRIBE FUNCTIONS (used by socket server)
// ============================================

type MessageHandler = (conversationId: string, companyId: string, message: MessageData) => void;
type ConversationHandler = (companyId: string, conversation: ConversationData) => void;
type WhatsAppHandler = (companyId: string, sessionId: string, status: string, qrCode?: string) => void;

/**
 * Inicia subscriber para receber eventos do worker
 * Retorna true se o subscriber foi configurado, false se pub/sub não disponível
 */
export function startSocketBridgeSubscriber(handlers: {
    onNewMessage: MessageHandler;
    onNewConversation: ConversationHandler;
    onWhatsAppStatus: WhatsAppHandler;
}): boolean {
    const sub = getSubscriber();

    if (!sub) {
        logger.info("[SocketBridge] Redis pub/sub não disponível. Mensagens serão entregues via socket-emit.");
        return false;
    }

    // Configura handlers de eventos ANTES de tentar conectar/subscrever
    sub.on("message", (channel, rawMessage) => {
        try {
            const data = JSON.parse(rawMessage);

            switch (channel) {
                case CHANNEL_MESSAGE:
                    handlers.onNewMessage(data.conversationId, data.companyId, data.message);
                    break;
                case CHANNEL_CONVERSATION:
                    handlers.onNewConversation(data.companyId, data.conversation);
                    break;
                case CHANNEL_WHATSAPP:
                    handlers.onWhatsAppStatus(data.companyId, data.sessionId, data.status, data.qrCode);
                    break;
            }
        } catch (error) {
            logger.error("[SocketBridge] Failed to process message", { channel, error });
        }
    });

    // Tenta conectar e subscrever de forma assíncrona
    // Não bloqueia a inicialização do servidor
    (async () => {
        try {
            // Conecta manualmente (por causa do lazyConnect: true)
            await sub.connect();

            // Subscribe nos canais
            await sub.subscribe(CHANNEL_MESSAGE, CHANNEL_CONVERSATION, CHANNEL_WHATSAPP);

            logger.info("[SocketBridge] Subscriber started, listening for events");
        } catch (error) {
            // Trata erro de conexão silenciosamente - o fallback será usado
            if (!hasLoggedWarning) {
                logger.warn("[SocketBridge] Redis pub/sub não disponível:", {
                    error: error instanceof Error ? error.message : String(error)
                });
                hasLoggedWarning = true;
            }
            markInitializationFailed();
        }
    })().catch((error) => {
        // Catch final para garantir que nenhum unhandledRejection escape
        if (!hasLoggedWarning) {
            logger.warn("[SocketBridge] Redis subscriber failed:", {
                error: error instanceof Error ? error.message : String(error)
            });
            hasLoggedWarning = true;
        }
        markInitializationFailed();
    });

    // Retorna true porque a configuração foi iniciada
    // O status real será determinado pelo sucesso da conexão
    return true;
}

/**
 * Para o subscriber
 */
export async function stopSocketBridgeSubscriber(): Promise<void> {
    if (subscriber) {
        await subscriber.unsubscribe();
        await subscriber.quit();
        subscriber = null;
    }
}

/**
 * Para o publisher
 */
export async function stopSocketBridgePublisher(): Promise<void> {
    if (publisher) {
        await publisher.quit();
        publisher = null;
    }
}
