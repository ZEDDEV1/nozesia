"use client";

import { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
    Clock,
    Search,
    User,
    Phone,
    MessageCircle,
    CheckCircle,
    ExternalLink,
    AlertCircle,
    RefreshCw,
} from "lucide-react";
import { StatCard } from "@/components/stat-card";
import Link from "next/link";

interface AwaitingConversation {
    id: string;
    customerPhone: string;
    customerName: string | null;
    lastMessage: string;
    lastMessageAt: string;
    status: string;
    needsInfoReason: string | null;
    createdAt: string;
}

export default function AwaitingResponsePage() {
    const [conversations, setConversations] = useState<AwaitingConversation[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState("");

    const fetchConversations = async () => {
        try {
            setLoading(true);
            const res = await fetch("/api/conversations?status=WAITING_RESPONSE");
            const response = await res.json();
            if (response.success) {
                // A API retorna { success, data: { data: [...], pagination: {...} } }
                const conversations = response.data?.data || response.data || [];
                setConversations(Array.isArray(conversations) ? conversations : []);
            }
        } catch (error) {
            console.error("Error fetching awaiting conversations:", error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchConversations();
        // Refresh every 30 seconds
        const interval = setInterval(fetchConversations, 30000);
        return () => clearInterval(interval);
    }, []);

    const filteredConversations = useMemo(() => {
        if (!searchTerm) return conversations;
        const term = searchTerm.toLowerCase();
        return conversations.filter(
            (c) =>
                c.customerName?.toLowerCase().includes(term) ||
                c.customerPhone.includes(term) ||
                c.lastMessage?.toLowerCase().includes(term)
        );
    }, [conversations, searchTerm]);

    const getRelativeTime = (dateStr: string) => {
        const date = new Date(dateStr);
        const now = new Date();
        const diff = Math.floor((now.getTime() - date.getTime()) / 1000);

        if (diff < 60) return "Agora";
        if (diff < 3600) return `${Math.floor(diff / 60)}min`;
        if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
        return `${Math.floor(diff / 86400)}d`;
    };

    const handleMarkResolved = async (id: string) => {
        try {
            await fetch(`/api/conversations/${id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ status: "AI_HANDLING" }),
            });
            fetchConversations();
        } catch (error) {
            console.error("Error marking as resolved:", error);
        }
    };

    return (
        <div style={{ padding: "1.5rem" }}>
            {/* Header */}
            <div style={{ marginBottom: "2rem" }}>
                <h1
                    style={{
                        fontSize: "1.875rem",
                        fontWeight: 700,
                        color: "white",
                        marginBottom: "0.5rem",
                    }}
                >
                    ⏳ Esperando Resposta
                </h1>
                <p style={{ color: "#94a3b8" }}>
                    Conversas onde a IA precisa de informações adicionais
                </p>
            </div>

            {/* Stats */}
            <div
                style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
                    gap: "1rem",
                    marginBottom: "2rem",
                }}
            >
                <StatCard
                    title="Aguardando"
                    value={conversations.length}
                    icon={Clock}
                    color="amber"
                />
            </div>

            {/* Search and Refresh */}
            <div
                style={{
                    display: "flex",
                    gap: "1rem",
                    marginBottom: "1.5rem",
                    flexWrap: "wrap",
                }}
            >
                <div
                    style={{
                        flex: 1,
                        minWidth: "200px",
                        position: "relative",
                    }}
                >
                    <Search
                        style={{
                            position: "absolute",
                            left: "1rem",
                            top: "50%",
                            transform: "translateY(-50%)",
                            color: "#64748b",
                            width: 18,
                            height: 18,
                        }}
                    />
                    <input
                        type="text"
                        placeholder="Buscar por nome ou telefone..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        style={{
                            width: "100%",
                            padding: "0.75rem 1rem 0.75rem 2.75rem",
                            background: "rgba(255,255,255,0.05)",
                            border: "1px solid rgba(255,255,255,0.1)",
                            borderRadius: "12px",
                            color: "white",
                            fontSize: "0.875rem",
                        }}
                    />
                </div>
                <button
                    onClick={fetchConversations}
                    className="dash-btn secondary"
                    style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}
                >
                    <RefreshCw size={16} />
                    Atualizar
                </button>
            </div>

            {/* Conversations List */}
            <div
                style={{
                    background: "rgba(255,255,255,0.02)",
                    borderRadius: "16px",
                    border: "1px solid rgba(255,255,255,0.1)",
                    overflow: "hidden",
                }}
            >
                {loading ? (
                    <div
                        style={{
                            padding: "3rem",
                            textAlign: "center",
                            color: "#64748b",
                        }}
                    >
                        <RefreshCw
                            style={{
                                width: 32,
                                height: 32,
                                margin: "0 auto 1rem",
                                animation: "spin 1s linear infinite",
                            }}
                        />
                        <p>Carregando...</p>
                    </div>
                ) : filteredConversations.length === 0 ? (
                    <div
                        style={{
                            padding: "3rem",
                            textAlign: "center",
                            color: "#64748b",
                        }}
                    >
                        <CheckCircle
                            style={{
                                width: 48,
                                height: 48,
                                margin: "0 auto 1rem",
                                color: "#10b981",
                            }}
                        />
                        <p style={{ fontSize: "1.125rem", marginBottom: "0.5rem" }}>
                            Tudo em dia! 🎉
                        </p>
                        <p>Não há conversas aguardando resposta</p>
                    </div>
                ) : (
                    <AnimatePresence>
                        {filteredConversations.map((conv, index) => (
                            <motion.div
                                key={conv.id}
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -10 }}
                                transition={{ delay: index * 0.05 }}
                                style={{
                                    padding: "1rem 1.5rem",
                                    borderBottom: "1px solid rgba(255,255,255,0.05)",
                                    display: "flex",
                                    alignItems: "center",
                                    gap: "1rem",
                                }}
                            >
                                {/* Avatar */}
                                <div
                                    style={{
                                        width: 48,
                                        height: 48,
                                        borderRadius: "12px",
                                        background: "linear-gradient(135deg, #f97316, #ea580c)",
                                        display: "flex",
                                        alignItems: "center",
                                        justifyContent: "center",
                                        flexShrink: 0,
                                    }}
                                >
                                    <AlertCircle style={{ color: "white", width: 24, height: 24 }} />
                                </div>

                                {/* Info */}
                                <div style={{ flex: 1, minWidth: 0 }}>
                                    <div
                                        style={{
                                            display: "flex",
                                            alignItems: "center",
                                            gap: "0.5rem",
                                            marginBottom: "0.25rem",
                                        }}
                                    >
                                        <span style={{ color: "white", fontWeight: 600 }}>
                                            {conv.customerName || "Cliente"}
                                        </span>
                                        <span
                                            style={{
                                                fontSize: "0.75rem",
                                                color: "#64748b",
                                            }}
                                        >
                                            {getRelativeTime(conv.lastMessageAt)}
                                        </span>
                                    </div>
                                    <div
                                        style={{
                                            display: "flex",
                                            alignItems: "center",
                                            gap: "0.5rem",
                                            color: "#94a3b8",
                                            fontSize: "0.875rem",
                                        }}
                                    >
                                        <Phone size={14} />
                                        {conv.customerPhone}
                                    </div>
                                    {conv.lastMessage && (
                                        <p
                                            style={{
                                                color: "#64748b",
                                                fontSize: "0.813rem",
                                                marginTop: "0.5rem",
                                                overflow: "hidden",
                                                textOverflow: "ellipsis",
                                                whiteSpace: "nowrap",
                                            }}
                                        >
                                            <MessageCircle
                                                size={12}
                                                style={{ display: "inline", marginRight: "0.5rem" }}
                                            />
                                            {conv.lastMessage}
                                        </p>
                                    )}
                                    {conv.needsInfoReason && (
                                        <p
                                            style={{
                                                color: "#f97316",
                                                fontSize: "0.75rem",
                                                marginTop: "0.5rem",
                                                background: "rgba(249, 115, 22, 0.1)",
                                                padding: "0.25rem 0.5rem",
                                                borderRadius: "4px",
                                                display: "inline-block",
                                            }}
                                        >
                                            ⚠️ {conv.needsInfoReason}
                                        </p>
                                    )}
                                </div>

                                {/* Actions */}
                                <div style={{ display: "flex", gap: "0.5rem" }}>
                                    <Link href={`/dashboard/conversations?id=${conv.id}`}>
                                        <button
                                            className="dash-btn secondary"
                                            style={{
                                                padding: "0.5rem 1rem",
                                                fontSize: "0.813rem",
                                            }}
                                        >
                                            <ExternalLink size={14} />
                                            Ver conversa
                                        </button>
                                    </Link>
                                    <button
                                        onClick={() => handleMarkResolved(conv.id)}
                                        className="dash-btn primary"
                                        style={{
                                            padding: "0.5rem 1rem",
                                            fontSize: "0.813rem",
                                        }}
                                    >
                                        <CheckCircle size={14} />
                                        Resolvido
                                    </button>
                                </div>
                            </motion.div>
                        ))}
                    </AnimatePresence>
                )}
            </div>
        </div>
    );
}
