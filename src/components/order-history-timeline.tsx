"use client";

import { useState, useEffect } from "react";
import { Clock, CheckCircle, Package, Truck, Check, XCircle, CreditCard, MessageSquare } from "lucide-react";

interface HistoryEntry {
    id: string;
    action: string;
    previousStatus: string | null;
    newStatus: string | null;
    notes: string | null;
    authorName: string | null;
    createdAt: string;
}

interface OrderHistoryTimelineProps {
    orderId: string;
}

const ACTION_CONFIG: Record<string, { icon: React.ElementType; color: string; label: string }> = {
    STATUS_CHANGE: { icon: CheckCircle, color: "#3b82f6", label: "Status alterado" },
    NOTE_ADDED: { icon: MessageSquare, color: "#a78bfa", label: "Nota adicionada" },
    PAYMENT_CONFIRMED: { icon: CreditCard, color: "#10b981", label: "Pagamento confirmado" },
    SHIPPED: { icon: Truck, color: "#f59e0b", label: "Enviado" },
    DELIVERED: { icon: Package, color: "#10b981", label: "Entregue" },
    CANCELLED: { icon: XCircle, color: "#ef4444", label: "Cancelado" },
    CREATED: { icon: Check, color: "#64748b", label: "Pedido criado" },
};

const STATUS_LABELS: Record<string, string> = {
    AWAITING_PAYMENT: "Aguardando pagamento",
    PROOF_SENT: "Comprovante enviado",
    VERIFIED: "Verificado",
    SHIPPED: "Enviado",
    DELIVERED: "Entregue",
    CANCELLED: "Cancelado",
};

export function OrderHistoryTimeline({ orderId }: OrderHistoryTimelineProps) {
    const [history, setHistory] = useState<HistoryEntry[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchHistory();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [orderId]);

    const fetchHistory = async () => {
        try {
            const res = await fetch(`/api/orders/${orderId}/history`);
            const data = await res.json();
            if (data.success) {
                setHistory(data.data);
            }
        } catch (error) {
            console.error("Error fetching history:", error);
        } finally {
            setLoading(false);
        }
    };

    const formatDate = (date: string) => {
        return new Date(date).toLocaleDateString("pt-BR", {
            day: "2-digit",
            month: "short",
            hour: "2-digit",
            minute: "2-digit",
        });
    };

    if (loading) {
        return <div style={{ color: "#64748b", fontSize: "0.85rem" }}>Carregando histórico...</div>;
    }

    if (history.length === 0) {
        return <div style={{ color: "#64748b", fontSize: "0.85rem", fontStyle: "italic" }}>Nenhum histórico</div>;
    }

    return (
        <div className="order-history-timeline">
            {history.map((entry, index) => {
                const config = ACTION_CONFIG[entry.action] || ACTION_CONFIG.STATUS_CHANGE;
                const Icon = config.icon;

                return (
                    <div
                        key={entry.id}
                        style={{
                            display: "flex",
                            gap: "0.75rem",
                            paddingBottom: index < history.length - 1 ? "1rem" : 0,
                            position: "relative",
                        }}
                    >
                        {/* Line */}
                        {index < history.length - 1 && (
                            <div style={{
                                position: "absolute",
                                left: 11,
                                top: 24,
                                bottom: 0,
                                width: 2,
                                background: "rgba(255,255,255,0.1)",
                            }} />
                        )}

                        {/* Icon */}
                        <div style={{
                            width: 24,
                            height: 24,
                            borderRadius: "50%",
                            background: `${config.color}20`,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            flexShrink: 0,
                        }}>
                            <Icon size={12} style={{ color: config.color }} />
                        </div>

                        {/* Content */}
                        <div style={{ flex: 1 }}>
                            <p style={{ color: "#e2e8f0", fontSize: "0.85rem", margin: "0 0 0.25rem", fontWeight: 500 }}>
                                {config.label}
                                {entry.previousStatus && entry.newStatus && (
                                    <span style={{ color: "#64748b", fontWeight: 400 }}>
                                        {" "}
                                        {STATUS_LABELS[entry.previousStatus] || entry.previousStatus} → {STATUS_LABELS[entry.newStatus] || entry.newStatus}
                                    </span>
                                )}
                            </p>
                            {entry.notes && (
                                <p style={{ color: "#94a3b8", fontSize: "0.8rem", margin: "0 0 0.25rem" }}>
                                    {entry.notes}
                                </p>
                            )}
                            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                                <Clock size={10} style={{ color: "#475569" }} />
                                <span style={{ color: "#475569", fontSize: "0.75rem" }}>
                                    {formatDate(entry.createdAt)}
                                    {entry.authorName && ` • ${entry.authorName}`}
                                </span>
                            </div>
                        </div>
                    </div>
                );
            })}
        </div>
    );
}
