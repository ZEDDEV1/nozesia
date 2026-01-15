"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
    ArrowLeft, User, Phone, MessageCircle, ShoppingBag, Calendar,
    Star, Flame, Clock, Moon, Snowflake, Tag, StickyNote, Save,
    ExternalLink, Package, Heart, RefreshCw, DollarSign
} from "lucide-react";

// Types
interface CustomerProfile {
    phone: string;
    name: string;
    segment: "HOT" | "WARM" | "INACTIVE" | "COLD" | "VIP";
    tags: string[];
    optedOut: boolean;
    stats: {
        totalConversations: number;
        totalMessages: number;
        totalOrders: number;
        totalInterests: number;
        totalSpent: number;
        firstContactAt: string;
        lastInteractionAt: string | null;
        lastPurchaseAt: string | null;
    };
    memory: {
        summary: string | null;
        preferences: Record<string, unknown> | null;
        lastProducts: string[] | null;
        notes: string | null;
    };
    conversations: Array<{
        id: string;
        status: string;
        messageCount: number;
        lastMessageAt: string;
        lastMessage: { content: string; sender: string; createdAt: string } | null;
        createdAt: string;
    }>;
    orders: Array<{
        id: string;
        productName: string;
        productPrice: number;
        quantity: number;
        totalAmount: number;
        status: string;
        createdAt: string;
        deliveryType: string | null;
    }>;
    interests: Array<{
        id: string;
        productName: string;
        details: string | null;
        status: string;
        createdAt: string;
    }>;
    timeline: Array<{
        type: "conversation" | "order" | "interest";
        id: string;
        date: string;
        title: string;
        subtitle: string;
        status: string;
    }>;
}

const SEGMENT_CONFIG = {
    VIP: { label: "VIP", icon: Star, color: "#f59e0b", bg: "rgba(245, 158, 11, 0.1)" },
    HOT: { label: "Quente", icon: Flame, color: "#ef4444", bg: "rgba(239, 68, 68, 0.1)" },
    WARM: { label: "Morno", icon: Clock, color: "#22c55e", bg: "rgba(34, 197, 94, 0.1)" },
    INACTIVE: { label: "Inativo", icon: Moon, color: "#a78bfa", bg: "rgba(167, 139, 250, 0.1)" },
    COLD: { label: "Frio", icon: Snowflake, color: "#3b82f6", bg: "rgba(59, 130, 246, 0.1)" },
};

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
    AWAITING_PAYMENT: { label: "Aguardando", color: "#f59e0b" },
    PROOF_SENT: { label: "Comprovante", color: "#3b82f6" },
    VERIFIED: { label: "Verificado", color: "#22c55e" },
    SHIPPED: { label: "Enviado", color: "#8b5cf6" },
    DELIVERED: { label: "Entregue", color: "#10b981" },
    CANCELLED: { label: "Cancelado", color: "#ef4444" },
    NEW: { label: "Novo", color: "#3b82f6" },
    CONTACTED: { label: "Contatado", color: "#f59e0b" },
    CONVERTED: { label: "Convertido", color: "#22c55e" },
    LOST: { label: "Perdido", color: "#64748b" },
};

export default function CustomerProfilePage() {
    const params = useParams();
    const router = useRouter();
    const phone = params.phone as string;

    const [profile, setProfile] = useState<CustomerProfile | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [notes, setNotes] = useState("");
    const [newTag, setNewTag] = useState("");
    const [saving, setSaving] = useState(false);
    const [activeTab, setActiveTab] = useState<"timeline" | "conversations" | "orders" | "interests">("timeline");

    const fetchProfile = useCallback(async () => {
        try {
            setLoading(true);
            const response = await fetch(`/api/customers/${encodeURIComponent(phone)}`);
            const data = await response.json();

            if (data.success) {
                setProfile(data.data);
                setNotes(data.data.memory?.notes || "");
            } else {
                setError(data.error || "Erro ao carregar perfil");
            }
        } catch (err) {
            console.error("Error:", err);
            setError("Erro ao carregar perfil do cliente");
        } finally {
            setLoading(false);
        }
    }, [phone]);

    useEffect(() => {
        if (phone) {
            fetchProfile();
        }
    }, [phone, fetchProfile]);

    const saveNotes = async () => {
        try {
            setSaving(true);
            const response = await fetch(`/api/customers/${encodeURIComponent(phone)}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ notes }),
            });
            const data = await response.json();
            if (!data.success) {
                alert("Erro ao salvar notas");
            }
        } catch (err) {
            console.error("Error:", err);
            alert("Erro ao salvar notas");
        } finally {
            setSaving(false);
        }
    };

    const addTag = async () => {
        if (!newTag.trim() || !profile) return;
        const updatedTags = [...profile.tags, newTag.trim()];
        try {
            setSaving(true);
            const response = await fetch(`/api/customers/${encodeURIComponent(phone)}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ tags: updatedTags }),
            });
            const data = await response.json();
            if (data.success) {
                setProfile({ ...profile, tags: updatedTags });
                setNewTag("");
            }
        } catch (err) {
            console.error("Error:", err);
        } finally {
            setSaving(false);
        }
    };

    const removeTag = async (tagToRemove: string) => {
        if (!profile) return;
        const updatedTags = profile.tags.filter(t => t !== tagToRemove);
        try {
            const response = await fetch(`/api/customers/${encodeURIComponent(phone)}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ tags: updatedTags }),
            });
            const data = await response.json();
            if (data.success) {
                setProfile({ ...profile, tags: updatedTags });
            }
        } catch (err) {
            console.error("Error:", err);
        }
    };

    const formatDate = (dateStr: string | null) => {
        if (!dateStr) return "—";
        return new Date(dateStr).toLocaleDateString("pt-BR", {
            day: "2-digit",
            month: "short",
            year: "numeric",
        });
    };

    const formatDateTime = (dateStr: string) => {
        return new Date(dateStr).toLocaleDateString("pt-BR", {
            day: "2-digit",
            month: "short",
            hour: "2-digit",
            minute: "2-digit",
        });
    };

    const formatCurrency = (value: number) => {
        return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
    };

    if (loading) {
        return (
            <div className="dash-loading">
                <div className="dash-spinner" />
            </div>
        );
    }

    if (error || !profile) {
        return (
            <div className="dash-fade-in">
                <div className="dash-card" style={{ textAlign: "center", padding: "3rem" }}>
                    <User style={{ width: 48, height: 48, color: "#ef4444", margin: "0 auto 1rem" }} />
                    <h3 style={{ color: "white", marginBottom: "0.5rem" }}>{error || "Cliente não encontrado"}</h3>
                    <button onClick={() => router.push("/dashboard/crm")} className="dash-btn secondary">
                        <ArrowLeft style={{ width: 16, height: 16 }} />
                        Voltar ao CRM
                    </button>
                </div>
            </div>
        );
    }

    const segConfig = SEGMENT_CONFIG[profile.segment];
    const SegmentIcon = segConfig.icon;

    return (
        <div className="dash-fade-in">
            {/* Back Button */}
            <div style={{ marginBottom: "1rem" }}>
                <Link href="/dashboard/crm" className="dash-btn secondary" style={{ display: "inline-flex" }}>
                    <ArrowLeft style={{ width: 16, height: 16 }} />
                    Voltar ao CRM
                </Link>
            </div>

            {/* Header */}
            <div className="dash-card" style={{ marginBottom: "1.5rem" }}>
                <div style={{ display: "flex", flexWrap: "wrap", gap: "1.5rem", alignItems: "flex-start" }}>
                    {/* Avatar & Info */}
                    <div style={{ display: "flex", gap: "1rem", alignItems: "center", flex: 1, minWidth: 250 }}>
                        <div style={{
                            width: 64,
                            height: 64,
                            borderRadius: "50%",
                            background: "linear-gradient(135deg, #374151, #1f2937)",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            color: "white",
                            fontWeight: 600,
                            fontSize: "1.5rem",
                        }}>
                            {profile.name[0]?.toUpperCase() || "?"}
                        </div>
                        <div>
                            <h1 style={{ color: "white", fontSize: "1.5rem", fontWeight: 600, marginBottom: "0.25rem" }}>
                                {profile.name}
                            </h1>
                            <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", color: "#94a3b8" }}>
                                <span style={{ display: "flex", alignItems: "center", gap: "0.25rem" }}>
                                    <Phone style={{ width: 14, height: 14 }} />
                                    {profile.phone}
                                </span>
                                <span style={{
                                    display: "inline-flex",
                                    alignItems: "center",
                                    gap: "0.375rem",
                                    padding: "0.25rem 0.75rem",
                                    borderRadius: "999px",
                                    background: segConfig.bg,
                                    color: segConfig.color,
                                    fontSize: "0.75rem",
                                    fontWeight: 500,
                                }}>
                                    <SegmentIcon style={{ width: 12, height: 12 }} />
                                    {segConfig.label}
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* Actions */}
                    <div style={{ display: "flex", gap: "0.5rem" }}>
                        <Link
                            href={`/dashboard/conversations?phone=${profile.phone}`}
                            className="dash-btn primary"
                        >
                            <MessageCircle style={{ width: 16, height: 16 }} />
                            Ver Conversas
                        </Link>
                        <button onClick={fetchProfile} className="dash-btn secondary">
                            <RefreshCw style={{ width: 16, height: 16 }} />
                        </button>
                    </div>
                </div>

                {/* Tags */}
                <div style={{ marginTop: "1rem", display: "flex", flexWrap: "wrap", gap: "0.5rem", alignItems: "center" }}>
                    <Tag style={{ width: 14, height: 14, color: "#64748b" }} />
                    {profile.tags.map(tag => (
                        <span
                            key={tag}
                            onClick={() => removeTag(tag)}
                            style={{
                                padding: "0.25rem 0.5rem",
                                background: "rgba(167, 139, 250, 0.15)",
                                color: "#a78bfa",
                                borderRadius: "4px",
                                fontSize: "0.75rem",
                                cursor: "pointer",
                            }}
                            title="Clique para remover"
                        >
                            {tag} ×
                        </span>
                    ))}
                    <div style={{ display: "flex", gap: "0.25rem" }}>
                        <input
                            type="text"
                            placeholder="Nova tag..."
                            value={newTag}
                            onChange={(e) => setNewTag(e.target.value)}
                            onKeyDown={(e) => e.key === "Enter" && addTag()}
                            style={{
                                padding: "0.25rem 0.5rem",
                                background: "rgba(255,255,255,0.05)",
                                border: "1px solid rgba(255,255,255,0.1)",
                                borderRadius: "4px",
                                color: "white",
                                fontSize: "0.75rem",
                                width: 100,
                            }}
                        />
                        {newTag && (
                            <button onClick={addTag} style={{ padding: "0.25rem 0.5rem", background: "#a78bfa", border: "none", borderRadius: "4px", color: "white", cursor: "pointer", fontSize: "0.7rem" }}>
                                +
                            </button>
                        )}
                    </div>
                </div>
            </div>

            {/* Stats Grid */}
            <div style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
                gap: "1rem",
                marginBottom: "1.5rem",
            }}>
                {[
                    { icon: DollarSign, label: "Total Gasto", value: formatCurrency(profile.stats.totalSpent), color: "#22c55e" },
                    { icon: ShoppingBag, label: "Pedidos", value: profile.stats.totalOrders.toString(), color: "#3b82f6" },
                    { icon: MessageCircle, label: "Mensagens", value: profile.stats.totalMessages.toString(), color: "#a78bfa" },
                    { icon: Heart, label: "Interesses", value: profile.stats.totalInterests.toString(), color: "#f43f5e" },
                    { icon: Calendar, label: "Primeiro Contato", value: formatDate(profile.stats.firstContactAt), color: "#64748b" },
                    { icon: Clock, label: "Última Interação", value: formatDate(profile.stats.lastInteractionAt), color: "#f59e0b" },
                ].map((stat, i) => (
                    <div key={i} className="dash-card" style={{ padding: "1rem" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.5rem" }}>
                            <stat.icon style={{ width: 16, height: 16, color: stat.color }} />
                            <span style={{ fontSize: "0.75rem", color: "#64748b" }}>{stat.label}</span>
                        </div>
                        <div style={{ fontSize: "1.25rem", fontWeight: 600, color: "white" }}>{stat.value}</div>
                    </div>
                ))}
            </div>

            {/* Notes Section */}
            <div className="dash-card" style={{ marginBottom: "1.5rem" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.75rem" }}>
                    <StickyNote style={{ width: 18, height: 18, color: "#f59e0b" }} />
                    <h3 style={{ color: "white", fontSize: "1rem", fontWeight: 500 }}>Notas</h3>
                </div>
                <textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Adicione observações sobre este cliente..."
                    style={{
                        width: "100%",
                        minHeight: 100,
                        padding: "0.75rem",
                        background: "rgba(255,255,255,0.05)",
                        border: "1px solid rgba(255,255,255,0.1)",
                        borderRadius: "8px",
                        color: "white",
                        fontSize: "0.9rem",
                        resize: "vertical",
                    }}
                />
                <button
                    onClick={saveNotes}
                    disabled={saving}
                    className="dash-btn primary"
                    style={{ marginTop: "0.75rem" }}
                >
                    <Save style={{ width: 16, height: 16 }} />
                    {saving ? "Salvando..." : "Salvar Notas"}
                </button>
            </div>

            {/* Tabs */}
            <div style={{ display: "flex", gap: "0.5rem", marginBottom: "1rem", flexWrap: "wrap" }}>
                {[
                    { id: "timeline", label: "Timeline", count: profile.timeline.length },
                    { id: "conversations", label: "Conversas", count: profile.conversations.length },
                    { id: "orders", label: "Pedidos", count: profile.orders.length },
                    { id: "interests", label: "Interesses", count: profile.interests.length },
                ].map(tab => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id as typeof activeTab)}
                        style={{
                            padding: "0.5rem 1rem",
                            borderRadius: "8px",
                            border: activeTab === tab.id ? "1px solid #a78bfa" : "1px solid rgba(255,255,255,0.1)",
                            background: activeTab === tab.id ? "rgba(167, 139, 250, 0.1)" : "transparent",
                            color: activeTab === tab.id ? "#a78bfa" : "#94a3b8",
                            cursor: "pointer",
                            fontSize: "0.85rem",
                        }}
                    >
                        {tab.label} ({tab.count})
                    </button>
                ))}
            </div>

            {/* Tab Content */}
            <div className="dash-card">
                {activeTab === "timeline" && (
                    <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
                        {profile.timeline.length === 0 ? (
                            <p style={{ color: "#64748b", textAlign: "center", padding: "2rem" }}>Nenhum evento</p>
                        ) : (
                            profile.timeline.map((event, i) => (
                                <div key={i} style={{ display: "flex", gap: "1rem", padding: "0.75rem", background: "rgba(255,255,255,0.03)", borderRadius: "8px" }}>
                                    <div style={{
                                        width: 32,
                                        height: 32,
                                        borderRadius: "50%",
                                        background: event.type === "order" ? "rgba(34, 197, 94, 0.1)" : event.type === "interest" ? "rgba(244, 63, 94, 0.1)" : "rgba(167, 139, 250, 0.1)",
                                        display: "flex",
                                        alignItems: "center",
                                        justifyContent: "center",
                                    }}>
                                        {event.type === "order" && <ShoppingBag style={{ width: 14, height: 14, color: "#22c55e" }} />}
                                        {event.type === "interest" && <Heart style={{ width: 14, height: 14, color: "#f43f5e" }} />}
                                        {event.type === "conversation" && <MessageCircle style={{ width: 14, height: 14, color: "#a78bfa" }} />}
                                    </div>
                                    <div style={{ flex: 1 }}>
                                        <div style={{ color: "white", fontSize: "0.9rem", fontWeight: 500 }}>{event.title}</div>
                                        <div style={{ color: "#64748b", fontSize: "0.8rem" }}>{event.subtitle}</div>
                                    </div>
                                    <div style={{ color: "#64748b", fontSize: "0.75rem" }}>{formatDateTime(event.date)}</div>
                                </div>
                            ))
                        )}
                    </div>
                )}

                {activeTab === "conversations" && (
                    <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                        {profile.conversations.length === 0 ? (
                            <p style={{ color: "#64748b", textAlign: "center", padding: "2rem" }}>Nenhuma conversa</p>
                        ) : (
                            profile.conversations.map(conv => (
                                <Link
                                    key={conv.id}
                                    href={`/dashboard/conversations?id=${conv.id}`}
                                    style={{ display: "flex", gap: "1rem", padding: "0.75rem", background: "rgba(255,255,255,0.03)", borderRadius: "8px", textDecoration: "none", alignItems: "center" }}
                                >
                                    <MessageCircle style={{ width: 18, height: 18, color: "#a78bfa" }} />
                                    <div style={{ flex: 1 }}>
                                        <div style={{ color: "white", fontSize: "0.9rem" }}>{conv.messageCount} mensagens</div>
                                        <div style={{ color: "#64748b", fontSize: "0.8rem" }}>{conv.lastMessage?.content?.slice(0, 50) || "..."}</div>
                                    </div>
                                    <div style={{ color: "#64748b", fontSize: "0.75rem" }}>{formatDateTime(conv.lastMessageAt)}</div>
                                    <ExternalLink style={{ width: 14, height: 14, color: "#64748b" }} />
                                </Link>
                            ))
                        )}
                    </div>
                )}

                {activeTab === "orders" && (
                    <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                        {profile.orders.length === 0 ? (
                            <p style={{ color: "#64748b", textAlign: "center", padding: "2rem" }}>Nenhum pedido</p>
                        ) : (
                            profile.orders.map(order => {
                                const statusConfig = STATUS_LABELS[order.status] || { label: order.status, color: "#64748b" };
                                return (
                                    <div key={order.id} style={{ display: "flex", gap: "1rem", padding: "0.75rem", background: "rgba(255,255,255,0.03)", borderRadius: "8px", alignItems: "center" }}>
                                        <Package style={{ width: 18, height: 18, color: "#22c55e" }} />
                                        <div style={{ flex: 1 }}>
                                            <div style={{ color: "white", fontSize: "0.9rem" }}>{order.productName}</div>
                                            <div style={{ color: "#64748b", fontSize: "0.8rem" }}>Qtd: {order.quantity}</div>
                                        </div>
                                        <span style={{
                                            padding: "0.25rem 0.5rem",
                                            background: `${statusConfig.color}20`,
                                            color: statusConfig.color,
                                            borderRadius: "4px",
                                            fontSize: "0.7rem",
                                        }}>
                                            {statusConfig.label}
                                        </span>
                                        <div style={{ color: "#22c55e", fontWeight: 500 }}>{formatCurrency(order.totalAmount)}</div>
                                        <div style={{ color: "#64748b", fontSize: "0.75rem" }}>{formatDateTime(order.createdAt)}</div>
                                    </div>
                                );
                            })
                        )}
                    </div>
                )}

                {activeTab === "interests" && (
                    <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                        {profile.interests.length === 0 ? (
                            <p style={{ color: "#64748b", textAlign: "center", padding: "2rem" }}>Nenhum interesse registrado</p>
                        ) : (
                            profile.interests.map(interest => {
                                const statusConfig = STATUS_LABELS[interest.status] || { label: interest.status, color: "#64748b" };
                                return (
                                    <div key={interest.id} style={{ display: "flex", gap: "1rem", padding: "0.75rem", background: "rgba(255,255,255,0.03)", borderRadius: "8px", alignItems: "center" }}>
                                        <Heart style={{ width: 18, height: 18, color: "#f43f5e" }} />
                                        <div style={{ flex: 1 }}>
                                            <div style={{ color: "white", fontSize: "0.9rem" }}>{interest.productName}</div>
                                            {interest.details && <div style={{ color: "#64748b", fontSize: "0.8rem" }}>{interest.details}</div>}
                                        </div>
                                        <span style={{
                                            padding: "0.25rem 0.5rem",
                                            background: `${statusConfig.color}20`,
                                            color: statusConfig.color,
                                            borderRadius: "4px",
                                            fontSize: "0.7rem",
                                        }}>
                                            {statusConfig.label}
                                        </span>
                                        <div style={{ color: "#64748b", fontSize: "0.75rem" }}>{formatDateTime(interest.createdAt)}</div>
                                    </div>
                                );
                            })
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
