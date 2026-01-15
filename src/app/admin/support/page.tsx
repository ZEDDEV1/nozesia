"use client";

import { useState, useEffect } from "react";
import {
    MessageCircle,
    User,
    Bot,
    Clock,
    AlertCircle,
    CheckCircle,
    Send,
    ArrowLeft,
    Filter,
} from "lucide-react";
import Link from "next/link";

interface Message {
    id: string;
    sender: string;
    content: string;
    createdAt: string;
}

interface Ticket {
    id: string;
    status: string;
    priority: string;
    category: string | null;
    subject: string | null;
    createdAt: string;
    updatedAt: string;
    resolvedAt: string | null;
    company: { name: string };
    user: { name: string; email: string };
    messages: Message[];
    _count: { messages: number };
}

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; icon: React.ElementType }> = {
    AI_HANDLING: { label: "IA Atendendo", color: "#8b5cf6", bg: "rgba(139, 92, 246, 0.15)", icon: Bot },
    HUMAN_HANDLING: { label: "Suporte Humano", color: "#f59e0b", bg: "rgba(245, 158, 11, 0.15)", icon: User },
    WAITING_USER: { label: "Aguardando Cliente", color: "#3b82f6", bg: "rgba(59, 130, 246, 0.15)", icon: Clock },
    RESOLVED: { label: "Resolvido", color: "#10b981", bg: "rgba(16, 185, 129, 0.15)", icon: CheckCircle },
};

const PRIORITY_CONFIG: Record<string, { label: string; color: string }> = {
    LOW: { label: "Baixa", color: "#64748b" },
    NORMAL: { label: "Normal", color: "#3b82f6" },
    HIGH: { label: "Alta", color: "#f59e0b" },
    URGENT: { label: "Urgente", color: "#ef4444" },
};

export default function AdminSupportPage() {
    const [tickets, setTickets] = useState<Ticket[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
    const [filter, setFilter] = useState("all");
    const [replyText, setReplyText] = useState("");
    const [sending, setSending] = useState(false);

    useEffect(() => {
        fetchTickets();
    }, []);

    const fetchTickets = async () => {
        try {
            const res = await fetch("/api/admin/support");
            const data = await res.json();
            if (data.success) {
                setTickets(data.data);
            }
        } catch (error) {
            console.error("Failed to fetch tickets", error);
        } finally {
            setLoading(false);
        }
    };

    const handleReply = async () => {
        if (!selectedTicket || !replyText.trim() || sending) return;

        setSending(true);
        try {
            const res = await fetch("/api/admin/support", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    ticketId: selectedTicket.id,
                    message: replyText.trim(),
                }),
            });
            const data = await res.json();
            if (data.success) {
                setReplyText("");
                // Atualizar ticket na lista
                setSelectedTicket(data.data);
                fetchTickets();
            }
        } catch (error) {
            console.error("Failed to send reply", error);
        } finally {
            setSending(false);
        }
    };

    const handleResolve = async () => {
        if (!selectedTicket) return;

        try {
            const res = await fetch("/api/admin/support", {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    ticketId: selectedTicket.id,
                    status: "RESOLVED",
                }),
            });
            const data = await res.json();
            if (data.success) {
                setSelectedTicket(null);
                fetchTickets();
            }
        } catch (error) {
            console.error("Failed to resolve ticket", error);
        }
    };

    const filteredTickets = filter === "all"
        ? tickets
        : tickets.filter(t => t.status === filter);

    const formatDate = (date: string) => {
        return new Date(date).toLocaleString("pt-BR", {
            day: "2-digit",
            month: "2-digit",
            hour: "2-digit",
            minute: "2-digit",
        });
    };

    return (
        <div className="dashboard-page">
            {/* Header */}
            <div className="dash-page-header">
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <Link href="/admin" className="dash-btn secondary" style={{ padding: 8 }}>
                        <ArrowLeft size={20} />
                    </Link>
                    <div>
                        <h1 className="dash-page-title" style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            <MessageCircle style={{ color: "#8b5cf6" }} />
                            Tickets de Suporte
                        </h1>
                        <p className="dash-page-subtitle">
                            Gerencie solicitações de suporte dos usuários
                        </p>
                    </div>
                </div>
            </div>

            {/* Stats */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "1rem", marginBottom: "1.5rem" }}>
                {Object.entries(STATUS_CONFIG).map(([key, config]) => {
                    const count = tickets.filter(t => t.status === key).length;
                    const Icon = config.icon;
                    return (
                        <div key={key} className="panel-card" style={{ padding: "1rem" }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                                <div style={{
                                    width: 40,
                                    height: 40,
                                    borderRadius: "50%",
                                    background: config.bg,
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                }}>
                                    <Icon size={20} style={{ color: config.color }} />
                                </div>
                                <div>
                                    <div style={{ fontSize: "1.5rem", fontWeight: 700, color: config.color }}>{count}</div>
                                    <div style={{ fontSize: "0.75rem", color: "#94a3b8" }}>{config.label}</div>
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>

            <div style={{ display: "grid", gridTemplateColumns: selectedTicket ? "1fr 1fr" : "1fr", gap: "1.5rem" }}>
                {/* Tickets List */}
                <div className="panel-card">
                    <div style={{ padding: "1rem", borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            <Filter size={16} style={{ color: "#64748b" }} />
                            <select
                                value={filter}
                                onChange={(e) => setFilter(e.target.value)}
                                className="dash-input"
                                style={{ flex: 1 }}
                            >
                                <option value="all">Todos os tickets</option>
                                <option value="HUMAN_HANDLING">Aguardando resposta</option>
                                <option value="AI_HANDLING">IA atendendo</option>
                                <option value="RESOLVED">Resolvidos</option>
                            </select>
                        </div>
                    </div>

                    <div style={{ maxHeight: 500, overflowY: "auto" }}>
                        {loading ? (
                            <div style={{ padding: "2rem", textAlign: "center", color: "#64748b" }}>
                                Carregando tickets...
                            </div>
                        ) : filteredTickets.length === 0 ? (
                            <div style={{ padding: "2rem", textAlign: "center", color: "#64748b" }}>
                                <AlertCircle size={40} style={{ marginBottom: 12, opacity: 0.5 }} />
                                <p>Nenhum ticket encontrado</p>
                            </div>
                        ) : (
                            filteredTickets.map((ticket) => {
                                const config = STATUS_CONFIG[ticket.status];
                                const priorityConfig = PRIORITY_CONFIG[ticket.priority];
                                return (
                                    <div
                                        key={ticket.id}
                                        onClick={() => setSelectedTicket(ticket)}
                                        style={{
                                            padding: "1rem",
                                            borderBottom: "1px solid rgba(255,255,255,0.05)",
                                            cursor: "pointer",
                                            background: selectedTicket?.id === ticket.id ? "rgba(139, 92, 246, 0.1)" : "transparent",
                                            transition: "background 0.2s",
                                        }}
                                    >
                                        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                                            <span style={{ color: "white", fontWeight: 500 }}>
                                                {ticket.company.name}
                                            </span>
                                            <span style={{
                                                fontSize: "0.7rem",
                                                padding: "2px 8px",
                                                borderRadius: 12,
                                                background: config.bg,
                                                color: config.color,
                                            }}>
                                                {config.label}
                                            </span>
                                        </div>
                                        <div style={{ fontSize: "0.875rem", color: "#94a3b8", marginBottom: 4 }}>
                                            {ticket.user.email}
                                        </div>
                                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                            <span style={{ fontSize: "0.75rem", color: "#64748b" }}>
                                                {formatDate(ticket.createdAt)} • {ticket._count.messages} msgs
                                            </span>
                                            <span style={{
                                                fontSize: "0.65rem",
                                                padding: "2px 6px",
                                                borderRadius: 8,
                                                background: "rgba(255,255,255,0.05)",
                                                color: priorityConfig.color,
                                            }}>
                                                {priorityConfig.label}
                                            </span>
                                        </div>
                                    </div>
                                );
                            })
                        )}
                    </div>
                </div>

                {/* Ticket Detail */}
                {selectedTicket && (
                    <div className="panel-card" style={{ display: "flex", flexDirection: "column" }}>
                        {/* Header */}
                        <div style={{ padding: "1rem", borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                <div>
                                    <h3 style={{ color: "white", margin: 0 }}>{selectedTicket.company.name}</h3>
                                    <p style={{ color: "#64748b", fontSize: "0.875rem", margin: 0 }}>
                                        {selectedTicket.user.email}
                                    </p>
                                </div>
                                <div style={{ display: "flex", gap: 8 }}>
                                    {selectedTicket.status !== "RESOLVED" && (
                                        <button
                                            onClick={handleResolve}
                                            className="dash-btn success"
                                            style={{ fontSize: "0.75rem", padding: "6px 12px" }}
                                        >
                                            <CheckCircle size={14} />
                                            Resolver
                                        </button>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Messages */}
                        <div style={{ flex: 1, overflowY: "auto", padding: "1rem", maxHeight: 350 }}>
                            {selectedTicket.messages.map((msg) => (
                                <div
                                    key={msg.id}
                                    style={{
                                        display: "flex",
                                        gap: 8,
                                        marginBottom: 12,
                                        justifyContent: msg.sender === "USER" ? "flex-start" : "flex-end",
                                    }}
                                >
                                    {msg.sender === "USER" && (
                                        <div style={{
                                            width: 28,
                                            height: 28,
                                            borderRadius: "50%",
                                            background: "#1e293b",
                                            display: "flex",
                                            alignItems: "center",
                                            justifyContent: "center",
                                        }}>
                                            <User size={14} style={{ color: "#94a3b8" }} />
                                        </div>
                                    )}
                                    <div style={{
                                        maxWidth: "75%",
                                        padding: "8px 12px",
                                        borderRadius: 12,
                                        background: msg.sender === "USER"
                                            ? "#1e293b"
                                            : msg.sender === "AI"
                                                ? "linear-gradient(135deg, #8b5cf6 0%, #6366f1 100%)"
                                                : "linear-gradient(135deg, #10b981 0%, #059669 100%)",
                                        color: "white",
                                        fontSize: "0.875rem",
                                    }}>
                                        <p style={{ margin: 0 }}>{msg.content}</p>
                                        <div style={{ fontSize: "0.65rem", opacity: 0.7, marginTop: 4 }}>
                                            {msg.sender === "AI" ? "IA" : msg.sender === "ADMIN" ? "Suporte" : "Cliente"} • {formatDate(msg.createdAt)}
                                        </div>
                                    </div>
                                    {msg.sender !== "USER" && (
                                        <div style={{
                                            width: 28,
                                            height: 28,
                                            borderRadius: "50%",
                                            background: msg.sender === "AI" ? "rgba(139, 92, 246, 0.2)" : "rgba(16, 185, 129, 0.2)",
                                            display: "flex",
                                            alignItems: "center",
                                            justifyContent: "center",
                                        }}>
                                            {msg.sender === "AI" ? (
                                                <Bot size={14} style={{ color: "#8b5cf6" }} />
                                            ) : (
                                                <User size={14} style={{ color: "#10b981" }} />
                                            )}
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>

                        {/* Reply Input */}
                        {selectedTicket.status !== "RESOLVED" && (
                            <div style={{ padding: "1rem", borderTop: "1px solid rgba(255,255,255,0.08)" }}>
                                <div style={{ display: "flex", gap: 8 }}>
                                    <input
                                        type="text"
                                        value={replyText}
                                        onChange={(e) => setReplyText(e.target.value)}
                                        onKeyDown={(e) => e.key === "Enter" && handleReply()}
                                        placeholder="Digite sua resposta..."
                                        className="dash-input"
                                        style={{ flex: 1 }}
                                    />
                                    <button
                                        onClick={handleReply}
                                        disabled={!replyText.trim() || sending}
                                        className="dash-btn primary"
                                    >
                                        <Send size={16} />
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
