"use client";

/**
 * GlobalNotificationProvider
 * 
 * Componente que fica no layout do dashboard para receber
 * mensagens em tempo real em TODAS as páginas.
 * 
 * Funcionalidades:
 * - Conecta ao WebSocket automaticamente
 * - Mostra notificações de novas mensagens
 * - Toca som de notificação
 * - Atualiza contador de mensagens não lidas
 */

import { useEffect, useState, useCallback } from "react";
import { useConversationsListSocket } from "@/lib/socket-client";
import { notifyNewMessage, initNotifications } from "@/lib/notifications";
import { MessageCircle } from "lucide-react";



interface GlobalNotificationProviderProps {
    companyId: string;
    children: React.ReactNode;
}

export function GlobalNotificationProvider({ companyId, children }: GlobalNotificationProviderProps) {
    const [, setUnreadCount] = useState(0);
    const [lastMessage, setLastMessage] = useState<{ customerName: string; preview: string } | null>(null);
    const [showToast, setShowToast] = useState(false);

    // Inicializa notificações
    useEffect(() => {
        initNotifications().then(result => {
            console.log("[GlobalNotifications] Initialized:", result);
        });
    }, []);

    const playNotificationSound = useCallback(() => {
        try {
            const AudioContext = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof window.AudioContext }).webkitAudioContext;
            if (AudioContext) {
                const audioCtx = new AudioContext();
                const oscillator = audioCtx.createOscillator();
                const gainNode = audioCtx.createGain();
                oscillator.connect(gainNode);
                gainNode.connect(audioCtx.destination);
                oscillator.frequency.value = 800;
                gainNode.gain.value = 0.3;
                oscillator.start();
                oscillator.stop(audioCtx.currentTime + 0.15);
            }
        } catch {
            console.log("[GlobalNotifications] Audio not available");
        }
    }, []);

    // Conecta ao WebSocket para receber mensagens em tempo real
    useConversationsListSocket({
        companyId,
        onNewMessage: (conversationId, message) => {
            console.log("[GlobalNotifications] New message received:", message.content?.substring(0, 30));

            // Só notifica mensagens de clientes
            if (message.sender === "CUSTOMER") {
                setUnreadCount(prev => prev + 1);

                // Mostra toast in-app
                setLastMessage({
                    customerName: "Cliente",
                    preview: message.content?.substring(0, 50) || "Nova mensagem"
                });
                setShowToast(true);
                setTimeout(() => setShowToast(false), 4000);

                // Toca som
                playNotificationSound();

                // Mostra notificação do sistema (se permitido)
                notifyNewMessage({
                    customerName: "Cliente",
                    messagePreview: message.content || "Nova mensagem",
                    conversationId,
                });
            }
        },
        onNewConversation: (conv) => {
            console.log("[GlobalNotifications] New conversation:", conv.customerPhone);
            setUnreadCount(prev => prev + 1);

            setLastMessage({
                customerName: conv.customerName || conv.customerPhone,
                preview: "Nova conversa iniciada"
            });
            setShowToast(true);
            setTimeout(() => setShowToast(false), 4000);

            playNotificationSound();
        },
    });

    return (
        <>
            {children}

            {/* Toast de notificação in-app */}
            {showToast && lastMessage && (
                <div style={{
                    position: "fixed",
                    bottom: 24,
                    right: 24,
                    background: "linear-gradient(135deg, #1e293b 0%, #0f172a 100%)",
                    border: "1px solid rgba(16, 185, 129, 0.3)",
                    borderRadius: 12,
                    padding: "16px 20px",
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                    boxShadow: "0 10px 40px rgba(0, 0, 0, 0.5)",
                    zIndex: 9999,
                    animation: "slideIn 0.3s ease",
                    maxWidth: 320,
                }}>
                    <div style={{
                        width: 40,
                        height: 40,
                        borderRadius: "50%",
                        background: "linear-gradient(135deg, #10b981, #059669)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        flexShrink: 0,
                    }}>
                        <MessageCircle size={20} color="white" />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{
                            fontWeight: 600,
                            color: "white",
                            fontSize: 14,
                            marginBottom: 2
                        }}>
                            {lastMessage.customerName}
                        </div>
                        <div style={{
                            color: "#94a3b8",
                            fontSize: 13,
                            whiteSpace: "nowrap",
                            overflow: "hidden",
                            textOverflow: "ellipsis"
                        }}>
                            {lastMessage.preview}
                        </div>
                    </div>
                    <button
                        onClick={() => setShowToast(false)}
                        style={{
                            background: "transparent",
                            border: "none",
                            color: "#64748b",
                            cursor: "pointer",
                            padding: 4,
                        }}
                    >
                        ✕
                    </button>
                </div>
            )}

            <style jsx global>{`
                @keyframes slideIn {
                    from {
                        transform: translateX(100%);
                        opacity: 0;
                    }
                    to {
                        transform: translateX(0);
                        opacity: 1;
                    }
                }
            `}</style>
        </>
    );
}
