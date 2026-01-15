"use client";

import { useState, useEffect } from "react";
import { Smartphone, Wifi, WifiOff, Clock, MessageCircle, Users, Bot } from "lucide-react";

interface SessionStats {
    totalConversations: number;
    todayMessages: number;
    activeCustomers: number;
    avgResponseTime: number;
    lastSeen: string | null;
}

interface WhatsAppSessionPreviewProps {
    sessionId: string;
    sessionName: string;
    phoneNumber: string | null;
    status: "DISCONNECTED" | "CONNECTING" | "QR_CODE" | "CONNECTED" | "ERROR";
    agentName?: string;
}

export function WhatsAppSessionPreview({
    sessionId,
    sessionName,
    phoneNumber,
    status,
    agentName,
}: WhatsAppSessionPreviewProps) {
    const [stats, setStats] = useState<SessionStats | null>(null);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (status === "CONNECTED") {
            fetchStats();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [sessionId, status]);

    const fetchStats = async () => {
        setLoading(true);
        try {
            const res = await fetch(`/api/whatsapp/sessions/${sessionId}/stats`);
            const data = await res.json();
            if (data.success) {
                setStats(data.data);
            }
        } catch (error) {
            console.error("Error fetching stats:", error);
        } finally {
            setLoading(false);
        }
    };

    const formatTime = (seconds: number) => {
        if (seconds < 60) return `${seconds}s`;
        return `${Math.floor(seconds / 60)}m`;
    };

    const formatLastSeen = (date: string | null) => {
        if (!date) return "Nunca";
        return new Date(date).toLocaleString("pt-BR", {
            day: "2-digit",
            month: "short",
            hour: "2-digit",
            minute: "2-digit",
        });
    };

    const isConnected = status === "CONNECTED";

    return (
        <div style={{
            background: "linear-gradient(135deg, rgba(37, 211, 102, 0.05) 0%, rgba(0,0,0,0.1) 100%)",
            border: `1px solid ${isConnected ? "rgba(37, 211, 102, 0.3)" : "rgba(255,255,255,0.1)"}`,
            borderRadius: 12,
            padding: "1rem",
            marginTop: "0.5rem",
        }}>
            {/* Phone mockup header */}
            <div style={{
                display: "flex",
                alignItems: "center",
                gap: "0.75rem",
                marginBottom: "1rem",
                paddingBottom: "0.75rem",
                borderBottom: "1px solid rgba(255,255,255,0.1)",
            }}>
                <div style={{
                    width: 40,
                    height: 40,
                    borderRadius: 10,
                    background: isConnected ? "#25D366" : "#475569",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                }}>
                    <Smartphone size={20} style={{ color: "white" }} />
                </div>
                <div style={{ flex: 1 }}>
                    <p style={{ color: "#e2e8f0", fontWeight: 600, margin: 0, fontSize: "0.95rem" }}>
                        {sessionName}
                    </p>
                    <p style={{ color: "#64748b", fontSize: "0.8rem", margin: 0 }}>
                        {phoneNumber || "Número não vinculado"}
                    </p>
                </div>
                {isConnected ? (
                    <Wifi size={18} style={{ color: "#25D366" }} />
                ) : (
                    <WifiOff size={18} style={{ color: "#64748b" }} />
                )}
            </div>

            {/* Stats grid (only when connected) */}
            {isConnected && (
                <div style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(2, 1fr)",
                    gap: "0.5rem",
                }}>
                    <div style={{
                        padding: "0.5rem",
                        background: "rgba(0,0,0,0.2)",
                        borderRadius: 6,
                        textAlign: "center",
                    }}>
                        <MessageCircle size={14} style={{ color: "#3b82f6", marginBottom: 2 }} />
                        <p style={{ color: "#e2e8f0", fontSize: "1rem", fontWeight: 600, margin: 0 }}>
                            {loading ? "..." : (stats?.todayMessages ?? 0)}
                        </p>
                        <p style={{ color: "#64748b", fontSize: "0.7rem", margin: 0 }}>Msgs Hoje</p>
                    </div>
                    <div style={{
                        padding: "0.5rem",
                        background: "rgba(0,0,0,0.2)",
                        borderRadius: 6,
                        textAlign: "center",
                    }}>
                        <Users size={14} style={{ color: "#10b981", marginBottom: 2 }} />
                        <p style={{ color: "#e2e8f0", fontSize: "1rem", fontWeight: 600, margin: 0 }}>
                            {loading ? "..." : (stats?.activeCustomers ?? 0)}
                        </p>
                        <p style={{ color: "#64748b", fontSize: "0.7rem", margin: 0 }}>Ativos</p>
                    </div>
                    <div style={{
                        padding: "0.5rem",
                        background: "rgba(0,0,0,0.2)",
                        borderRadius: 6,
                        textAlign: "center",
                    }}>
                        <Clock size={14} style={{ color: "#f59e0b", marginBottom: 2 }} />
                        <p style={{ color: "#e2e8f0", fontSize: "1rem", fontWeight: 600, margin: 0 }}>
                            {loading ? "..." : formatTime(stats?.avgResponseTime ?? 0)}
                        </p>
                        <p style={{ color: "#64748b", fontSize: "0.7rem", margin: 0 }}>Tempo Resp.</p>
                    </div>
                    <div style={{
                        padding: "0.5rem",
                        background: "rgba(0,0,0,0.2)",
                        borderRadius: 6,
                        textAlign: "center",
                    }}>
                        <Bot size={14} style={{ color: "#a78bfa", marginBottom: 2 }} />
                        <p style={{ color: "#e2e8f0", fontSize: "0.8rem", fontWeight: 500, margin: 0, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                            {agentName || "Nenhum"}
                        </p>
                        <p style={{ color: "#64748b", fontSize: "0.7rem", margin: 0 }}>Agente</p>
                    </div>
                </div>
            )}

            {/* Disconnected state */}
            {!isConnected && (
                <div style={{ textAlign: "center", padding: "1rem 0" }}>
                    <WifiOff size={32} style={{ color: "#475569", marginBottom: "0.5rem" }} />
                    <p style={{ color: "#64748b", fontSize: "0.85rem", margin: 0 }}>
                        {status === "CONNECTING" ? "Conectando..." :
                            status === "QR_CODE" ? "Aguardando QR Code" :
                                status === "ERROR" ? "Erro de conexão" : "Desconectado"}
                    </p>
                </div>
            )}

            {/* Last seen */}
            {stats?.lastSeen && (
                <div style={{
                    marginTop: "0.75rem",
                    paddingTop: "0.5rem",
                    borderTop: "1px solid rgba(255,255,255,0.05)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: "0.5rem",
                }}>
                    <Clock size={12} style={{ color: "#475569" }} />
                    <span style={{ color: "#475569", fontSize: "0.7rem" }}>
                        Última atividade: {formatLastSeen(stats.lastSeen)}
                    </span>
                </div>
            )}
        </div>
    );
}
