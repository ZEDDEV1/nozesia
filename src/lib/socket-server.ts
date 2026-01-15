/**
 * Socket.io Server Configuration
 * 
 * Gerencia conexões WebSocket para:
 * - Atualização de conversas em tempo real
 * - Notificações de novas mensagens
 * - Status de digitação
 * - Status de conexão WhatsApp
 * 
 * SEGURANÇA: Autenticação JWT obrigatória no handshake
 */

import { Server as SocketIOServer, Socket } from "socket.io";
import jwt from "jsonwebtoken";
import { logger } from "./logger";
import { startSocketBridgeSubscriber } from "./socket-bridge";

// JWT secret (same as auth.ts)
const JWT_SECRET = process.env.JWT_SECRET || process.env.NEXTAUTH_SECRET || "fallback-secret-change-me";

interface JWTPayload {
    userId: string;
    email: string;
    companyId: string;
    role: string;
}

// Tipos de eventos
export interface ServerToClientEvents {
    // Mensagens
    "message:new": (data: { conversationId: string; message: MessageData }) => void;
    "message:read": (data: { conversationId: string; messageIds: string[] }) => void;

    // Conversas
    "conversation:new": (data: { conversation: ConversationData }) => void;
    "conversation:update": (data: { conversationId: string; updates: Partial<ConversationData> }) => void;

    // Status
    "typing:start": (data: { conversationId: string; sender: string }) => void;
    "typing:stop": (data: { conversationId: string; sender: string }) => void;

    // WhatsApp
    "whatsapp:status": (data: { sessionId: string; status: string; qrCode?: string }) => void;

    // Erros
    "error": (data: { message: string }) => void;
}

export interface ClientToServerEvents {
    // Entrar/sair de rooms
    "join:company": (companyId: string) => void;
    "leave:company": (companyId: string) => void;
    "join:conversation": (conversationId: string) => void;
    "leave:conversation": (conversationId: string) => void;

    // Ações
    "typing:start": (conversationId: string) => void;
    "typing:stop": (conversationId: string) => void;
    "message:read": (data: { conversationId: string; messageIds: string[] }) => void;
}

export interface InterServerEvents {
    ping: () => void;
}

export interface SocketData {
    userId?: string;
    companyId?: string;
    email?: string;
}

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

// Instância global do servidor (para uso em API routes)
let io: SocketIOServer<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData> | null = null;

/**
 * Inicializa o servidor Socket.io
 */
export function initSocketServer(httpServer: unknown): SocketIOServer {
    if (io) {
        logger.warn("Socket.io server already initialized");
        return io;
    }

    io = new SocketIOServer(httpServer as never, {
        cors: {
            origin: process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
            methods: ["GET", "POST"],
            credentials: true,
        },
        transports: ["websocket", "polling"],
    });

    // ============================================
    // MIDDLEWARE DE AUTENTICAÇÃO JWT
    // ============================================
    io.use((socket, next) => {
        const token = socket.handshake.auth.token;

        if (!token) {
            logger.warn("Socket connection rejected: No token provided", { socketId: socket.id });
            return next(new Error("Authentication required"));
        }

        try {
            const decoded = jwt.verify(token, JWT_SECRET) as JWTPayload;

            // Armazena dados do usuário no socket
            socket.data.userId = decoded.userId;
            socket.data.email = decoded.email;
            socket.data.companyId = decoded.companyId;

            logger.info("Socket authenticated", {
                socketId: socket.id,
                userId: decoded.userId,
                companyId: decoded.companyId
            });

            next();
        } catch (error) {
            logger.warn("Socket connection rejected: Invalid token", {
                socketId: socket.id,
                error: error instanceof Error ? error.message : "Unknown"
            });
            return next(new Error("Invalid token"));
        }
    });

    io.on("connection", (socket: Socket<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>) => {
        logger.info("Socket connected", {
            socketId: socket.id,
            userId: socket.data.userId,
            companyId: socket.data.companyId
        });

        // Auto-join na room da empresa após autenticação
        if (socket.data.companyId) {
            socket.join(`company:${socket.data.companyId}`);
            logger.info("Auto-joined company room", {
                socketId: socket.id,
                companyId: socket.data.companyId
            });
        }

        // DEBUG: Log ALL events from this socket
        socket.onAny((eventName, ...args) => {
            logger.info("[Socket] Event received", { socketId: socket.id, eventName, hasArgs: args.length > 0 });
        });

        // Handler de rooms - VALIDA companyId
        socket.on("join:company", (companyId: string) => {
            // Só permite entrar na room da própria empresa
            if (socket.data.companyId !== companyId) {
                logger.warn("Unauthorized attempt to join company room", {
                    socketId: socket.id,
                    requestedCompanyId: companyId,
                    userCompanyId: socket.data.companyId
                });
                socket.emit("error", { message: "Unauthorized: Cannot join other company rooms" });
                return;
            }

            socket.join(`company:${companyId}`);
            logger.info("Client joined company room", { socketId: socket.id, companyId });
        });

        socket.on("leave:company", (companyId: string) => {
            socket.leave(`company:${companyId}`);
            logger.debug("Left company room", { socketId: socket.id, companyId });
        });

        socket.on("join:conversation", (conversationId: string) => {
            // TODO: Validar se a conversa pertence à empresa do usuário
            socket.join(`conversation:${conversationId}`);
            logger.debug("Joined conversation room", { socketId: socket.id, conversationId });
        });

        socket.on("leave:conversation", (conversationId: string) => {
            socket.leave(`conversation:${conversationId}`);
            logger.debug("Left conversation room", { socketId: socket.id, conversationId });
        });

        // Handler de typing
        socket.on("typing:start", (conversationId: string) => {
            socket.to(`conversation:${conversationId}`).emit("typing:start", {
                conversationId,
                sender: socket.data.email || "unknown",
            });
        });

        socket.on("typing:stop", (conversationId: string) => {
            socket.to(`conversation:${conversationId}`).emit("typing:stop", {
                conversationId,
                sender: socket.data.email || "unknown",
            });
        });

        // Broadcast handlers (para API routes emitirem eventos)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        socket.on("broadcast:message" as any, (data: { conversationId: string; companyId: string; message: MessageData }) => {
            logger.info("Received broadcast:message", { conversationId: data.conversationId, companyId: data.companyId });

            // Re-emit para clientes na conversa específica
            io?.to(`conversation:${data.conversationId}`).emit("message:new", {
                conversationId: data.conversationId,
                message: data.message,
            });

            // TAMBÉM emitir message:new para a company room (para sidebar/lista de conversas)
            io?.to(`company:${data.companyId}`).emit("message:new", {
                conversationId: data.conversationId,
                message: data.message,
            });

            // E emitir conversation:update para metadados
            io?.to(`company:${data.companyId}`).emit("conversation:update", {
                conversationId: data.conversationId,
                updates: {
                    lastMessageAt: data.message.createdAt,
                    unreadCount: 1,
                },
            });
            logger.info("Broadcast message relayed to rooms", { conversationId: data.conversationId, companyId: data.companyId });
        });

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        socket.on("broadcast:conversation" as any, (data: { companyId: string; conversation: ConversationData }) => {
            io?.to(`company:${data.companyId}`).emit("conversation:new", {
                conversation: data.conversation,
            });
            logger.debug("Broadcast conversation relayed", { conversationId: data.conversation.id });
        });

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        socket.on("broadcast:whatsapp" as any, (data: { companyId: string; sessionId: string; status: string; qrCode?: string }) => {
            io?.to(`company:${data.companyId}`).emit("whatsapp:status", {
                sessionId: data.sessionId,
                status: data.status,
                qrCode: data.qrCode,
            });
            logger.debug("Broadcast whatsapp status relayed", { sessionId: data.sessionId });
        });

        // Handler de desconexão
        socket.on("disconnect", (reason) => {
            logger.info("Socket disconnected", { socketId: socket.id, reason });
        });
    });

    // Start Redis pub/sub subscriber to receive messages from worker (if available)
    const redisSubscriberStarted = startSocketBridgeSubscriber({
        onNewMessage: (conversationId, companyId, message) => {
            // Emit to conversation room
            io?.to(`conversation:${conversationId}`).emit("message:new", {
                conversationId,
                message,
            });
            // Emit to company room for sidebar
            io?.to(`company:${companyId}`).emit("message:new", {
                conversationId,
                message,
            });
            // Emit update for metadata
            io?.to(`company:${companyId}`).emit("conversation:update", {
                conversationId,
                updates: {
                    lastMessageAt: message.createdAt,
                    unreadCount: 1,
                },
            });
            logger.debug("Relayed message from Redis", { conversationId, messageId: message.id });
        },
        onNewConversation: (companyId, conversation) => {
            io?.to(`company:${companyId}`).emit("conversation:new", { conversation });
            logger.debug("Relayed new conversation from Redis", { conversationId: conversation.id });
        },
        onWhatsAppStatus: (companyId, sessionId, status, qrCode) => {
            io?.to(`company:${companyId}`).emit("whatsapp:status", { sessionId, status, qrCode });
            logger.debug("Relayed WhatsApp status from Redis", { sessionId, status });
        },
    });

    if (redisSubscriberStarted) {
        logger.info("Socket.io server initialized with Redis bridge");
    } else {
        logger.info("Socket.io server initialized (using direct socket-emit for real-time events)");
    }
    return io;
}

/**
 * Retorna a instância do servidor Socket.io
 */
export function getSocketServer(): SocketIOServer | null {
    return io;
}

// ============================================
// FUNÇÕES HELPER PARA EMITIR EVENTOS
// ============================================

/**
 * Emite nova mensagem para uma conversa
 */
export function emitNewMessage(conversationId: string, companyId: string, message: MessageData): void {
    if (!io) {
        logger.warn("Socket.io not initialized, skipping emit");
        return;
    }

    // Emite para quem está na conversa específica
    io.to(`conversation:${conversationId}`).emit("message:new", {
        conversationId,
        message,
    });

    // TAMBÉM emite message:new para a empresa (para sidebar/notificações)
    io.to(`company:${companyId}`).emit("message:new", {
        conversationId,
        message,
    });

    // E emite conversation:update para atualizar metadados
    io.to(`company:${companyId}`).emit("conversation:update", {
        conversationId,
        updates: {
            lastMessageAt: message.createdAt,
            unreadCount: 1, // O listener deve incrementar
        },
    });

    logger.debug("Emitted new message", { conversationId, companyId, messageId: message.id });
}

/**
 * Emite nova conversa criada
 */
export function emitNewConversation(companyId: string, conversation: ConversationData): void {
    if (!io) return;

    io.to(`company:${companyId}`).emit("conversation:new", { conversation });
    logger.debug("Emitted new conversation", { companyId, conversationId: conversation.id });
}

/**
 * Emite atualização de status de conversa
 */
export function emitConversationUpdate(
    conversationId: string,
    companyId: string,
    updates: Partial<ConversationData>
): void {
    if (!io) return;

    io.to(`company:${companyId}`).emit("conversation:update", {
        conversationId,
        updates,
    });
}

/**
 * Emite status do WhatsApp
 */
export function emitWhatsAppStatus(
    companyId: string,
    sessionId: string,
    status: string,
    qrCode?: string
): void {
    if (!io) return;

    io.to(`company:${companyId}`).emit("whatsapp:status", {
        sessionId,
        status,
        qrCode,
    });

    logger.whatsapp("Status emitted", { companyId, sessionId, status });
}
