/**
 * Socket.io Client Hook - Production Ready
 * 
 * Hook React para conectar ao servidor WebSocket
 * e receber atualizações em tempo real.
 * 
 * Otimizado para produção com:
 * - Conexão persistente (singleton)
 * - Reconexão automática robusta
 * - Gerenciamento de rooms inteligente
 */

"use client";

import { useEffect, useRef, useCallback, useState } from "react";
import { io, Socket } from "socket.io-client";

// Tipos de eventos (espelhando o servidor)
interface ServerToClientEvents {
    "message:new": (data: { conversationId: string; message: MessageData }) => void;
    "message:read": (data: { conversationId: string; messageIds: string[] }) => void;
    "conversation:new": (data: { conversation: ConversationData }) => void;
    "conversation:update": (data: { conversationId: string; updates: Partial<ConversationData> }) => void;
    "typing:start": (data: { conversationId: string; sender: string }) => void;
    "typing:stop": (data: { conversationId: string; sender: string }) => void;
    "whatsapp:status": (data: { sessionId: string; status: string; qrCode?: string }) => void;
    "error": (data: { message: string }) => void;
}

interface ClientToServerEvents {
    "join:company": (companyId: string) => void;
    "leave:company": (companyId: string) => void;
    "join:conversation": (conversationId: string) => void;
    "leave:conversation": (conversationId: string) => void;
    "typing:start": (conversationId: string) => void;
    "typing:stop": (conversationId: string) => void;
    "message:read": (data: { conversationId: string; messageIds: string[] }) => void;
}

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

type TypedSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

// ============================================
// SINGLETON SOCKET - Conexão global persistente
// ============================================

let globalSocket: TypedSocket | null = null;
let connectionPromise: Promise<TypedSocket> | null = null;
const joinedRooms = new Set<string>();

async function getSocketInstance(): Promise<TypedSocket> {
    // Retorna conexão existente
    if (globalSocket?.connected) {
        return Promise.resolve(globalSocket);
    }

    // Retorna promise de conexão em andamento
    if (connectionPromise) {
        return connectionPromise;
    }

    // Busca o token JWT via API antes de criar a conexão
    const getAuthToken = async (): Promise<string | null> => {
        try {
            const response = await fetch("/api/socket/token");
            const data = await response.json();
            return data.token || null;
        } catch (error) {
            console.error("[Socket] Failed to get auth token:", error);
            return null;
        }
    };

    const token = await getAuthToken();

    if (!token) {
        console.warn("[Socket] No auth token found, connection may fail");
    }

    // Cria nova conexão
    connectionPromise = new Promise((resolve, reject) => {
        if (typeof window === "undefined") {
            reject(new Error("Socket only available on client"));
            return;
        }

        const socketUrl = process.env.NEXT_PUBLIC_SOCKET_URL || window.location.origin;

        console.log("[Socket] Creating new connection to:", socketUrl, token ? "(with auth)" : "(no auth)");

        globalSocket = io(socketUrl, {
            transports: ["websocket", "polling"],
            autoConnect: true,
            reconnection: true,
            reconnectionAttempts: Infinity, // Nunca parar de tentar
            reconnectionDelay: 1000,
            reconnectionDelayMax: 5000,
            timeout: 10000,
            forceNew: false, // Reutilizar conexão
            auth: {
                token: token, // Envia JWT no handshake
            },
        });

        const timeout = setTimeout(() => {
            connectionPromise = null;
            reject(new Error("Socket connection timeout"));
        }, 15000);

        globalSocket.on("connect", () => {
            console.log("[Socket] Connected:", globalSocket?.id);
            clearTimeout(timeout);
            connectionPromise = null;

            // Rejoin all rooms after reconnection
            joinedRooms.forEach(room => {
                if (room.startsWith("company:")) {
                    globalSocket?.emit("join:company", room.replace("company:", ""));
                } else if (room.startsWith("conversation:")) {
                    globalSocket?.emit("join:conversation", room.replace("conversation:", ""));
                }
            });

            resolve(globalSocket!);
        });

        globalSocket.on("disconnect", (reason) => {
            console.log("[Socket] Disconnected:", reason);
            // Não limpar globalSocket para permitir reconexão automática
        });

        globalSocket.on("connect_error", (error) => {
            console.warn("[Socket] Connection error:", error.message);
            // Socket.io vai tentar reconectar automaticamente
        });
    });

    return connectionPromise;
}

// ============================================
// HOOKS
// ============================================

interface UseSocketOptions {
    companyId?: string;
    autoConnect?: boolean;
}

interface UseSocketReturn {
    socket: TypedSocket | null;
    isConnected: boolean;
    joinConversation: (conversationId: string) => void;
    leaveConversation: (conversationId: string) => void;
    startTyping: (conversationId: string) => void;
    stopTyping: (conversationId: string) => void;
    markAsRead: (conversationId: string, messageIds: string[]) => void;
}

/**
 * Hook principal para usar Socket.io
 * Usa conexão singleton persistente
 */
export function useSocket(options: UseSocketOptions = {}): UseSocketReturn {
    const { companyId, autoConnect = true } = options;
    const [socket, setSocket] = useState<TypedSocket | null>(null);
    const [isConnected, setIsConnected] = useState(false);
    const mountedRef = useRef(true);
    const joinedCompanyRef = useRef<string | null>(null);

    useEffect(() => {
        mountedRef.current = true;

        if (!autoConnect) {
            return;
        }

        // Conectar usando singleton
        getSocketInstance()
            .then((sock) => {
                if (!mountedRef.current) return;

                setSocket(sock);
                setIsConnected(sock.connected);

                // Listener de status de conexão
                const handleConnect = () => {
                    console.log("[Socket] Connected, rejoining rooms...");
                    setIsConnected(true);
                    // Rejoin company room on reconnect
                    if (companyId && companyId !== joinedCompanyRef.current) {
                        console.log("[Socket] Joining company room:", companyId);
                        sock.emit("join:company", companyId);
                        joinedRooms.add(`company:${companyId}`);
                        joinedCompanyRef.current = companyId;
                    }
                };
                const handleDisconnect = () => setIsConnected(false);

                sock.on("connect", handleConnect);
                sock.on("disconnect", handleDisconnect);

                return () => {
                    sock.off("connect", handleConnect);
                    sock.off("disconnect", handleDisconnect);
                };
            })
            .catch((err) => {
                console.error("[Socket] Failed to connect:", err);
            });

        return () => {
            mountedRef.current = false;
            // NÃO desconectar - socket é singleton persistente
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [autoConnect]);

    // Efeito separado para reagir às mudanças de companyId
    useEffect(() => {
        if (!socket || !companyId) return;

        // Se já está na room correta, não faz nada
        if (joinedCompanyRef.current === companyId) return;

        console.log("[Socket] CompanyId changed, joining room:", companyId);
        socket.emit("join:company", companyId);
        joinedRooms.add(`company:${companyId}`);
        joinedCompanyRef.current = companyId;
    }, [socket, companyId]);

    // Funções de ação
    const joinConversation = useCallback((conversationId: string) => {
        console.log("[Socket] Joining conversation room:", conversationId);
        globalSocket?.emit("join:conversation", conversationId);
        joinedRooms.add(`conversation:${conversationId}`);
    }, []);

    const leaveConversation = useCallback((conversationId: string) => {
        globalSocket?.emit("leave:conversation", conversationId);
        joinedRooms.delete(`conversation:${conversationId}`);
    }, []);

    const startTyping = useCallback((conversationId: string) => {
        globalSocket?.emit("typing:start", conversationId);
    }, []);

    const stopTyping = useCallback((conversationId: string) => {
        globalSocket?.emit("typing:stop", conversationId);
    }, []);

    const markAsRead = useCallback((conversationId: string, messageIds: string[]) => {
        globalSocket?.emit("message:read", { conversationId, messageIds });
    }, []);

    return {
        socket,
        isConnected,
        joinConversation,
        leaveConversation,
        startTyping,
        stopTyping,
        markAsRead,
    };
}

// ============================================
// HOOKS ESPECIALIZADOS
// ============================================

interface UseConversationSocketOptions {
    conversationId: string;
    companyId?: string;
    onNewMessage?: (message: MessageData) => void;
    onTypingStart?: (sender: string) => void;
    onTypingStop?: (sender: string) => void;
}

/**
 * Hook especializado para uma conversa específica
 */
export function useConversationSocket(options: UseConversationSocketOptions) {
    const { conversationId, companyId, onNewMessage, onTypingStart, onTypingStop } = options;
    const { socket, isConnected, joinConversation, leaveConversation, startTyping, stopTyping } = useSocket({ companyId });

    useEffect(() => {
        if (!socket || !conversationId) return;

        // Entrar na room da conversa
        joinConversation(conversationId);

        // Handlers
        const handleNewMessage = (data: { conversationId: string; message: MessageData }) => {
            if (data.conversationId === conversationId && onNewMessage) {
                onNewMessage(data.message);
            }
        };

        const handleTypingStart = (data: { conversationId: string; sender: string }) => {
            if (data.conversationId === conversationId && onTypingStart) {
                onTypingStart(data.sender);
            }
        };

        const handleTypingStop = (data: { conversationId: string; sender: string }) => {
            if (data.conversationId === conversationId && onTypingStop) {
                onTypingStop(data.sender);
            }
        };

        socket.on("message:new", handleNewMessage);
        socket.on("typing:start", handleTypingStart);
        socket.on("typing:stop", handleTypingStop);

        return () => {
            socket.off("message:new", handleNewMessage);
            socket.off("typing:start", handleTypingStart);
            socket.off("typing:stop", handleTypingStop);
            leaveConversation(conversationId);
        };
    }, [socket, conversationId, onNewMessage, onTypingStart, onTypingStop, joinConversation, leaveConversation]);

    return {
        isConnected,
        startTyping: () => startTyping(conversationId),
        stopTyping: () => stopTyping(conversationId),
    };
}

interface UseConversationsListSocketOptions {
    companyId: string;
    onNewConversation?: (conversation: ConversationData) => void;
    onConversationUpdate?: (conversationId: string, updates: Partial<ConversationData>) => void;
    onNewMessage?: (conversationId: string, message: MessageData) => void;
}

/**
 * Hook para lista de conversas (sidebar)
 */
export function useConversationsListSocket(options: UseConversationsListSocketOptions) {
    const { companyId, onNewConversation, onConversationUpdate, onNewMessage } = options;
    const { socket, isConnected } = useSocket({ companyId });
    const handlersRef = useRef({ onNewConversation, onConversationUpdate, onNewMessage });

    // Manter referência atualizada dos handlers
    useEffect(() => {
        handlersRef.current = { onNewConversation, onConversationUpdate, onNewMessage };
    }, [onNewConversation, onConversationUpdate, onNewMessage]);

    useEffect(() => {
        if (!socket) return;

        const handleNewConversation = (data: { conversation: ConversationData }) => {
            handlersRef.current.onNewConversation?.(data.conversation);
        };

        const handleConversationUpdate = (data: { conversationId: string; updates: Partial<ConversationData> }) => {
            handlersRef.current.onConversationUpdate?.(data.conversationId, data.updates);
        };

        const handleNewMessage = (data: { conversationId: string; message: MessageData }) => {
            handlersRef.current.onNewMessage?.(data.conversationId, data.message);
        };

        socket.on("conversation:new", handleNewConversation);
        socket.on("conversation:update", handleConversationUpdate);
        socket.on("message:new", handleNewMessage);

        return () => {
            socket.off("conversation:new", handleNewConversation);
            socket.off("conversation:update", handleConversationUpdate);
            socket.off("message:new", handleNewMessage);
        };
    }, [socket]);

    return { isConnected };
}
