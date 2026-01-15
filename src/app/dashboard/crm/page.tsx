"use client";

import { useState, useEffect, useCallback } from "react";
import {
    Users, Search, RefreshCw, MessageCircle, ShoppingBag,
    Flame, Clock, Moon, Snowflake, Star, Ban, ChevronRight, Tag, Plus, X, Kanban, TrendingUp, DollarSign
} from "lucide-react";
import Link from "next/link";
import { useDebounce } from "@/hooks/use-debounce";

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

interface SegmentCounts {
    VIP: number;
    HOT: number;
    WARM: number;
    INACTIVE: number;
    COLD: number;
}

interface TagData {
    id: string;
    name: string;
    color: string;
}

const SEGMENTS = [
    { id: "all", label: "Todos", icon: Users, color: "#94a3b8", bg: "rgba(148, 163, 184, 0.1)" },
    { id: "VIP", label: "VIP", icon: Star, color: "#f59e0b", bg: "rgba(245, 158, 11, 0.1)" },
    { id: "HOT", label: "Quentes", icon: Flame, color: "#ef4444", bg: "rgba(239, 68, 68, 0.1)" },
    { id: "WARM", label: "Mornos", icon: Clock, color: "#22c55e", bg: "rgba(34, 197, 94, 0.1)" },
    { id: "INACTIVE", label: "Inativos", icon: Moon, color: "#a78bfa", bg: "rgba(167, 139, 250, 0.1)" },
    { id: "COLD", label: "Frios", icon: Snowflake, color: "#3b82f6", bg: "rgba(59, 130, 246, 0.1)" },
];

export default function CRMPage() {
    const [customers, setCustomers] = useState<Customer[]>([]);
    const [segmentCounts, setSegmentCounts] = useState<SegmentCounts | null>(null);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState("");
    const debouncedSearch = useDebounce(search, 400);
    const [selectedSegment, setSelectedSegment] = useState("all");
    const [tags, setTags] = useState<TagData[]>([]);
    const [newTagName, setNewTagName] = useState("");
    const [showTagManager, setShowTagManager] = useState(false);
    const [selectedTag, setSelectedTag] = useState<string | null>(null);
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [total, setTotal] = useState(0);
    const [metrics, setMetrics] = useState<{
        pipeline: { leads: number; interested: number; negotiating: number; closedWon: number; pipelineValue: number; closedValue: number };
        metrics: { conversionRate: number; avgDealTime: number; ordersThisMonth: number; revenueThisMonth: number };
    } | null>(null);

    const fetchMetrics = useCallback(async () => {
        try {
            const response = await fetch("/api/crm/metrics");
            const data = await response.json();
            if (data.success) {
                setMetrics(data.data);
            }
        } catch (error) {
            console.error("Error fetching metrics:", error);
        }
    }, []);

    const fetchTags = useCallback(async () => {
        try {
            const response = await fetch("/api/tags");
            const data = await response.json();
            if (data.success) {
                setTags(data.data);
            }
        } catch (error) {
            console.error("Error fetching tags:", error);
        }
    }, []);

    useEffect(() => {
        fetchTags();
        fetchMetrics();
    }, [fetchTags, fetchMetrics]);

    const fetchCustomers = useCallback(async () => {
        try {
            setLoading(true);
            const params = new URLSearchParams();
            if (selectedSegment !== "all") params.set("segment", selectedSegment);
            if (selectedTag) params.set("tag", selectedTag); // Corrigido: enviando tag para API
            if (debouncedSearch) params.set("search", debouncedSearch);
            params.set("page", page.toString());
            params.set("limit", "20");

            const response = await fetch(`/api/customers?${params}`);
            const data = await response.json();

            if (data.success) {
                setCustomers(data.data);
                setSegmentCounts(data.segmentCounts);
                setTotalPages(data.totalPages || 1);
                setTotal(data.total || 0);
            }
        } catch (error) {
            console.error("Erro:", error);
        } finally {
            setLoading(false);
        }
    }, [selectedSegment, selectedTag, debouncedSearch, page]);

    useEffect(() => {
        fetchCustomers();
    }, [fetchCustomers]);

    const handleSearch = () => {
        setPage(1); // Reset to first page on search
        fetchCustomers();
    };

    const formatDate = (dateStr: string | null) => {
        if (!dateStr) return "Nunca";
        const date = new Date(dateStr);
        const now = new Date();
        const diff = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));

        if (diff === 0) return "Hoje";
        if (diff === 1) return "Ontem";
        if (diff < 7) return `${diff} dias`;
        if (diff < 30) return `${Math.floor(diff / 7)} sem`;
        return `${Math.floor(diff / 30)} mês`;
    };

    const formatCurrency = (value: number) => {
        return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
    };

    const getSegmentConfig = (segment: string) => {
        return SEGMENTS.find(s => s.id === segment) || SEGMENTS[0];
    };

    if (loading && customers.length === 0) {
        return (
            <div className="dash-loading">
                <div className="dash-spinner" />
            </div>
        );
    }

    const totalCustomers = segmentCounts
        ? Object.values(segmentCounts).reduce((a, b) => a + b, 0)
        : customers.length;

    return (
        <div className="dash-fade-in">
            {/* Header */}
            <div className="dash-page-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "1rem" }}>
                <div>
                    <h1 className="dash-page-title">
                        <Users style={{ width: 28, height: 28, marginRight: 8, color: "#a78bfa" }} />
                        CRM - Clientes
                    </h1>
                    <p className="dash-page-subtitle">
                        {totalCustomers} clientes que já interagiram com você
                    </p>
                </div>
                <Link href="/dashboard/crm/pipeline" className="dash-btn primary">
                    <Kanban style={{ width: 16, height: 16 }} />
                    Pipeline de Vendas
                </Link>
            </div>

            {/* KPIs Grid */}
            {metrics && (
                <div style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
                    gap: "1rem",
                    marginBottom: "1.5rem",
                }}>
                    <div className="dash-card" style={{ padding: "1rem" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                            <span style={{ color: "#64748b", fontSize: "0.75rem" }}>No Pipeline</span>
                            <Kanban style={{ width: 16, height: 16, color: "#a78bfa" }} />
                        </div>
                        <div style={{ fontSize: "1.5rem", fontWeight: 600, color: "white", marginTop: "0.25rem" }}>
                            {metrics.pipeline.leads + metrics.pipeline.interested + metrics.pipeline.negotiating}
                        </div>
                        <div style={{ color: "#22c55e", fontSize: "0.8rem" }}>
                            {formatCurrency(metrics.pipeline.pipelineValue)}
                        </div>
                    </div>
                    <div className="dash-card" style={{ padding: "1rem" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                            <span style={{ color: "#64748b", fontSize: "0.75rem" }}>Fechados</span>
                            <TrendingUp style={{ width: 16, height: 16, color: "#22c55e" }} />
                        </div>
                        <div style={{ fontSize: "1.5rem", fontWeight: 600, color: "white", marginTop: "0.25rem" }}>
                            {metrics.pipeline.closedWon}
                        </div>
                        <div style={{ color: "#22c55e", fontSize: "0.8rem" }}>
                            {formatCurrency(metrics.pipeline.closedValue)}
                        </div>
                    </div>
                    <div className="dash-card" style={{ padding: "1rem" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                            <span style={{ color: "#64748b", fontSize: "0.75rem" }}>Taxa Conversão</span>
                            <TrendingUp style={{ width: 16, height: 16, color: "#f59e0b" }} />
                        </div>
                        <div style={{ fontSize: "1.5rem", fontWeight: 600, color: "white", marginTop: "0.25rem" }}>
                            {metrics.metrics.conversionRate}%
                        </div>
                        <div style={{ color: "#64748b", fontSize: "0.8rem" }}>
                            Média: {metrics.metrics.avgDealTime} dias
                        </div>
                    </div>
                    <div className="dash-card" style={{ padding: "1rem" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                            <span style={{ color: "#64748b", fontSize: "0.75rem" }}>Este Mês</span>
                            <DollarSign style={{ width: 16, height: 16, color: "#3b82f6" }} />
                        </div>
                        <div style={{ fontSize: "1.5rem", fontWeight: 600, color: "white", marginTop: "0.25rem" }}>
                            {metrics.metrics.ordersThisMonth} pedidos
                        </div>
                        <div style={{ color: "#22c55e", fontSize: "0.8rem" }}>
                            {formatCurrency(metrics.metrics.revenueThisMonth)}
                        </div>
                    </div>
                </div>
            )}

            {/* Segment Cards */}
            <div className="dash-segment-grid" style={{ marginBottom: "1.5rem" }}>
                {SEGMENTS.map(seg => {
                    const count = seg.id === "all"
                        ? totalCustomers
                        : segmentCounts?.[seg.id as keyof SegmentCounts] || 0;
                    const isActive = selectedSegment === seg.id;
                    const Icon = seg.icon;

                    return (
                        <button
                            key={seg.id}
                            onClick={() => setSelectedSegment(seg.id)}
                            style={{
                                padding: "1rem",
                                borderRadius: "12px",
                                border: isActive ? `2px solid ${seg.color}` : "2px solid rgba(255,255,255,0.1)",
                                background: isActive ? seg.bg : "rgba(255,255,255,0.03)",
                                cursor: "pointer",
                                textAlign: "left",
                                transition: "all 0.2s",
                            }}
                        >
                            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.5rem" }}>
                                <Icon style={{ width: 18, height: 18, color: seg.color }} />
                                <span style={{ color: isActive ? seg.color : "#94a3b8", fontSize: "0.85rem" }}>
                                    {seg.label}
                                </span>
                            </div>
                            <div style={{ fontSize: "1.5rem", fontWeight: 600, color: "white" }}>
                                {count}
                            </div>
                        </button>
                    );
                })}
            </div>

            {/* Legend */}
            <div className="dash-card" style={{ padding: "0.75rem 1rem", marginBottom: "1.5rem" }}>
                <div style={{ display: "flex", flexWrap: "wrap", gap: "1rem", fontSize: "0.75rem", color: "#64748b" }}>
                    <span><Star style={{ width: 12, height: 12, color: "#f59e0b", display: "inline", marginRight: 4 }} />VIP: 5+ compras</span>
                    <span><Flame style={{ width: 12, height: 12, color: "#ef4444", display: "inline", marginRight: 4 }} />Quente: comprou últimos 30 dias</span>
                    <span><Clock style={{ width: 12, height: 12, color: "#22c55e", display: "inline", marginRight: 4 }} />Morno: interagiu últimos 30 dias</span>
                    <span><Moon style={{ width: 12, height: 12, color: "#a78bfa", display: "inline", marginRight: 4 }} />Inativo: 30-60 dias</span>
                    <span><Snowflake style={{ width: 12, height: 12, color: "#3b82f6", display: "inline", marginRight: 4 }} />Frio: 60+ dias</span>
                </div>
            </div>

            {/* Tags Section */}
            <div className="dash-card" style={{ padding: "0.75rem 1rem", marginBottom: "1.5rem" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.75rem" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                        <Tag style={{ width: 16, height: 16, color: "#a78bfa" }} />
                        <span style={{ fontSize: "0.85rem", color: "#94a3b8" }}>Filtrar por Tag:</span>
                        <button
                            onClick={() => setSelectedTag(null)}
                            style={{
                                padding: "0.25rem 0.5rem",
                                borderRadius: "4px",
                                border: selectedTag === null ? "1px solid #a78bfa" : "1px solid rgba(255,255,255,0.1)",
                                background: selectedTag === null ? "rgba(167, 139, 250, 0.1)" : "transparent",
                                color: selectedTag === null ? "#a78bfa" : "#64748b",
                                cursor: "pointer",
                                fontSize: "0.75rem",
                            }}
                        >
                            Todas
                        </button>
                        {tags.map(tag => (
                            <button
                                key={tag.id}
                                onClick={() => setSelectedTag(tag.name)}
                                style={{
                                    padding: "0.25rem 0.5rem",
                                    borderRadius: "4px",
                                    border: selectedTag === tag.name ? `1px solid ${tag.color}` : "1px solid rgba(255,255,255,0.1)",
                                    background: selectedTag === tag.name ? `${tag.color}20` : "transparent",
                                    color: selectedTag === tag.name ? tag.color : "#94a3b8",
                                    cursor: "pointer",
                                    fontSize: "0.75rem",
                                }}
                            >
                                {tag.name}
                            </button>
                        ))}
                    </div>
                    <button
                        onClick={() => setShowTagManager(!showTagManager)}
                        className="dash-btn secondary"
                        style={{ padding: "0.25rem 0.5rem", fontSize: "0.75rem" }}
                    >
                        <Plus style={{ width: 14, height: 14 }} />
                        Gerenciar
                    </button>
                </div>
                {showTagManager && (
                    <div style={{ borderTop: "1px solid rgba(255,255,255,0.1)", paddingTop: "0.75rem" }}>
                        <div style={{ display: "flex", gap: "0.5rem", marginBottom: "0.5rem" }}>
                            <input
                                type="text"
                                placeholder="Nome da nova tag..."
                                value={newTagName}
                                onChange={(e) => setNewTagName(e.target.value)}
                                onKeyDown={async (e) => {
                                    if (e.key === "Enter" && newTagName.trim()) {
                                        const response = await fetch("/api/tags", {
                                            method: "POST",
                                            headers: { "Content-Type": "application/json" },
                                            body: JSON.stringify({ name: newTagName.trim() }),
                                        });
                                        if (response.ok) {
                                            setNewTagName("");
                                            fetchTags();
                                        }
                                    }
                                }}
                                style={{
                                    flex: 1,
                                    padding: "0.375rem 0.5rem",
                                    background: "rgba(255,255,255,0.05)",
                                    border: "1px solid rgba(255,255,255,0.1)",
                                    borderRadius: "4px",
                                    color: "white",
                                    fontSize: "0.8rem",
                                }}
                            />
                        </div>
                        <div style={{ display: "flex", flexWrap: "wrap", gap: "0.375rem" }}>
                            {tags.map(tag => (
                                <div
                                    key={tag.id}
                                    style={{
                                        display: "flex",
                                        alignItems: "center",
                                        gap: "0.375rem",
                                        padding: "0.25rem 0.5rem",
                                        background: `${tag.color}20`,
                                        borderRadius: "4px",
                                        fontSize: "0.75rem",
                                        color: tag.color,
                                    }}
                                >
                                    {tag.name}
                                    <button
                                        onClick={async () => {
                                            await fetch(`/api/tags/${tag.id}`, { method: "DELETE" });
                                            fetchTags();
                                            if (selectedTag === tag.name) setSelectedTag(null);
                                        }}
                                        style={{ background: "none", border: "none", cursor: "pointer", padding: 0, display: "flex" }}
                                    >
                                        <X style={{ width: 12, height: 12, color: tag.color }} />
                                    </button>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>

            {/* Search */}
            <div style={{ display: "flex", gap: "0.75rem", marginBottom: "1.5rem" }}>
                <div style={{
                    flex: 1,
                    display: "flex",
                    alignItems: "center",
                    gap: "0.75rem",
                    padding: "0.75rem 1rem",
                    background: "rgba(255,255,255,0.05)",
                    borderRadius: "10px",
                    border: "1px solid rgba(255,255,255,0.1)",
                }}>
                    <Search style={{ width: 18, height: 18, color: "#64748b" }} />
                    <input
                        type="text"
                        placeholder="Buscar por nome ou telefone..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                        style={{
                            flex: 1,
                            background: "none",
                            border: "none",
                            color: "white",
                            fontSize: "0.95rem",
                            outline: "none",
                        }}
                    />
                </div>
                <button onClick={handleSearch} className="dash-btn secondary">
                    <Search style={{ width: 16, height: 16 }} />
                </button>
                <button onClick={fetchCustomers} className="dash-btn secondary">
                    <RefreshCw style={{ width: 16, height: 16 }} />
                </button>
            </div>

            {/* Customer List */}
            {customers.length === 0 ? (
                <div className="dash-card" style={{ textAlign: "center", padding: "3rem" }}>
                    <Users style={{ width: 48, height: 48, color: "#475569", margin: "0 auto 1rem" }} />
                    <h3 style={{ color: "white", marginBottom: "0.5rem" }}>Nenhum cliente encontrado</h3>
                    <p style={{ color: "#94a3b8" }}>
                        {selectedSegment !== "all"
                            ? "Nenhum cliente neste segmento"
                            : "Clientes aparecerão aqui quando interagirem pelo WhatsApp"}
                    </p>
                </div>
            ) : (
                <div className="dash-card dash-table-wrapper">
                    <table style={{ width: "100%", borderCollapse: "collapse", minWidth: "700px" }}>
                        <thead>
                            <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.1)" }}>
                                <th style={{ textAlign: "left", padding: "1rem", color: "#64748b", fontWeight: 500, fontSize: "0.85rem" }}>Cliente</th>
                                <th style={{ textAlign: "center", padding: "1rem", color: "#64748b", fontWeight: 500, fontSize: "0.85rem" }}>Segmento</th>
                                <th style={{ textAlign: "center", padding: "1rem", color: "#64748b", fontWeight: 500, fontSize: "0.85rem" }}>Última Msg</th>
                                <th style={{ textAlign: "center", padding: "1rem", color: "#64748b", fontWeight: 500, fontSize: "0.85rem" }}>Msgs</th>
                                <th style={{ textAlign: "center", padding: "1rem", color: "#64748b", fontWeight: 500, fontSize: "0.85rem" }}>Pedidos</th>
                                <th style={{ textAlign: "right", padding: "1rem", color: "#64748b", fontWeight: 500, fontSize: "0.85rem" }}>Total Gasto</th>
                                <th style={{ textAlign: "center", padding: "1rem", color: "#64748b", fontWeight: 500, fontSize: "0.85rem" }}>Ações</th>
                            </tr>
                        </thead>
                        <tbody>
                            {customers.map(customer => {
                                const segConfig = getSegmentConfig(customer.segment);
                                const Icon = segConfig.icon;

                                return (
                                    <tr
                                        key={customer.id}
                                        style={{
                                            borderBottom: "1px solid rgba(255,255,255,0.05)",
                                            transition: "background 0.15s ease",
                                            cursor: "pointer",
                                        }}
                                        onMouseEnter={(e) => e.currentTarget.style.background = "rgba(167, 139, 250, 0.05)"}
                                        onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}
                                    >
                                        <td style={{ padding: "1rem" }}>
                                            <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                                                <div style={{
                                                    width: 40,
                                                    height: 40,
                                                    borderRadius: "50%",
                                                    background: "linear-gradient(135deg, #374151, #1f2937)",
                                                    display: "flex",
                                                    alignItems: "center",
                                                    justifyContent: "center",
                                                    color: "white",
                                                    fontWeight: 600,
                                                    fontSize: "0.9rem",
                                                }}>
                                                    {customer.name[0]?.toUpperCase() || "?"}
                                                </div>
                                                <div>
                                                    <div style={{ color: "white", fontWeight: 500, display: "flex", alignItems: "center", gap: "0.5rem" }}>
                                                        {customer.name}
                                                        {customer.optedOut && <span title="Opt-out"><Ban style={{ width: 14, height: 14, color: "#f87171" }} /></span>}
                                                    </div>
                                                    <div style={{ color: "#64748b", fontSize: "0.8rem" }}>{customer.phone}</div>
                                                </div>
                                            </div>
                                        </td>
                                        <td style={{ textAlign: "center", padding: "1rem" }}>
                                            <span style={{
                                                display: "inline-flex",
                                                alignItems: "center",
                                                gap: "0.375rem",
                                                padding: "0.375rem 0.75rem",
                                                borderRadius: "999px",
                                                background: segConfig.bg,
                                                color: segConfig.color,
                                                fontSize: "0.75rem",
                                                fontWeight: 500,
                                            }}>
                                                <Icon style={{ width: 12, height: 12 }} />
                                                {segConfig.label}
                                            </span>
                                        </td>
                                        <td style={{ textAlign: "center", padding: "1rem", color: "#94a3b8", fontSize: "0.85rem" }}>
                                            {formatDate(customer.lastInteractionAt)}
                                        </td>
                                        <td style={{ textAlign: "center", padding: "1rem" }}>
                                            <span style={{ display: "inline-flex", alignItems: "center", gap: "0.25rem", color: "#94a3b8", fontSize: "0.85rem" }}>
                                                <MessageCircle style={{ width: 14, height: 14 }} />
                                                {customer.totalMessages}
                                            </span>
                                        </td>
                                        <td style={{ textAlign: "center", padding: "1rem" }}>
                                            <span style={{ display: "inline-flex", alignItems: "center", gap: "0.25rem", color: "#94a3b8", fontSize: "0.85rem" }}>
                                                <ShoppingBag style={{ width: 14, height: 14 }} />
                                                {customer.totalOrders}
                                            </span>
                                        </td>
                                        <td style={{ textAlign: "right", padding: "1rem", color: customer.totalSpent > 0 ? "#22c55e" : "#64748b", fontWeight: 500, fontSize: "0.9rem" }}>
                                            {formatCurrency(customer.totalSpent)}
                                        </td>
                                        <td style={{ textAlign: "center", padding: "1rem" }}>
                                            <Link
                                                href={`/dashboard/crm/${customer.phone}`}
                                                style={{
                                                    display: "inline-flex",
                                                    alignItems: "center",
                                                    padding: "0.5rem",
                                                    borderRadius: "8px",
                                                    background: "rgba(167, 139, 250, 0.1)",
                                                    color: "#a78bfa",
                                                    textDecoration: "none",
                                                }}
                                                title="Ver perfil"
                                            >
                                                <ChevronRight style={{ width: 18, height: 18 }} />
                                            </Link>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>

                    {/* Pagination */}
                    {totalPages > 1 && (
                        <div style={{
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                            padding: "1rem",
                            borderTop: "1px solid rgba(255,255,255,0.1)",
                        }}>
                            <span style={{ color: "#64748b", fontSize: "0.85rem" }}>
                                Mostrando {((page - 1) * 20) + 1}-{Math.min(page * 20, total)} de {total} clientes
                            </span>
                            <div style={{ display: "flex", gap: "0.5rem" }}>
                                <button
                                    onClick={() => setPage(p => Math.max(1, p - 1))}
                                    disabled={page === 1}
                                    className="dash-btn secondary"
                                    style={{
                                        padding: "0.5rem 1rem",
                                        opacity: page === 1 ? 0.5 : 1,
                                    }}
                                >
                                    Anterior
                                </button>
                                <span style={{
                                    padding: "0.5rem 1rem",
                                    background: "rgba(167, 139, 250, 0.2)",
                                    borderRadius: "8px",
                                    color: "#a78bfa",
                                    fontWeight: 600,
                                }}>
                                    {page} / {totalPages}
                                </span>
                                <button
                                    onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                                    disabled={page === totalPages}
                                    className="dash-btn secondary"
                                    style={{
                                        padding: "0.5rem 1rem",
                                        opacity: page === totalPages ? 0.5 : 1,
                                    }}
                                >
                                    Próximo
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
