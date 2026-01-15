/**
 * Centralized Type Definitions - Conversation Types
 * 
 * Re-usable types for conversations and messages across the application.
 */

export type ConversationStatus = "OPEN" | "AI_HANDLING" | "HUMAN_HANDLING" | "CLOSED";

export type MessageType = "TEXT" | "IMAGE" | "AUDIO" | "VIDEO" | "DOCUMENT" | "STICKER";

export type MessageSender = "CUSTOMER" | "AI" | "HUMAN";

export interface Message {
    id: string;
    content: string;
    sender: MessageSender;
    type: MessageType;
    createdAt: string;
    isRead: boolean;
    mediaUrl?: string | null;
}

export interface Conversation {
    id: string;
    customerName: string | null;
    customerPhone: string;
    status: ConversationStatus;
    unreadCount: number;
    lastMessageAt: string;
    agent?: {
        id: string;
        name: string;
    } | null;
    session?: {
        id: string;
        sessionName: string;
        phoneNumber: string | null;
    } | null;
    messages?: Message[];
}

export interface RecentConversation {
    id: string;
    customerName: string;
    customerPhone: string;
    lastMessage: string;
    lastMessageAt: string;
    unreadCount: number;
    status: ConversationStatus;
}
