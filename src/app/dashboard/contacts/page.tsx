"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
    Search, Users, MessageCircle, Phone, RefreshCw, X, Star, Download,
    Flame, Zap, Clock, Snowflake, Crown, Filter, ChevronRight, Loader2,
    TrendingUp, ShoppingBag
} from "lucide-react";
import { StatCard } from "@/components/stat-card";

interface Customer {
    id: string;
    phone: string;
    name: string;
    segment: "HOT" | "WARM" | "INACTIVE" | "COLD" | "VIP";
    lastInteractionAt: string | null;
    lastPurchaseAt: string | null;
    totalMessages: number;
    totalOrders: number;
    totalSpent: number;
    firstContactAt: string;
    optedOut: boolean;
}

const SEGMENT_CONFIG = {
    VIP: { label: "VIP", icon: Crown, color: "#f59e0b", bg: "rgba(245, 158, 11, 0.15)", border: "rgba(245, 158, 11, 0.3)" },
    HOT: { label: "Quente", icon: Flame, color: "#ef4444", bg: "rgba(239, 68, 68, 0.15)", border: "rgba(239, 68, 68, 0.3)" },
    WARM: { label: "Morno", icon: Zap, color: "#f97316", bg: "rgba(249, 115, 22, 0.15)", border: "rgba(249, 115, 22, 0.3)" },
    INACTIVE: { label: "Inativo", icon: Clock, color: "#64748b", bg: "rgba(100, 116, 139, 0.15)", border: "rgba(100, 116, 139, 0.3)" },
    COLD: { label: "Frio", icon: Snowflake, color: "#3b82f6", bg: "rgba(59, 130, 246, 0.15)", border: "rgba(59, 130, 246, 0.3)" },
};

export default function ContactsPage() {
    const [customers, setCustomers] = useState<Customer[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [search, setSearch] = useState("");
    const [segmentFilter, setSegmentFilter] = useState<string>("all");
    const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
    const [segmentCounts, setSegmentCounts] = useState({ VIP: 0, HOT: 0, WARM: 0, INACTIVE: 0, COLD: 0 });

    const fetchCustomers = useCallback(async () => {
        try {
            setError("");
            setLoading(true);
            const params = new URLSearchParams({ limit: "500" });
            if (segmentFilter !== "all") params.set("segment", segmentFilter);
            if (search) params.set("search", search);

            const response = await fetch(`/api/customers?${params}`);
            const data = await response.json();

            if (data.success) {
                setCustomers(data.data || []);
                setSegmentCounts(data.segmentCounts || { VIP: 0, HOT: 0, WARM: 0, INACTIVE: 0, COLD: 0 });
            } else {
                setError(data.error || "Erro ao carregar contatos");
            }
        } catch (err) {
            console.error("Error fetching customers:", err);
            setError("Erro de conexão");
        } finally {
            setLoading(false);
        }
    }, [segmentFilter, search]);

    useEffect(() => {
        const debounce = setTimeout(() => fetchCustomers(), 300);
        return () => clearTimeout(debounce);
    }, [fetchCustomers]);

    // Stats
    const stats = useMemo(() => {
        const total = Object.values(segmentCounts).reduce((a, b) => a + b, 0);
        return {
            total,
            active: segmentCounts.VIP + segmentCounts.HOT + segmentCounts.WARM,
            inactive: segmentCounts.INACTIVE + segmentCounts.COLD,
            vip: segmentCounts.VIP,
        };
    }, [segmentCounts]);

    // Group by first letter
    const groupedCustomers = useMemo(() => {
        const groups: Record<string, Customer[]> = {};
        customers.forEach(customer => {
            const letter = customer.name?.[0]?.toUpperCase() || "#";
            if (!groups[letter]) groups[letter] = [];
            groups[letter].push(customer);
        });
        return groups;
    }, [customers]);

    const sortedLetters = Object.keys(groupedCustomers).sort((a, b) => {
        if (a === "#") return 1;
        if (b === "#") return -1;
        return a.localeCompare(b);
    });

    const formatCurrency = (value: number) => {
        return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
    };

    const formatDate = (date: string | null) => {
        if (!date) return "Nunca";
        return new Date(date).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" });
    };

    const formatPhone = (phone: string) => {
        const cleaned = phone.replace(/\D/g, "");
        if (cleaned.length === 13) {
            return `+${cleaned.slice(0, 2)} (${cleaned.slice(2, 4)}) ${cleaned.slice(4, 9)}-${cleaned.slice(9)}`;
        }
        if (cleaned.length === 11) {
            return `(${cleaned.slice(0, 2)}) ${cleaned.slice(2, 7)}-${cleaned.slice(7)}`;
        }
        return phone;
    };

    if (loading && customers.length === 0) {
        return (
            <div className="dash-loading">
                <div className="dash-spinner" />
            </div>
        );
    }

    return (
        <motion.div
            className="dash-fade-in"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.3 }}
        >
            {/* Header Premium */}
            <div className="dash-page-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "1rem" }}>
                <div>
                    <h1 className="dash-page-title" style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                        <span style={{
                            width: 42,
                            height: 42,
                            borderRadius: 12,
                            background: "linear-gradient(135deg, #10b981 0%, #059669 100%)",
                            display: "inline-flex",
                            alignItems: "center",
                            justifyContent: "center",
                            boxShadow: "0 8px 24px rgba(16, 185, 129, 0.3)",
                        }}>
                            <Users style={{ width: 22, height: 22, color: "white" }} />
                        </span>
                        Contatos
                        {stats.total > 0 && (
                            <span style={{
                                padding: "0.25rem 0.65rem",
                                borderRadius: 20,
                                background: "linear-gradient(135deg, rgba(16, 185, 129, 0.2), rgba(5, 150, 105, 0.1))",
                                border: "1px solid rgba(16, 185, 129, 0.3)",
                                color: "#34d399",
                                fontSize: "0.75rem",
                                fontWeight: 600,
                            }}>
                                {stats.total} contatos
                            </span>
                        )}
                    </h1>
                    <p className="dash-page-subtitle">Clientes que já interagiram com seu negócio</p>
                </div>
                <div style={{ display: "flex", gap: "0.5rem" }}>
                    <button
                        onClick={fetchCustomers}
                        className="dash-btn secondary"
                        disabled={loading}
                        style={{ padding: "0.6rem" }}
                    >
                        {loading ? <Loader2 style={{ width: 18, height: 18, animation: "spin 1s linear infinite" }} /> : <RefreshCw style={{ width: 18, height: 18 }} />}
                    </button>
                    <button
                        onClick={() => window.open("/api/contacts/export", "_blank")}
                        className="dash-btn secondary"
                        style={{ padding: "0.6rem" }}
                        title="Exportar CSV"
                    >
                        <Download style={{ width: 18, height: 18 }} />
                    </button>
                </div>
            </div>

            {/* Error Alert */}
            <AnimatePresence>
                {error && (
                    <motion.div
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        style={{
                            padding: "1rem",
                            background: "rgba(239, 68, 68, 0.1)",
                            border: "1px solid rgba(239, 68, 68, 0.2)",
                            borderRadius: "12px",
                            color: "#f87171",
                            marginBottom: "1.5rem",
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center",
                        }}
                    >
                        {error}
                        <button onClick={() => setError("")} style={{ background: "none", border: "none", color: "#f87171", cursor: "pointer" }}>
                            <X style={{ width: 16, height: 16 }} />
                        </button>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Stats */}
            <div className="dash-stats-grid" style={{ marginBottom: "1.5rem" }}>
                <StatCard title="Total de Contatos" value={stats.total} icon={Users} color="emerald" index={0} />
                <StatCard title="Ativos (VIP/Quente/Morno)" value={stats.active} icon={TrendingUp} color="cyan" index={1} />
                <StatCard title="Inativos/Frios" value={stats.inactive} icon={Clock} color="purple" index={2} />
                <StatCard title="VIPs" value={stats.vip} icon={Crown} color="amber" index={3} />
            </div>

            {/* Filters */}
            <div className="dash-card" style={{ padding: "1rem", marginBottom: "1.5rem" }}>
                <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap", alignItems: "center" }}>
                    {/* Search */}
                    <div style={{
                        flex: 1,
                        minWidth: 200,
                        display: "flex",
                        alignItems: "center",
                        gap: "0.75rem",
                        padding: "0.6rem 1rem",
                        background: "rgba(255,255,255,0.03)",
                        border: "1px solid rgba(255,255,255,0.08)",
                        borderRadius: 10,
                    }}>
                        <Search style={{ width: 18, height: 18, color: "#64748b" }} />
                        <input
                            type="text"
                            placeholder="Buscar por nome ou telefone..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            style={{
                                flex: 1,
                                background: "none",
                                border: "none",
                                color: "white",
                                fontSize: "0.9rem",
                                outline: "none",
                            }}
                        />
                    </div>

                    {/* Segment Filter */}
                    <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", flexWrap: "wrap" }}>
                        <Filter style={{ width: 16, height: 16, color: "#64748b" }} />
                        {[
                            { key: "all", label: "Todos" },
                            { key: "VIP", label: "VIP", count: segmentCounts.VIP },
                            { key: "HOT", label: "Quentes", count: segmentCounts.HOT },
                            { key: "WARM", label: "Mornos", count: segmentCounts.WARM },
                            { key: "INACTIVE", label: "Inativos", count: segmentCounts.INACTIVE },
                            { key: "COLD", label: "Frios", count: segmentCounts.COLD },
                        ].map(({ key, label, count }) => (
                            <button
                                key={key}
                                onClick={() => setSegmentFilter(key)}
                                style={{
                                    padding: "0.4rem 0.75rem",
                                    borderRadius: 8,
                                    background: segmentFilter === key ? "rgba(16, 185, 129, 0.2)" : "rgba(255,255,255,0.03)",
                                    border: segmentFilter === key ? "1px solid rgba(16, 185, 129, 0.4)" : "1px solid rgba(255,255,255,0.08)",
                                    color: segmentFilter === key ? "#34d399" : "#94a3b8",
                                    fontSize: "0.8rem",
                                    fontWeight: 500,
                                    cursor: "pointer",
                                    display: "flex",
                                    alignItems: "center",
                                    gap: "0.35rem",
                                }}
                            >
                                {label}
                                {count !== undefined && <span style={{ opacity: 0.7 }}>({count})</span>}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            {/* Content */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 380px", gap: "1.5rem" }}>
                {/* Contact List */}
                <div className="dash-card" style={{ overflow: "hidden" }}>
                    <div style={{ maxHeight: "calc(100vh - 420px)", overflowY: "auto" }}>
                        {customers.length === 0 ? (
                            <motion.div
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                style={{ textAlign: "center", padding: "3rem 2rem" }}
                            >
                                <div style={{
                                    width: 80,
                                    height: 80,
                                    borderRadius: 20,
                                    background: "linear-gradient(135deg, rgba(16, 185, 129, 0.2), rgba(5, 150, 105, 0.1))",
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    margin: "0 auto 1.5rem",
                                }}>
                                    <Users style={{ width: 40, height: 40, color: "#34d399" }} />
                                </div>
                                <h3 style={{ color: "white", marginBottom: "0.5rem" }}>Nenhum contato encontrado</h3>
                                <p style={{ color: "#94a3b8", fontSize: "0.9rem" }}>
                                    {search ? "Tente buscar por outro termo" : "Quando clientes enviarem mensagens, eles aparecerão aqui"}
                                </p>
                            </motion.div>
                        ) : (
                            sortedLetters.map(letter => (
                                <div key={letter}>
                                    <div style={{
                                        padding: "0.5rem 1rem",
                                        background: "rgba(15, 23, 42, 0.8)",
                                        color: "#10b981",
                                        fontSize: "0.8rem",
                                        fontWeight: 600,
                                        position: "sticky",
                                        top: 0,
                                        zIndex: 10,
                                    }}>
                                        {letter}
                                    </div>
                                    {groupedCustomers[letter].map((customer, index) => {
                                        const segmentConfig = SEGMENT_CONFIG[customer.segment];
                                        const SegmentIcon = segmentConfig.icon;
                                        return (
                                            <motion.div
                                                key={customer.id}
                                                initial={{ opacity: 0, x: -10 }}
                                                animate={{ opacity: 1, x: 0 }}
                                                transition={{ delay: index * 0.02 }}
                                                onClick={() => setSelectedCustomer(customer)}
                                                style={{
                                                    display: "flex",
                                                    alignItems: "center",
                                                    gap: "0.875rem",
                                                    padding: "0.875rem 1rem",
                                                    cursor: "pointer",
                                                    borderBottom: "1px solid rgba(255,255,255,0.03)",
                                                    background: selectedCustomer?.id === customer.id ? "rgba(16, 185, 129, 0.08)" : "transparent",
                                                    transition: "background 0.15s",
                                                }}
                                                onMouseEnter={(e) => { if (selectedCustomer?.id !== customer.id) e.currentTarget.style.background = "rgba(255,255,255,0.03)"; }}
                                                onMouseLeave={(e) => { if (selectedCustomer?.id !== customer.id) e.currentTarget.style.background = "transparent"; }}
                                            >
                                                {/* Avatar */}
                                                <div style={{
                                                    position: "relative",
                                                    width: 46,
                                                    height: 46,
                                                    borderRadius: "50%",
                                                    background: "linear-gradient(135deg, #374151, #1f2937)",
                                                    display: "flex",
                                                    alignItems: "center",
                                                    justifyContent: "center",
                                                    flexShrink: 0,
                                                }}>
                                                    <span style={{ fontSize: "1.1rem", fontWeight: 600, color: "white" }}>
                                                        {customer.name?.[0]?.toUpperCase() || "?"}
                                                    </span>
                                                    {customer.segment === "VIP" && (
                                                        <span style={{
                                                            position: "absolute",
                                                            bottom: -2,
                                                            right: -2,
                                                            width: 18,
                                                            height: 18,
                                                            borderRadius: "50%",
                                                            background: "#f59e0b",
                                                            display: "flex",
                                                            alignItems: "center",
                                                            justifyContent: "center",
                                                            border: "2px solid #111827",
                                                        }}>
                                                            <Star style={{ width: 10, height: 10, color: "white" }} />
                                                        </span>
                                                    )}
                                                </div>

                                                {/* Info */}
                                                <div style={{ flex: 1, minWidth: 0 }}>
                                                    <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                                                        <span style={{ color: "white", fontWeight: 500, fontSize: "0.95rem" }}>{customer.name}</span>
                                                        <span style={{
                                                            padding: "0.15rem 0.5rem",
                                                            borderRadius: 6,
                                                            background: segmentConfig.bg,
                                                            border: `1px solid ${segmentConfig.border}`,
                                                            color: segmentConfig.color,
                                                            fontSize: "0.65rem",
                                                            fontWeight: 600,
                                                            display: "flex",
                                                            alignItems: "center",
                                                            gap: "0.25rem",
                                                        }}>
                                                            <SegmentIcon style={{ width: 10, height: 10 }} />
                                                            {segmentConfig.label}
                                                        </span>
                                                    </div>
                                                    <div style={{ display: "flex", alignItems: "center", gap: "1rem", marginTop: "0.25rem" }}>
                                                        <span style={{ color: "#64748b", fontSize: "0.8rem" }}>{formatPhone(customer.phone)}</span>
                                                        {customer.totalOrders > 0 && (
                                                            <span style={{ color: "#34d399", fontSize: "0.75rem", display: "flex", alignItems: "center", gap: "0.25rem" }}>
                                                                <ShoppingBag style={{ width: 12, height: 12 }} />
                                                                {customer.totalOrders} pedidos
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>

                                                <ChevronRight style={{ width: 18, height: 18, color: "#475569" }} />
                                            </motion.div>
                                        );
                                    })}
                                </div>
                            ))
                        )}
                    </div>
                </div>

                {/* Contact Details */}
                <div className="dash-card" style={{ padding: "1.5rem", position: "sticky", top: "1rem", height: "fit-content" }}>
                    {selectedCustomer ? (
                        <motion.div
                            key={selectedCustomer.id}
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                        >
                            {/* Avatar */}
                            <div style={{ textAlign: "center", marginBottom: "1.5rem", paddingBottom: "1.5rem", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
                                <div style={{
                                    width: 90,
                                    height: 90,
                                    borderRadius: "50%",
                                    background: "linear-gradient(135deg, #374151, #1f2937)",
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    margin: "0 auto 1rem",
                                    position: "relative",
                                }}>
                                    <span style={{ fontSize: "2.5rem", fontWeight: 600, color: "white" }}>
                                        {selectedCustomer.name?.[0]?.toUpperCase() || "?"}
                                    </span>
                                    {selectedCustomer.segment === "VIP" && (
                                        <span style={{
                                            position: "absolute",
                                            bottom: 0,
                                            right: 0,
                                            width: 28,
                                            height: 28,
                                            borderRadius: "50%",
                                            background: "#f59e0b",
                                            display: "flex",
                                            alignItems: "center",
                                            justifyContent: "center",
                                            border: "3px solid #111827",
                                        }}>
                                            <Crown style={{ width: 14, height: 14, color: "white" }} />
                                        </span>
                                    )}
                                </div>
                                <h2 style={{ color: "white", fontSize: "1.25rem", fontWeight: 600, margin: 0 }}>{selectedCustomer.name}</h2>
                                <div style={{ marginTop: "0.5rem" }}>
                                    {(() => {
                                        const config = SEGMENT_CONFIG[selectedCustomer.segment];
                                        const Icon = config.icon;
                                        return (
                                            <span style={{
                                                padding: "0.35rem 0.75rem",
                                                borderRadius: 20,
                                                background: config.bg,
                                                border: `1px solid ${config.border}`,
                                                color: config.color,
                                                fontSize: "0.8rem",
                                                fontWeight: 600,
                                                display: "inline-flex",
                                                alignItems: "center",
                                                gap: "0.35rem",
                                            }}>
                                                <Icon style={{ width: 14, height: 14 }} />
                                                {config.label}
                                            </span>
                                        );
                                    })()}
                                </div>
                            </div>

                            {/* Info Cards */}
                            <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem", marginBottom: "1.5rem" }}>
                                <div style={{ padding: "0.75rem", background: "rgba(15, 23, 42, 0.5)", borderRadius: 10 }}>
                                    <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                                        <Phone style={{ width: 18, height: 18, color: "#64748b" }} />
                                        <div>
                                            <div style={{ fontSize: "0.75rem", color: "#64748b" }}>Telefone</div>
                                            <div style={{ color: "#e2e8f0", fontWeight: 500 }}>{formatPhone(selectedCustomer.phone)}</div>
                                        </div>
                                    </div>
                                </div>
                                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
                                    <div style={{ padding: "0.75rem", background: "rgba(15, 23, 42, 0.5)", borderRadius: 10 }}>
                                        <div style={{ fontSize: "0.75rem", color: "#64748b" }}>Mensagens</div>
                                        <div style={{ color: "#e2e8f0", fontWeight: 600, fontSize: "1.1rem" }}>{selectedCustomer.totalMessages}</div>
                                    </div>
                                    <div style={{ padding: "0.75rem", background: "rgba(15, 23, 42, 0.5)", borderRadius: 10 }}>
                                        <div style={{ fontSize: "0.75rem", color: "#64748b" }}>Pedidos</div>
                                        <div style={{ color: "#34d399", fontWeight: 600, fontSize: "1.1rem" }}>{selectedCustomer.totalOrders}</div>
                                    </div>
                                </div>
                                {selectedCustomer.totalSpent > 0 && (
                                    <div style={{ padding: "0.75rem", background: "linear-gradient(135deg, rgba(16, 185, 129, 0.08), rgba(52, 211, 153, 0.04))", borderRadius: 10, border: "1px solid rgba(16, 185, 129, 0.15)" }}>
                                        <div style={{ fontSize: "0.75rem", color: "#64748b" }}>Total Gasto</div>
                                        <div style={{ color: "#34d399", fontWeight: 700, fontSize: "1.25rem" }}>{formatCurrency(selectedCustomer.totalSpent)}</div>
                                    </div>
                                )}
                                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
                                    <div style={{ padding: "0.75rem", background: "rgba(15, 23, 42, 0.5)", borderRadius: 10 }}>
                                        <div style={{ fontSize: "0.75rem", color: "#64748b" }}>Primeiro Contato</div>
                                        <div style={{ color: "#94a3b8", fontSize: "0.85rem" }}>{formatDate(selectedCustomer.firstContactAt)}</div>
                                    </div>
                                    <div style={{ padding: "0.75rem", background: "rgba(15, 23, 42, 0.5)", borderRadius: 10 }}>
                                        <div style={{ fontSize: "0.75rem", color: "#64748b" }}>Última Interação</div>
                                        <div style={{ color: "#94a3b8", fontSize: "0.85rem" }}>{formatDate(selectedCustomer.lastInteractionAt)}</div>
                                    </div>
                                </div>
                            </div>

                            {/* Actions */}
                            <a
                                href={`/dashboard/conversations?phone=${selectedCustomer.phone}`}
                                className="dash-btn primary"
                                style={{ width: "100%", padding: "0.875rem", justifyContent: "center", textDecoration: "none" }}
                            >
                                <MessageCircle style={{ width: 18, height: 18 }} />
                                Iniciar Conversa
                            </a>
                        </motion.div>
                    ) : (
                        <div style={{ textAlign: "center", padding: "3rem 1rem", color: "#64748b" }}>
                            <Users style={{ width: 48, height: 48, marginBottom: "1rem", opacity: 0.5 }} />
                            <p style={{ margin: 0 }}>Selecione um contato para ver detalhes</p>
                        </div>
                    )}
                </div>
            </div>

            {/* Responsive styles for mobile */}
            <style jsx global>{`
                @media (max-width: 1024px) {
                    .dash-fade-in > div:last-child {
                        grid-template-columns: 1fr !important;
                    }
                    .dash-fade-in > div:last-child > div:last-child {
                        display: none !important;
                    }
                }
            `}</style>
        </motion.div>
    );
}
