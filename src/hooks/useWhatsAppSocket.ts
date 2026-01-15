/**
 * useWhatsAppSocket Hook
 * 
 * Manages WebSocket connection for WhatsApp session status updates.
 * Replaces polling with real-time updates.
 */

"use client";

import { useEffect, useRef, useCallback, useState } from "react";
import { io, Socket } from "socket.io-client";

interface WhatsAppStatusEvent {
    sessionId: string;
    status: "DISCONNECTED" | "CONNECTING" | "QR_CODE" | "CONNECTED" | "ERROR";
    qrCode?: string;
}

interface UseWhatsAppSocketOptions {
    companyId: string | null;
    onStatusChange?: (event: WhatsAppStatusEvent) => void;
    onQRCode?: (sessionId: string, qrCode: string) => void;
    onConnected?: (sessionId: string) => void;
    onDisconnected?: (sessionId: string) => void;
    onError?: (sessionId: string) => void;
}

export function useWhatsAppSocket(options: UseWhatsAppSocketOptions) {
    const {
        companyId,
        onStatusChange,
        onQRCode,
        onConnected,
        onDisconnected,
        onError,
    } = options;

    const socketRef = useRef<Socket | null>(null);
    const [isConnected, setIsConnected] = useState(false);

    const connect = useCallback(() => {
        if (!companyId || socketRef.current?.connected) return;

        const socket = io({
            path: "/socket.io",
            transports: ["websocket", "polling"],
        });

        socket.on("connect", () => {
            console.log("[WhatsAppSocket] Connected");
            setIsConnected(true);
            socket.emit("join:company", companyId);
        });

        socket.on("whatsapp:status", (data: WhatsAppStatusEvent) => {
            console.log("[WhatsAppSocket] Status update:", data);

            onStatusChange?.(data);

            if (data.status === "QR_CODE" && data.qrCode) {
                onQRCode?.(data.sessionId, data.qrCode);
            } else if (data.status === "CONNECTED") {
                onConnected?.(data.sessionId);
            } else if (data.status === "DISCONNECTED") {
                onDisconnected?.(data.sessionId);
            } else if (data.status === "ERROR") {
                onError?.(data.sessionId);
            }
        });

        socket.on("disconnect", () => {
            console.log("[WhatsAppSocket] Disconnected");
            setIsConnected(false);
        });

        socketRef.current = socket;
    }, [companyId, onStatusChange, onQRCode, onConnected, onDisconnected, onError]);

    const disconnect = useCallback(() => {
        if (socketRef.current) {
            socketRef.current.disconnect();
            socketRef.current = null;
            setIsConnected(false);
        }
    }, []);

    useEffect(() => {
        connect();
        return () => disconnect();
    }, [connect, disconnect]);

    const getSocket = useCallback(() => socketRef.current, []);

    return {
        getSocket,
        isConnected,
        reconnect: connect,
    };
}
