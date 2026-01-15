/**
 * Tipos e constantes compartilhados para a página de conversas
 */

// ============================================
// INTERFACES
// ============================================

export interface Message {
    id: string;
    content: string;
    sender: "CUSTOMER" | "AI" | "HUMAN";
    type: string;
    createdAt: string;
    isRead: boolean;
    mediaUrl?: string | null;
}

export interface TagData {
    id: string;
    name: string;
    color: string;
}

export interface Conversation {
    id: string;
    customerName: string | null;
    customerPhone: string;
    status: "OPEN" | "AI_HANDLING" | "HUMAN_HANDLING" | "CLOSED";
    unreadCount: number;
    lastMessageAt: string;
    agent: { id: string; name: string } | null;
    session: { id: string; sessionName: string; phoneNumber: string | null } | null;
    messages: Message[];
    tags?: TagData[];
    assignedToId?: string | null;
    assignedTo?: { id: string; name: string; email: string } | null;
}

// ============================================
// TIPOS
// ============================================

export type FilterType = "all" | "AI_HANDLING" | "HUMAN_HANDLING" | "CLOSED";
export type ConversationAction = "takeOver" | "returnAI" | "close" | "reopen";
export type ConversationStatus = Conversation["status"];

// ============================================
// CONSTANTES
// ============================================

export const FILTER_OPTIONS: { value: FilterType; label: string; icon: string }[] = [
    { value: "all", label: "Todos", icon: "📋" },
    { value: "AI_HANDLING", label: "IA", icon: "🤖" },
    { value: "HUMAN_HANDLING", label: "Humano", icon: "👤" },
    { value: "CLOSED", label: "Fechadas", icon: "✓" },
];

export const ACTION_STATUS_MAP: Record<ConversationAction, ConversationStatus> = {
    takeOver: "HUMAN_HANDLING",
    returnAI: "AI_HANDLING",
    close: "CLOSED",
    reopen: "AI_HANDLING",
};

export const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
    AI_HANDLING: { label: "IA", color: "#10b981" },
    HUMAN_HANDLING: { label: "Humano", color: "#3b82f6" },
    CLOSED: { label: "Fechada", color: "#64748b" },
    OPEN: { label: "Aberta", color: "#f59e0b" },
};

// Mensagens de erro amigáveis
export const ERROR_MESSAGES: Record<string, string> = {
    NETWORK: "Sem conexão com a internet. Verifique sua rede.",
    SESSION_EXPIRED: "Sessão WhatsApp desconectada. Reconecte.",
    RATE_LIMIT: "Muitas mensagens. Aguarde um momento.",
    AI_HANDLING: "Clique em 'Assumir' antes de responder.",
    VALIDATION: "Mensagem inválida. Verifique o conteúdo.",
    DEFAULT: "Ocorreu um erro. Tente novamente.",
};

// Mensagens de confirmação para ações
export const ACTION_CONFIRMATIONS: Partial<Record<ConversationAction, string>> = {
    close: "Tem certeza que deseja fechar esta conversa?",
    returnAI: "Devolver conversa para a IA?",
};

// ============================================
// FUNÇÕES UTILITÁRIAS
// ============================================

export const getErrorMessage = (error: unknown): string => {
    if (typeof error === "string") return ERROR_MESSAGES[error] || error;
    if (error instanceof Error) {
        if (error.message.includes("fetch")) return ERROR_MESSAGES.NETWORK;
        return error.message;
    }
    return ERROR_MESSAGES.DEFAULT;
};

export const getStatusConfig = (status: string) => {
    const config = STATUS_CONFIG[status] || STATUS_CONFIG.OPEN;
    return { label: config.label, color: config.color };
};

// ============================================
// CONSTANTES NUMÉRICAS
// ============================================

export const NOTIFICATION_BEEP_FREQUENCY = 800; // Hz
export const NOTIFICATION_VOLUME = 0.3; // 0-1
export const NOTIFICATION_BEEP_DURATION = 0.15; // segundos
export const POLLING_INTERVAL_CONNECTED = 30000; // 30s
export const POLLING_INTERVAL_DISCONNECTED = 5000; // 5s
export const MESSAGES_POLLING_INTERVAL = 3000; // 3s
export const SCROLL_BOTTOM_THRESHOLD = 100; // pixels
