/**
 * WPPConnect Types
 * 
 * Interfaces tipadas para as respostas do WPPConnect Server.
 * Melhora IntelliSense e previne erros de tipo.
 */

// ============================================
// CONTACTS
// ============================================

export interface WPPContact {
    id: string;
    name: string;
    shortName?: string;
    pushname?: string;
    isMyContact: boolean;
    isWAContact: boolean;
    isGroup: boolean;
    isBusiness?: boolean;
    profilePicThumb?: string;
}

// ============================================
// MESSAGES
// ============================================

export type WPPMessageType =
    | "chat"
    | "image"
    | "audio"
    | "ptt"      // push-to-talk (voice message)
    | "video"
    | "document"
    | "sticker"
    | "location"
    | "vcard"
    | "revoked";

export interface WPPMessage {
    id: string;
    body: string;
    type: WPPMessageType;
    from: string;
    to: string;
    author?: string;        // For group messages
    timestamp: number;
    isForwarded: boolean;
    isFromMe: boolean;
    hasMedia: boolean;
    mediaUrl?: string;
    mimetype?: string;
    filename?: string;
    caption?: string;       // For media messages
    quotedMsgId?: string;   // Reply to message
}

// ============================================
// SESSION
// ============================================

export type WPPSessionStatus =
    | "CONNECTED"
    | "DISCONNECTED"
    | "CONNECTING"
    | "QR_CODE"
    | "ERROR";

export interface WPPSessionInfo {
    session: string;
    status: WPPSessionStatus;
    connected: boolean;
    phone?: string;
    qrcode?: string;
    urlcode?: string;
}

// ============================================
// API RESPONSES
// ============================================

export interface WPPApiResponse<T = unknown> {
    status: "success" | "error";
    response?: T;
    message?: string;
    token?: string;
}

export interface WPPSendMessageResponse {
    id: string;
    from: string;
    to: string;
    timestamp: number;
}

export interface WPPConnectionCheckResponse {
    status: boolean;
    message: string;
    session: string;
}

export interface WPPProfilePicResponse {
    eurl?: string;
    imgFull?: string;
}

// ============================================
// WEBHOOK EVENTS
// ============================================

export interface WPPWebhookMessage {
    event: string;
    session: string;
    data: {
        id: string;
        from: string;
        to: string;
        body?: string;
        type: WPPMessageType;
        timestamp: number;
        isGroupMsg: boolean;
        sender?: {
            id: string;
            name: string;
            pushname?: string;
        };
        // Media fields
        isMedia?: boolean;
        mimetype?: string;
        mediaUrl?: string;
        base64?: string;
    };
}

// ============================================
// TOKEN
// ============================================

export interface WPPTokenData {
    token: string;
    createdAt: number;
    expiresAt?: number;
}
