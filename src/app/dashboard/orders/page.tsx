"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
    ShoppingCart, Search, User, Phone, Clock, CheckCircle, XCircle,
    Truck, Package, Eye, Image as ImageIcon, Store, Printer
} from "lucide-react";
import { useNotificationSound } from "@/hooks/use-notification-sound";

interface Order {
    id: string;
    customerPhone: string;
    customerName: string | null;
    productName: string;
    productPrice: number;
    quantity: number;
    totalAmount: number;
    pixKey: string;
    status: "AWAITING_PAYMENT" | "PROOF_SENT" | "VERIFIED" | "SHIPPED" | "DELIVERED" | "CANCELLED";
    paymentProof: string | null;
    paymentMethod: string | null;  // "PIX" | "DINHEIRO" | "NA_ENTREGA"
    createdAt: string;
    paidAt: string | null;
    // Delivery fields
    deliveryType: "DELIVERY" | "PICKUP" | null;
    deliveryAddress: string | null;
    deliveryCep: string | null;
    deliveryCity: string | null;
    deliveryState: string | null;
    deliveryFee: number | null;
    customerNotes: string | null;
    conversation: {
        id: string;
    };
}

const STATUS_CONFIG = {
    AWAITING_PAYMENT: { label: "Aguardando Pagamento", color: "#fbbf24", bg: "rgba(251, 191, 36, 0.1)", icon: Clock },
    PROOF_SENT: { label: "Comprovante Enviado", color: "#60a5fa", bg: "rgba(96, 165, 250, 0.1)", icon: ImageIcon },
    VERIFIED: { label: "Verificado", color: "#34d399", bg: "rgba(52, 211, 153, 0.1)", icon: CheckCircle },
    SHIPPED: { label: "Enviado", color: "#a78bfa", bg: "rgba(167, 139, 250, 0.1)", icon: Truck },
    DELIVERED: { label: "Entregue", color: "#10b981", bg: "rgba(16, 185, 129, 0.1)", icon: Package },
    CANCELLED: { label: "Cancelado", color: "#f87171", bg: "rgba(248, 113, 113, 0.1)", icon: XCircle },
};

export default function OrdersPage() {
    const [orders, setOrders] = useState<Order[]>([]);
    const [stats, setStats] = useState<Record<string, number>>({});
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState("all");
    const [search, setSearch] = useState("");
    const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
    const [soundEnabled] = useState(true);

    const { playSound } = useNotificationSound();
    const previousOrderCountRef = useRef<number>(0);
    const isFirstLoadRef = useRef(true);

    const fetchOrders = useCallback(async () => {
        try {
            const params = new URLSearchParams();
            if (filter !== "all") params.set("status", filter);

            const response = await fetch(`/api/orders?${params}`);
            const data = await response.json();

            if (data.success) {
                const newOrders = data.data as Order[];

                // Check for new orders (only after first load)
                if (!isFirstLoadRef.current && soundEnabled) {
                    const newCount = newOrders.filter(o => o.status === "AWAITING_PAYMENT").length;
                    const previousCount = previousOrderCountRef.current;

                    if (newCount > previousCount) {
                        playSound("order");
                    }
                }

                previousOrderCountRef.current = newOrders.filter(o => o.status === "AWAITING_PAYMENT").length;
                isFirstLoadRef.current = false;

                setOrders(newOrders);
                setStats(data.stats || {});
            }
        } catch (error) {
            console.error("Erro ao buscar pedidos:", error);
        } finally {
            setLoading(false);
        }
    }, [filter, soundEnabled, playSound]);

    useEffect(() => {
        fetchOrders();

        // Polling every 30 seconds for new orders
        const interval = setInterval(fetchOrders, 30000);
        return () => clearInterval(interval);
    }, [fetchOrders]);

    const updateStatus = async (id: string, status: string) => {
        try {
            const response = await fetch("/api/orders", {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ id, status }),
            });

            if (response.ok) {
                fetchOrders();
                setSelectedOrder(null);
            }
        } catch (error) {
            console.error("Erro ao atualizar:", error);
        }
    };

    const filteredOrders = orders.filter(o =>
        !search ||
        o.productName.toLowerCase().includes(search.toLowerCase()) ||
        o.customerPhone.includes(search) ||
        o.customerName?.toLowerCase().includes(search.toLowerCase())
    );

    const formatDate = (date: string) => {
        return new Date(date).toLocaleDateString("pt-BR", {
            day: "2-digit",
            month: "short",
            hour: "2-digit",
            minute: "2-digit",
        });
    };

    const formatCurrency = (value: number) => {
        return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
    };

    const pendingCount = (stats.AWAITING_PAYMENT || 0) + (stats.PROOF_SENT || 0);

    if (loading) {
        return (
            <div className="dash-loading">
                <div className="dash-spinner" />
            </div>
        );
    }

    return (
        <div className="dash-fade-in">
            {/* Header */}
            <div className="dash-page-header">
                <h1 className="dash-page-title">
                    <ShoppingCart style={{ width: 28, height: 28, marginRight: 8, color: '#34d399' }} />
                    Pedidos
                </h1>
                <p className="dash-page-subtitle">Gerencie vendas e verifique pagamentos</p>
            </div>

            {/* Stats */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "1rem", marginBottom: "1.5rem" }}>
                {[
                    { label: "Aguardando", value: stats.AWAITING_PAYMENT || 0, color: "#fbbf24", bg: "rgba(251, 191, 36, 0.1)", icon: Clock },
                    { label: "Comprovantes", value: stats.PROOF_SENT || 0, color: "#60a5fa", bg: "rgba(96, 165, 250, 0.1)", icon: ImageIcon },
                    { label: "Verificados", value: stats.VERIFIED || 0, color: "#34d399", bg: "rgba(52, 211, 153, 0.1)", icon: CheckCircle },
                    { label: "Entregues", value: stats.DELIVERED || 0, color: "#10b981", bg: "rgba(16, 185, 129, 0.1)", icon: Package },
                ].map(stat => {
                    const Icon = stat.icon;
                    return (
                        <div
                            key={stat.label}
                            className="dash-card"
                            style={{
                                transition: "all 0.2s ease",
                                cursor: "default",
                            }}
                            onMouseEnter={(e) => e.currentTarget.style.transform = "translateY(-2px)"}
                            onMouseLeave={(e) => e.currentTarget.style.transform = "translateY(0)"}
                        >
                            <div style={{ padding: "1.25rem" }}>
                                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.75rem" }}>
                                    <span style={{ fontSize: "0.85rem", color: "#94a3b8", fontWeight: 500 }}>{stat.label}</span>
                                    <div style={{
                                        width: 36,
                                        height: 36,
                                        borderRadius: "10px",
                                        background: stat.bg,
                                        display: "flex",
                                        alignItems: "center",
                                        justifyContent: "center",
                                    }}>
                                        <Icon style={{ width: 18, height: 18, color: stat.color }} />
                                    </div>
                                </div>
                                <div style={{ fontSize: "2rem", fontWeight: 700, color: stat.color }}>{stat.value}</div>
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Filters */}
            <div className="dash-card" style={{ marginBottom: "1.5rem" }}>
                <div style={{ padding: "1rem", display: "flex", gap: "1rem", flexWrap: "wrap", alignItems: "center" }}>
                    <div style={{ position: "relative", flex: 1, minWidth: 200 }}>
                        <Search style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", width: 18, height: 18, color: "#64748b" }} />
                        <input
                            type="text"
                            placeholder="Buscar por produto, nome ou telefone..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="dash-input"
                            style={{ paddingLeft: "2.5rem" }}
                        />
                    </div>

                    <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
                        {[
                            { value: "all", label: "Todos" },
                            { value: "AWAITING_PAYMENT", label: "Aguardando" },
                            { value: "PROOF_SENT", label: "Comprovantes" },
                            { value: "VERIFIED", label: "Verificados" },
                        ].map(f => (
                            <button
                                key={f.value}
                                onClick={() => setFilter(f.value)}
                                className={`dash-btn ${filter === f.value ? 'primary' : 'secondary'}`}
                                style={{ padding: "0.5rem 1rem" }}
                            >
                                {f.label}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            {/* Alert for pending */}
            {pendingCount > 0 && (
                <div style={{
                    padding: "1rem",
                    background: "rgba(251, 191, 36, 0.1)",
                    border: "1px solid rgba(251, 191, 36, 0.2)",
                    borderRadius: "12px",
                    color: "#fbbf24",
                    marginBottom: "1.5rem",
                    display: "flex",
                    alignItems: "center",
                    gap: "0.75rem",
                }}>
                    <Clock style={{ width: 20, height: 20 }} />
                    <span>
                        <strong>{pendingCount}</strong> pagamento(s) aguardando verificação
                    </span>
                </div>
            )}

            {/* List */}
            {filteredOrders.length === 0 ? (
                <div className="dash-card" style={{ textAlign: "center", padding: "3rem" }}>
                    <ShoppingCart style={{ width: 48, height: 48, color: "#475569", margin: "0 auto 1rem" }} />
                    <h3 style={{ color: "white", marginBottom: "0.5rem" }}>Nenhum pedido encontrado</h3>
                    <p style={{ color: "#94a3b8" }}>Os pedidos aparecerão aqui quando clientes confirmarem compras</p>
                </div>
            ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
                    {filteredOrders.map(order => {
                        const StatusIcon = STATUS_CONFIG[order.status].icon;
                        return (
                            <div
                                key={order.id}
                                className="dash-card"
                                style={{
                                    transition: "all 0.2s ease",
                                }}
                                onMouseEnter={(e) => {
                                    e.currentTarget.style.transform = "translateY(-2px)";
                                    e.currentTarget.style.boxShadow = "0 8px 25px rgba(0, 0, 0, 0.3)";
                                }}
                                onMouseLeave={(e) => {
                                    e.currentTarget.style.transform = "translateY(0)";
                                    e.currentTarget.style.boxShadow = "";
                                }}
                            >
                                <div style={{ padding: "1.25rem", display: "flex", gap: "1rem", alignItems: "flex-start" }}>
                                    {/* Avatar */}
                                    <div style={{
                                        width: 48,
                                        height: 48,
                                        borderRadius: "50%",
                                        background: STATUS_CONFIG[order.status].bg,
                                        display: "flex",
                                        alignItems: "center",
                                        justifyContent: "center",
                                        flexShrink: 0,
                                    }}>
                                        <StatusIcon style={{ width: 24, height: 24, color: STATUS_CONFIG[order.status].color }} />
                                    </div>

                                    {/* Info */}
                                    <div style={{ flex: 1 }}>
                                        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "0.5rem" }}>
                                            <h3 style={{ color: "white", fontWeight: 600, margin: 0 }}>
                                                {order.productName}
                                            </h3>
                                            <span style={{
                                                padding: "0.25rem 0.75rem",
                                                borderRadius: "999px",
                                                fontSize: "0.75rem",
                                                fontWeight: 500,
                                                background: STATUS_CONFIG[order.status].bg,
                                                color: STATUS_CONFIG[order.status].color,
                                            }}>
                                                {STATUS_CONFIG[order.status].label}
                                            </span>
                                            {/* Badge forma de pagamento */}
                                            {(order.paymentMethod === "NA_ENTREGA" || order.paymentMethod === "DINHEIRO") && (
                                                <span style={{
                                                    padding: "0.25rem 0.75rem",
                                                    borderRadius: "999px",
                                                    fontSize: "0.75rem",
                                                    fontWeight: 500,
                                                    background: "rgba(251, 146, 60, 0.2)",
                                                    color: "#fb923c",
                                                    border: "1px solid rgba(251, 146, 60, 0.3)",
                                                }}>
                                                    💵 Pagar na entrega
                                                </span>
                                            )}
                                            {order.paymentMethod === "PIX" && (
                                                <span style={{
                                                    padding: "0.25rem 0.75rem",
                                                    borderRadius: "999px",
                                                    fontSize: "0.75rem",
                                                    fontWeight: 500,
                                                    background: "rgba(34, 197, 94, 0.2)",
                                                    color: "#22c55e",
                                                }}>
                                                    PIX
                                                </span>
                                            )}
                                            {/* Badge de observações */}
                                            {order.customerNotes && (
                                                <span
                                                    style={{
                                                        padding: "0.25rem 0.75rem",
                                                        borderRadius: "999px",
                                                        fontSize: "0.75rem",
                                                        fontWeight: 500,
                                                        background: "rgba(147, 51, 234, 0.2)",
                                                        color: "#a855f7",
                                                        border: "1px solid rgba(147, 51, 234, 0.3)",
                                                        maxWidth: "200px",
                                                        overflow: "hidden",
                                                        textOverflow: "ellipsis",
                                                        whiteSpace: "nowrap",
                                                    }}
                                                    title={order.customerNotes}
                                                >
                                                    📝 {order.customerNotes}
                                                </span>
                                            )}
                                        </div>

                                        <div style={{ display: "flex", alignItems: "center", gap: "1rem", color: "#94a3b8", fontSize: "0.875rem", marginBottom: "0.75rem", flexWrap: "wrap" }}>
                                            <span style={{ display: "flex", alignItems: "center", gap: "0.25rem" }}>
                                                <User style={{ width: 14, height: 14 }} />
                                                {order.customerName || "Cliente"}
                                            </span>
                                            <span style={{ display: "flex", alignItems: "center", gap: "0.25rem" }}>
                                                <Phone style={{ width: 14, height: 14 }} />
                                                {order.customerPhone}
                                            </span>
                                            <span style={{ display: "flex", alignItems: "center", gap: "0.25rem" }}>
                                                <Clock style={{ width: 14, height: 14 }} />
                                                {formatDate(order.createdAt)}
                                            </span>
                                        </div>

                                        <div style={{
                                            display: "flex",
                                            gap: "1.5rem",
                                            padding: "0.75rem 1rem",
                                            background: "rgba(255,255,255,0.03)",
                                            borderRadius: "8px",
                                            border: "1px solid rgba(255,255,255,0.08)",
                                        }}>
                                            <div>
                                                <span style={{ color: "#64748b", fontSize: "0.75rem" }}>Quantidade</span>
                                                <p style={{ color: "white", margin: 0, fontWeight: 600 }}>{order.quantity}x</p>
                                            </div>
                                            <div>
                                                <span style={{ color: "#64748b", fontSize: "0.75rem" }}>Valor Unit.</span>
                                                <p style={{ color: "white", margin: 0, fontWeight: 600 }}>{formatCurrency(order.productPrice)}</p>
                                            </div>
                                            <div>
                                                <span style={{ color: "#64748b", fontSize: "0.75rem" }}>Total</span>
                                                <p style={{ color: "#34d399", margin: 0, fontWeight: 700, fontSize: "1.1rem" }}>{formatCurrency(order.totalAmount)}</p>
                                            </div>
                                            {order.deliveryFee && order.deliveryFee > 0 && (
                                                <div>
                                                    <span style={{ color: "#64748b", fontSize: "0.75rem" }}>Frete</span>
                                                    <p style={{ color: "#fbbf24", margin: 0, fontWeight: 600 }}>{formatCurrency(order.deliveryFee)}</p>
                                                </div>
                                            )}
                                        </div>

                                        {/* Delivery Info */}
                                        {order.deliveryType && (
                                            <div style={{
                                                display: "flex",
                                                alignItems: "center",
                                                gap: "0.75rem",
                                                marginTop: "0.75rem",
                                                padding: "0.5rem 0.75rem",
                                                background: order.deliveryType === "DELIVERY"
                                                    ? "rgba(167, 139, 250, 0.1)"
                                                    : "rgba(52, 211, 153, 0.1)",
                                                borderRadius: "8px",
                                                border: `1px solid ${order.deliveryType === "DELIVERY" ? "rgba(167, 139, 250, 0.2)" : "rgba(52, 211, 153, 0.2)"}`,
                                            }}>
                                                {order.deliveryType === "DELIVERY" ? (
                                                    <>
                                                        <Truck style={{ width: 16, height: 16, color: "#a78bfa", flexShrink: 0 }} />
                                                        <div style={{ flex: 1, minWidth: 0 }}>
                                                            <span style={{ color: "#a78bfa", fontWeight: 600, fontSize: "0.875rem" }}>
                                                                Entrega
                                                            </span>
                                                            {order.deliveryAddress && (
                                                                <p style={{ color: "#94a3b8", margin: "0.25rem 0 0", fontSize: "0.8rem", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                                                    📍 {order.deliveryAddress}
                                                                    {order.deliveryCity && ` - ${order.deliveryCity}/${order.deliveryState}`}
                                                                </p>
                                                            )}
                                                        </div>
                                                    </>
                                                ) : (
                                                    <>
                                                        <Store style={{ width: 16, height: 16, color: "#34d399", flexShrink: 0 }} />
                                                        <span style={{ color: "#34d399", fontWeight: 600, fontSize: "0.875rem" }}>
                                                            Retirada no local
                                                        </span>
                                                    </>
                                                )}
                                            </div>
                                        )}
                                    </div>

                                    {/* Actions */}
                                    <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                                        <button
                                            onClick={() => setSelectedOrder(order)}
                                            className="dash-btn secondary"
                                            style={{ padding: "0.5rem" }}
                                            title="Ver detalhes"
                                        >
                                            <Eye style={{ width: 16, height: 16 }} />
                                        </button>

                                        <button
                                            onClick={() => window.open(`/api/orders/${order.id}/print`, '_blank')}
                                            className="dash-btn secondary"
                                            style={{ padding: "0.5rem", color: "#34d399" }}
                                            title="Imprimir"
                                        >
                                            <Printer style={{ width: 16, height: 16 }} />
                                        </button>

                                        {order.status === "AWAITING_PAYMENT" && (
                                            <>
                                                {/* Botão aprovar manualmente (pagamento em dinheiro) */}
                                                <button
                                                    onClick={() => updateStatus(order.id, "VERIFIED")}
                                                    className="dash-btn primary"
                                                    style={{ padding: "0.5rem" }}
                                                    title="Aprovar pagamento (dinheiro/entrega)"
                                                >
                                                    <CheckCircle style={{ width: 16, height: 16 }} />
                                                </button>
                                                <button
                                                    onClick={() => updateStatus(order.id, "CANCELLED")}
                                                    className="dash-btn secondary"
                                                    style={{ padding: "0.5rem", color: "#f87171" }}
                                                    title="Cancelar"
                                                >
                                                    <XCircle style={{ width: 16, height: 16 }} />
                                                </button>
                                            </>
                                        )}

                                        {order.status === "PROOF_SENT" && (
                                            <>
                                                {/* Botão ver comprovante */}
                                                {order.paymentProof && (
                                                    <button
                                                        onClick={() => window.open(order.paymentProof!, '_blank')}
                                                        className="dash-btn secondary"
                                                        style={{ padding: "0.5rem", color: "#60a5fa" }}
                                                        title="Ver comprovante"
                                                    >
                                                        <ImageIcon style={{ width: 16, height: 16 }} />
                                                    </button>
                                                )}
                                                <button
                                                    onClick={() => updateStatus(order.id, "VERIFIED")}
                                                    className="dash-btn primary"
                                                    style={{ padding: "0.5rem" }}
                                                    title="Aprovar pagamento"
                                                >
                                                    <CheckCircle style={{ width: 16, height: 16 }} />
                                                </button>
                                            </>
                                        )}

                                        {order.status === "VERIFIED" && (
                                            <button
                                                onClick={() => updateStatus(order.id, "SHIPPED")}
                                                className="dash-btn secondary"
                                                style={{ padding: "0.5rem", color: "#a78bfa" }}
                                                title="Marcar como enviado"
                                            >
                                                <Truck style={{ width: 16, height: 16 }} />
                                            </button>
                                        )}

                                        {order.status === "SHIPPED" && (
                                            <button
                                                onClick={() => updateStatus(order.id, "DELIVERED")}
                                                className="dash-btn secondary"
                                                style={{ padding: "0.5rem", color: "#10b981" }}
                                                title="Marcar como entregue"
                                            >
                                                <Package style={{ width: 16, height: 16 }} />
                                            </button>
                                        )}
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Order Detail Modal */}
            {selectedOrder && (
                <div
                    style={{
                        position: "fixed",
                        top: 0,
                        left: 0,
                        right: 0,
                        bottom: 0,
                        background: "rgba(0,0,0,0.8)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        zIndex: 1000,
                        padding: "1rem",
                    }}
                    onClick={() => setSelectedOrder(null)}
                >
                    <div
                        className="dash-card"
                        style={{ maxWidth: 500, width: "100%" }}
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div style={{ padding: "1.5rem" }}>
                            <h2 style={{ color: "white", marginBottom: "1.5rem" }}>Detalhes do Pedido</h2>

                            <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
                                <div>
                                    <span style={{ color: "#64748b", fontSize: "0.875rem" }}>Produto</span>
                                    <p style={{ color: "white", margin: "0.25rem 0 0", fontWeight: 600 }}>{selectedOrder.productName}</p>
                                </div>

                                <div>
                                    <span style={{ color: "#64748b", fontSize: "0.875rem" }}>Cliente</span>
                                    <p style={{ color: "white", margin: "0.25rem 0 0" }}>
                                        {selectedOrder.customerName || "Não informado"} ({selectedOrder.customerPhone})
                                    </p>
                                </div>

                                <div>
                                    <span style={{ color: "#64748b", fontSize: "0.875rem" }}>Valor Total</span>
                                    <p style={{ color: "#34d399", margin: "0.25rem 0 0", fontSize: "1.25rem", fontWeight: 700 }}>
                                        {formatCurrency(selectedOrder.totalAmount)}
                                    </p>
                                </div>

                                <div>
                                    <span style={{ color: "#64748b", fontSize: "0.875rem" }}>PIX Enviado</span>
                                    <p style={{ color: "white", margin: "0.25rem 0 0", fontFamily: "monospace" }}>{selectedOrder.pixKey}</p>
                                </div>

                                {selectedOrder.paymentProof && (
                                    <div>
                                        <span style={{ color: "#64748b", fontSize: "0.875rem" }}>Comprovante</span>
                                        <a
                                            href={selectedOrder.paymentProof}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            style={{ display: "block", color: "#60a5fa", marginTop: "0.25rem" }}
                                        >
                                            Ver comprovante →
                                        </a>
                                    </div>
                                )}

                                {/* Delivery Section */}
                                {selectedOrder.deliveryType && (
                                    <div style={{
                                        padding: "1rem",
                                        background: selectedOrder.deliveryType === "DELIVERY"
                                            ? "rgba(167, 139, 250, 0.1)"
                                            : "rgba(52, 211, 153, 0.1)",
                                        borderRadius: "8px",
                                        border: `1px solid ${selectedOrder.deliveryType === "DELIVERY" ? "rgba(167, 139, 250, 0.2)" : "rgba(52, 211, 153, 0.2)"}`,
                                    }}>
                                        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.75rem" }}>
                                            {selectedOrder.deliveryType === "DELIVERY" ? (
                                                <>
                                                    <Truck style={{ width: 18, height: 18, color: "#a78bfa" }} />
                                                    <span style={{ color: "#a78bfa", fontWeight: 600 }}>Entrega</span>
                                                </>
                                            ) : (
                                                <>
                                                    <Store style={{ width: 18, height: 18, color: "#34d399" }} />
                                                    <span style={{ color: "#34d399", fontWeight: 600 }}>Retirada no Local</span>
                                                </>
                                            )}
                                        </div>

                                        {selectedOrder.deliveryType === "DELIVERY" && (
                                            <>
                                                {selectedOrder.deliveryAddress && (
                                                    <div style={{ marginBottom: "0.5rem" }}>
                                                        <span style={{ color: "#64748b", fontSize: "0.75rem" }}>Endereço</span>
                                                        <p style={{ color: "white", margin: "0.25rem 0 0", fontSize: "0.9rem" }}>
                                                            📍 {selectedOrder.deliveryAddress}
                                                        </p>
                                                    </div>
                                                )}
                                                {(selectedOrder.deliveryCity || selectedOrder.deliveryCep) && (
                                                    <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap" }}>
                                                        {selectedOrder.deliveryCity && (
                                                            <div>
                                                                <span style={{ color: "#64748b", fontSize: "0.75rem" }}>Cidade/Estado</span>
                                                                <p style={{ color: "white", margin: "0.25rem 0 0" }}>
                                                                    {selectedOrder.deliveryCity}/{selectedOrder.deliveryState}
                                                                </p>
                                                            </div>
                                                        )}
                                                        {selectedOrder.deliveryCep && (
                                                            <div>
                                                                <span style={{ color: "#64748b", fontSize: "0.75rem" }}>CEP</span>
                                                                <p style={{ color: "white", margin: "0.25rem 0 0", fontFamily: "monospace" }}>
                                                                    {selectedOrder.deliveryCep.replace(/(\d{5})(\d{3})/, "$1-$2")}
                                                                </p>
                                                            </div>
                                                        )}
                                                        {selectedOrder.deliveryFee && selectedOrder.deliveryFee > 0 && (
                                                            <div>
                                                                <span style={{ color: "#64748b", fontSize: "0.75rem" }}>Frete</span>
                                                                <p style={{ color: "#fbbf24", margin: "0.25rem 0 0", fontWeight: 600 }}>
                                                                    {formatCurrency(selectedOrder.deliveryFee)}
                                                                </p>
                                                            </div>
                                                        )}
                                                    </div>
                                                )}
                                            </>
                                        )}

                                        {selectedOrder.customerNotes && (
                                            <div style={{ marginTop: "0.75rem", paddingTop: "0.75rem", borderTop: "1px solid rgba(255,255,255,0.1)" }}>
                                                <span style={{ color: "#64748b", fontSize: "0.75rem" }}>Observações</span>
                                                <p style={{ color: "#94a3b8", margin: "0.25rem 0 0", fontSize: "0.875rem", fontStyle: "italic" }}>
                                                    &ldquo;{selectedOrder.customerNotes}&rdquo;
                                                </p>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>

                            <div style={{ display: "flex", gap: "0.75rem", marginTop: "1.5rem" }}>
                                <button
                                    onClick={() => setSelectedOrder(null)}
                                    className="dash-btn secondary"
                                    style={{ flex: 1 }}
                                >
                                    Fechar
                                </button>
                                <button
                                    onClick={() => window.open(`/api/orders/${selectedOrder.id}/print`, '_blank')}
                                    className="dash-btn secondary"
                                    style={{ flex: 1, color: "#34d399" }}
                                >
                                    <Printer style={{ width: 16, height: 16 }} />
                                    Imprimir
                                </button>
                                {selectedOrder.status === "PROOF_SENT" && (
                                    <button
                                        onClick={() => updateStatus(selectedOrder.id, "VERIFIED")}
                                        className="dash-btn primary"
                                        style={{ flex: 1 }}
                                    >
                                        <CheckCircle style={{ width: 16, height: 16 }} />
                                        Confirmar Pagamento
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
