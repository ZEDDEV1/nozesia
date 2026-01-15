"use client";

import { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
    Heart,
    Search,
    User,
    Phone,
    MessageCircle,
    Clock,
    CheckCircle,
    XCircle,
    TrendingUp,
    DollarSign,
    Flame,
    Sparkles,
    ExternalLink,
} from "lucide-react";
import { StatCard } from "@/components/stat-card";

interface CustomerInterest {
    id: string;
    productName: string;
    details: string | null;
    customerPhone: string;
    customerName: string | null;
    status: "NEW" | "CONTACTED" | "CONVERTED" | "LOST";
    priority: number;
    estimatedValue: number | null;
    createdAt: string;
    conversation: {
        id: string;
        customerName: string | null;
        lastMessageAt: string;
    };
}

const STATUS_CONFIG = {
    NEW: { label: "Novo", color: "#60a5fa", bg: "rgba(96, 165, 250, 0.1)", border: "#60a5fa" },
    CONTACTED: { label: "Contactado", color: "#fbbf24", bg: "rgba(251, 191, 36, 0.1)", border: "#fbbf24" },
    CONVERTED: { label: "Convertido", color: "#34d399", bg: "rgba(52, 211, 153, 0.1)", border: "#10b981" },
    LOST: { label: "Perdido", color: "#f87171", bg: "rgba(248, 113, 113, 0.1)", border: "#ef4444" },
};

const PRIORITY_CONFIG: Record<number, { label: string; color: string; flames: number }> = {
    1: { label: "Baixa", color: "#64748b", flames: 0 },
    2: { label: "Normal", color: "#94a3b8", flames: 1 },
    3: { label: "Média", color: "#fbbf24", flames: 2 },
    4: { label: "Alta", color: "#f97316", flames: 3 },
    5: { label: "Hot", color: "#ef4444", flames: 4 },
};

export default function InterestsPage() {
    const [interests, setInterests] = useState<CustomerInterest[]>([]);
    const [loading, setLoading] = useState(true);
    const [statusFilter, setStatusFilter] = useState("all");
    const [priorityFilter, setPriorityFilter] = useState("all");
    const [search, setSearch] = useState("");

    useEffect(() => {
        fetchInterests();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [statusFilter]);

    const fetchInterests = async () => {
        try {
            const params = new URLSearchParams();
            if (statusFilter !== "all") params.set("status", statusFilter);

            const response = await fetch(`/api/interests?${params}`);
            const data = await response.json();

            if (data.success) {
                setInterests(data.data);
            }
        } catch (error) {
            console.error("Erro ao buscar interesses:", error);
        } finally {
            setLoading(false);
        }
    };

    const updateStatus = async (id: string, status: string) => {
        try {
            const response = await fetch("/api/interests", {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ id, status }),
            });

            if (response.ok) {
                fetchInterests();
            }
        } catch (error) {
            console.error("Erro ao atualizar:", error);
        }
    };

    // Filtros combinados
    const filteredInterests = useMemo(() => {
        return interests.filter(i => {
            const matchesSearch = !search ||
                i.productName.toLowerCase().includes(search.toLowerCase()) ||
                i.customerPhone.includes(search) ||
                i.customerName?.toLowerCase().includes(search.toLowerCase());

            const matchesPriority = priorityFilter === "all" ||
                (priorityFilter === "hot" && i.priority >= 4) ||
                (priorityFilter === "medium" && i.priority === 3) ||
                (priorityFilter === "low" && i.priority <= 2);

            return matchesSearch && matchesPriority;
        });
    }, [interests, search, priorityFilter]);

    // KPIs calculados
    const stats = useMemo(() => {
        const total = interests.length;
        const converted = interests.filter(i => i.status === "CONVERTED").length;
        const newToday = interests.filter(i => {
            const created = new Date(i.createdAt);
            const today = new Date();
            return created.toDateString() === today.toDateString();
        }).length;
        const totalValue = interests.reduce((acc, i) => acc + (i.estimatedValue || 0), 0);
        const conversionRate = total > 0 ? Math.round((converted / total) * 100) : 0;
        const hotLeads = interests.filter(i => i.priority >= 4 && i.status === "NEW").length;

        return { total, converted, newToday, totalValue, conversionRate, hotLeads };
    }, [interests]);

    // Tempo relativo
    const getRelativeTime = (dateStr: string) => {
        const date = new Date(dateStr);
        const now = new Date();
        const diffMs = now.getTime() - date.getTime();
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMs / 3600000);
        const diffDays = Math.floor(diffMs / 86400000);

        if (diffMins < 60) return `há ${diffMins}min`;
        if (diffHours < 24) return `há ${diffHours}h`;
        if (diffDays === 1) return "ontem";
        if (diffDays < 7) return `há ${diffDays}d`;
        return date.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
    };

    // Renderiza flames de prioridade
    const renderPriorityFlames = (priority: number) => {
        const config = PRIORITY_CONFIG[priority] || PRIORITY_CONFIG[2];
        if (config.flames === 0) return null;

        return (
            <span style={{ display: "inline-flex", gap: "2px", marginLeft: "0.5rem" }}>
                {Array.from({ length: config.flames }).map((_, i) => (
                    <Flame
                        key={i}
                        style={{
                            width: 14,
                            height: 14,
                            color: config.color,
                            filter: `drop-shadow(0 0 3px ${config.color}40)`,
                        }}
                    />
                ))}
            </span>
        );
    };

    // Formata valor
    const formatCurrency = (value: number) => {
        return new Intl.NumberFormat("pt-BR", {
            style: "currency",
            currency: "BRL",
            minimumFractionDigits: 0,
        }).format(value);
    };

    if (loading) {
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
                            background: "linear-gradient(135deg, #ec4899 0%, #f472b6 100%)",
                            display: "inline-flex",
                            alignItems: "center",
                            justifyContent: "center",
                            boxShadow: "0 8px 24px rgba(236, 72, 153, 0.3)",
                        }}>
                            <Heart style={{ width: 22, height: 22, color: "white" }} />
                        </span>
                        Interesses de Clientes
                    </h1>
                    <p className="dash-page-subtitle">Acompanhe e converta seus leads em vendas</p>
                </div>
                {stats.hotLeads > 0 && (
                    <div style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "0.5rem",
                        padding: "0.5rem 1rem",
                        background: "linear-gradient(135deg, rgba(239, 68, 68, 0.15), rgba(249, 115, 22, 0.1))",
                        borderRadius: 10,
                        border: "1px solid rgba(239, 68, 68, 0.3)",
                    }}>
                        <Flame style={{ width: 18, height: 18, color: "#ef4444" }} />
                        <span style={{ color: "#ef4444", fontWeight: 600, fontSize: "0.9rem" }}>
                            {stats.hotLeads} lead{stats.hotLeads > 1 ? "s" : ""} quente{stats.hotLeads > 1 ? "s" : ""}!
                        </span>
                    </div>
                )}
            </div>

            {/* KPI Cards */}
            <div className="dash-stats-grid" style={{ marginBottom: "1.5rem" }}>
                <StatCard
                    title="Total de Interesses"
                    value={stats.total}
                    icon={Heart}
                    color="purple"
                    index={0}
                />
                <StatCard
                    title="Novos Hoje"
                    value={stats.newToday}
                    icon={Sparkles}
                    color="cyan"
                    index={1}
                />
                <StatCard
                    title="Taxa de Conversão"
                    value={`${stats.conversionRate}%`}
                    icon={TrendingUp}
                    color="emerald"
                    index={2}
                />
                <StatCard
                    title="Valor Potencial"
                    value={formatCurrency(stats.totalValue)}
                    icon={DollarSign}
                    color="amber"
                    index={3}
                />
            </div>

            {/* Filters Card */}
            <motion.div
                className="dash-card"
                style={{ marginBottom: "1.5rem" }}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
            >
                <div style={{ padding: "1rem", display: "flex", gap: "1rem", flexWrap: "wrap", alignItems: "center" }}>
                    {/* Search */}
                    <div style={{ position: "relative", flex: 1, minWidth: 220 }}>
                        <Search style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", width: 18, height: 18, color: "#64748b" }} />
                        <input
                            type="text"
                            placeholder="Buscar por produto, nome ou telefone..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="dash-input"
                            style={{ paddingLeft: "2.5rem", width: "100%" }}
                        />
                    </div>

                    {/* Status Filters */}
                    <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
                        {[
                            { value: "all", label: "Todos", count: interests.length },
                            { value: "NEW", label: "Novos", count: interests.filter(i => i.status === "NEW").length },
                            { value: "CONTACTED", label: "Contactados", count: interests.filter(i => i.status === "CONTACTED").length },
                            { value: "CONVERTED", label: "Convertidos", count: interests.filter(i => i.status === "CONVERTED").length },
                        ].map(f => (
                            <button
                                key={f.value}
                                onClick={() => setStatusFilter(f.value)}
                                style={{
                                    padding: "0.5rem 1rem",
                                    borderRadius: 20,
                                    border: statusFilter === f.value ? "1px solid rgba(236, 72, 153, 0.3)" : "1px solid rgba(255,255,255,0.1)",
                                    background: statusFilter === f.value ? "linear-gradient(135deg, rgba(236, 72, 153, 0.15), rgba(244, 114, 182, 0.1))" : "transparent",
                                    color: statusFilter === f.value ? "#f472b6" : "#94a3b8",
                                    fontSize: "0.8rem",
                                    fontWeight: 500,
                                    cursor: "pointer",
                                    display: "flex",
                                    alignItems: "center",
                                    gap: "0.5rem",
                                    transition: "all 0.2s ease",
                                }}
                            >
                                {f.label}
                                <span style={{
                                    padding: "0.125rem 0.5rem",
                                    borderRadius: 10,
                                    background: "rgba(255,255,255,0.1)",
                                    fontSize: "0.7rem",
                                }}>
                                    {f.count}
                                </span>
                            </button>
                        ))}
                    </div>

                    {/* Divider */}
                    <div style={{ width: 1, height: 24, background: "rgba(255,255,255,0.1)" }} />

                    {/* Priority Filters */}
                    <div style={{ display: "flex", gap: "0.5rem" }}>
                        {[
                            { value: "all", label: "Todas", icon: null },
                            { value: "hot", label: "Hot", icon: <Flame style={{ width: 14, height: 14, color: "#ef4444" }} /> },
                        ].map(f => (
                            <button
                                key={f.value}
                                onClick={() => setPriorityFilter(f.value)}
                                style={{
                                    padding: "0.5rem 0.875rem",
                                    borderRadius: 20,
                                    border: priorityFilter === f.value ? "1px solid rgba(239, 68, 68, 0.3)" : "1px solid rgba(255,255,255,0.1)",
                                    background: priorityFilter === f.value && f.value === "hot"
                                        ? "linear-gradient(135deg, rgba(239, 68, 68, 0.15), rgba(249, 115, 22, 0.1))"
                                        : priorityFilter === f.value
                                            ? "rgba(255,255,255,0.05)"
                                            : "transparent",
                                    color: priorityFilter === f.value && f.value === "hot" ? "#ef4444" : priorityFilter === f.value ? "white" : "#94a3b8",
                                    fontSize: "0.8rem",
                                    fontWeight: 500,
                                    cursor: "pointer",
                                    display: "flex",
                                    alignItems: "center",
                                    gap: "0.35rem",
                                    transition: "all 0.2s ease",
                                }}
                            >
                                {f.icon}
                                {f.label}
                            </button>
                        ))}
                    </div>
                </div>
            </motion.div>

            {/* List */}
            <AnimatePresence mode="wait">
                {filteredInterests.length === 0 ? (
                    <motion.div
                        className="dash-card"
                        style={{ textAlign: "center", padding: "3rem" }}
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                    >
                        <div style={{
                            width: 80,
                            height: 80,
                            margin: "0 auto 1.5rem",
                            borderRadius: "50%",
                            background: "linear-gradient(135deg, rgba(236, 72, 153, 0.1), rgba(244, 114, 182, 0.05))",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                        }}>
                            <Heart style={{ width: 40, height: 40, color: "#f472b6", opacity: 0.5 }} />
                        </div>
                        <h3 style={{ color: "white", marginBottom: "0.5rem", fontSize: "1.1rem" }}>Nenhum interesse encontrado</h3>
                        <p style={{ color: "#94a3b8", fontSize: "0.9rem" }}>
                            {search || statusFilter !== "all" || priorityFilter !== "all"
                                ? "Tente ajustar os filtros de busca"
                                : "Os interesses dos clientes aparecerão aqui quando a IA identificar produtos de interesse nas conversas"}
                        </p>
                    </motion.div>
                ) : (
                    <motion.div
                        style={{ display: "flex", flexDirection: "column", gap: "1rem" }}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                    >
                        {filteredInterests.map((interest, index) => (
                            <motion.div
                                key={interest.id}
                                className="dash-card"
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: index * 0.05 }}
                                whileHover={{ y: -2, boxShadow: "0 8px 25px rgba(0, 0, 0, 0.3)" }}
                                style={{
                                    borderLeft: `4px solid ${STATUS_CONFIG[interest.status].border}`,
                                    overflow: "hidden",
                                }}
                            >
                                <div style={{ padding: "1.25rem", display: "flex", gap: "1rem", alignItems: "flex-start" }}>
                                    {/* Avatar */}
                                    <div style={{
                                        width: 52,
                                        height: 52,
                                        borderRadius: 14,
                                        background: "linear-gradient(135deg, #ec4899, #a855f7)",
                                        display: "flex",
                                        alignItems: "center",
                                        justifyContent: "center",
                                        flexShrink: 0,
                                        boxShadow: "0 4px 12px rgba(236, 72, 153, 0.2)",
                                        fontSize: "1.1rem",
                                        fontWeight: 700,
                                        color: "white",
                                    }}>
                                        {interest.customerName?.[0]?.toUpperCase() || <User style={{ width: 24, height: 24 }} />}
                                    </div>

                                    {/* Info */}
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                        {/* Header line */}
                                        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "0.5rem", flexWrap: "wrap" }}>
                                            <h3 style={{ color: "white", fontWeight: 600, margin: 0, fontSize: "1rem" }}>
                                                {interest.customerName || "Cliente"}
                                            </h3>
                                            {renderPriorityFlames(interest.priority)}
                                            <span style={{
                                                padding: "0.2rem 0.65rem",
                                                borderRadius: "999px",
                                                fontSize: "0.7rem",
                                                fontWeight: 600,
                                                background: STATUS_CONFIG[interest.status].bg,
                                                color: STATUS_CONFIG[interest.status].color,
                                                textTransform: "uppercase",
                                                letterSpacing: "0.03em",
                                            }}>
                                                {STATUS_CONFIG[interest.status].label}
                                            </span>
                                            <span style={{ color: "#64748b", fontSize: "0.8rem", marginLeft: "auto" }}>
                                                <Clock style={{ width: 12, height: 12, display: "inline", verticalAlign: "middle", marginRight: 4 }} />
                                                {getRelativeTime(interest.createdAt)}
                                            </span>
                                        </div>

                                        {/* Contact info */}
                                        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", color: "#94a3b8", fontSize: "0.85rem", marginBottom: "0.75rem" }}>
                                            <Phone style={{ width: 14, height: 14 }} />
                                            <span>{interest.customerPhone}</span>
                                        </div>

                                        {/* Interest box */}
                                        <div style={{
                                            padding: "0.875rem 1rem",
                                            background: "linear-gradient(135deg, rgba(236, 72, 153, 0.05), rgba(168, 85, 247, 0.03))",
                                            borderRadius: 10,
                                            border: "1px solid rgba(236, 72, 153, 0.1)",
                                        }}>
                                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "1rem" }}>
                                                <div style={{ flex: 1 }}>
                                                    <p style={{ color: "#e2e8f0", margin: 0, display: "flex", alignItems: "center", gap: "0.5rem" }}>
                                                        <Heart style={{ width: 14, height: 14, color: "#f472b6" }} />
                                                        <strong style={{ color: "#f472b6" }}>Interesse:</strong>
                                                        <span>{interest.productName}</span>
                                                    </p>
                                                    {interest.details && (
                                                        <p style={{ color: "#94a3b8", margin: "0.5rem 0 0", fontSize: "0.85rem", fontStyle: "italic" }}>
                                                            &ldquo;{interest.details}&rdquo;
                                                        </p>
                                                    )}
                                                </div>
                                                {interest.estimatedValue && interest.estimatedValue > 0 && (
                                                    <div style={{
                                                        padding: "0.35rem 0.75rem",
                                                        background: "linear-gradient(135deg, rgba(16, 185, 129, 0.15), rgba(52, 211, 153, 0.1))",
                                                        borderRadius: 8,
                                                        border: "1px solid rgba(16, 185, 129, 0.2)",
                                                        flexShrink: 0,
                                                    }}>
                                                        <span style={{ color: "#34d399", fontWeight: 700, fontSize: "0.9rem" }}>
                                                            {formatCurrency(interest.estimatedValue)}
                                                        </span>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </div>

                                    {/* Actions */}
                                    <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem", flexShrink: 0 }}>
                                        <a
                                            href={`/dashboard/conversations?id=${interest.conversation.id}`}
                                            className="dash-btn secondary"
                                            style={{ padding: "0.6rem", display: "flex", alignItems: "center", gap: "0.35rem" }}
                                            title="Ver conversa"
                                        >
                                            <MessageCircle style={{ width: 16, height: 16 }} />
                                            <ExternalLink style={{ width: 12, height: 12 }} />
                                        </a>
                                        {interest.status === "NEW" && (
                                            <button
                                                onClick={() => updateStatus(interest.id, "CONTACTED")}
                                                className="dash-btn secondary"
                                                style={{ padding: "0.6rem" }}
                                                title="Marcar como contactado"
                                            >
                                                <Phone style={{ width: 16, height: 16, color: "#fbbf24" }} />
                                            </button>
                                        )}
                                        {(interest.status === "NEW" || interest.status === "CONTACTED") && (
                                            <>
                                                <button
                                                    onClick={() => updateStatus(interest.id, "CONVERTED")}
                                                    className="dash-btn secondary"
                                                    style={{ padding: "0.6rem" }}
                                                    title="Marcar como convertido"
                                                >
                                                    <CheckCircle style={{ width: 16, height: 16, color: "#34d399" }} />
                                                </button>
                                                <button
                                                    onClick={() => updateStatus(interest.id, "LOST")}
                                                    className="dash-btn secondary"
                                                    style={{ padding: "0.6rem" }}
                                                    title="Marcar como perdido"
                                                >
                                                    <XCircle style={{ width: 16, height: 16, color: "#f87171" }} />
                                                </button>
                                            </>
                                        )}
                                    </div>
                                </div>
                            </motion.div>
                        ))}
                    </motion.div>
                )}
            </AnimatePresence>
        </motion.div>
    );
}
