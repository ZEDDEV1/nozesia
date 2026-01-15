"use client";

import { useState, useEffect, useCallback } from "react";
import {
    BarChart3,
    TrendingUp,
    Clock,
    Users,
    MessageCircle,
    ShoppingCart,
    Target,
    RefreshCw,
    Download,
    Activity,
    Zap,
    Bot,
} from "lucide-react";
import { AnalyticsReport } from "@/components/analytics-report";
import { StatCard } from "@/components/stat-card";
import { HeatmapChart } from "@/components/heatmap-chart";
import { TopPerformersCard } from "@/components/top-performers-card";
import {
    ConversationsLineChart,
    MessagesByAgentChart,
    ResolutionPieChart,
    StatusDistributionChart,
    PeakHoursChart,
} from "@/components/analytics-charts";

interface AnalyticsData {
    summary: {
        period: string;
        startDate: string;
        endDate: string;
        totalConversations: number;
        totalMessages: number;
        totalInterests: number;
        totalOrders: number;
        avgResponseTimeSeconds: number;
    };
    conversationsOverTime: Array<{ date: string; count: number }>;
    resolutionRate: {
        byAI: number;
        byHuman: number;
        total: number;
    };
    peakHours: Array<{ hour: number; count: number }>;
    topProducts: Array<{ name: string; count: number }>;
    funnel: {
        conversations: number;
        interests: number;
        orders: number;
        conversionRate: number;
    };
    heatmapData: {
        [dayOfWeek: number]: {
            [hour: number]: number;
        };
    };
    messagesByAgent: Array<{ agentName: string; count: number }>;
    statusDistribution: {
        active: number;
        waiting: number;
        resolved: number;
        closed: number;
    };
    topPerformers: {
        agents: Array<{ name: string; count: number }>;
        products: Array<{ name: string; count: number }>;
    };
}

type Period = "7d" | "30d" | "90d";

export default function AnalyticsPage() {
    const [data, setData] = useState<AnalyticsData | null>(null);
    const [loading, setLoading] = useState(true);
    const [period, setPeriod] = useState<Period>("30d");
    const [showReport, setShowReport] = useState(false);
    const [agentMetrics, setAgentMetrics] = useState<Array<{
        id: string;
        name: string;
        isActive: boolean;
        totalConversations: number;
        resolvedConversations: number;
        totalMessages: number;
        satisfactionRate: number | null;
    }>>([]);

    const fetchData = useCallback(async () => {
        setLoading(true);
        try {
            const response = await fetch(`/api/analytics?period=${period}`);
            const result = await response.json();

            if (result.success) {
                setData(result.data);
            }
        } catch (error) {
            console.error("Error fetching analytics:", error);
        } finally {
            setLoading(false);
        }
    }, [period]);

    useEffect(() => {
        fetchData();
        // Fetch agent metrics
        fetch("/api/agents/metrics")
            .then(res => res.json())
            .then(result => {
                if (result.success) {
                    setAgentMetrics(result.data.agents || []);
                }
            })
            .catch(err => console.error("Error fetching agent metrics:", err));
    }, [fetchData]);

    const formatTime = (seconds: number) => {
        if (seconds < 60) return `${seconds}s`;
        const minutes = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${minutes}m ${secs}s`;
    };

    if (loading) {
        return (
            <div className="dash-loading">
                <div className="dash-spinner" />
            </div>
        );
    }

    if (!data) {
        return (
            <div className="dash-empty">
                <BarChart3 className="dash-empty-icon" />
                <h4 className="dash-empty-title">Sem dados de analytics</h4>
                <p className="dash-empty-text">Comece a receber mensagens para ver as métricas</p>
            </div>
        );
    }

    const statsCards = [
        {
            title: "Conversas",
            value: data.summary.totalConversations,
            icon: MessageCircle,
            color: "cyan" as const,
            trend: { value: 12, label: "vs período anterior" }
        },
        {
            title: "Mensagens",
            value: data.summary.totalMessages,
            icon: Users,
            color: "purple" as const,
            trend: { value: 8 }
        },
        {
            title: "Tempo Médio",
            value: formatTime(data.summary.avgResponseTimeSeconds),
            icon: Clock,
            color: "amber" as const,
            trend: { value: -15, label: "mais rápido" }
        },
        {
            title: "Taxa Conversão",
            value: `${data.funnel.conversionRate}%`,
            icon: Target,
            color: "emerald" as const,
            trend: { value: 5 }
        },
    ];

    return (
        <div className="dash-fade-in">
            {/* Header */}
            <div className="dash-page-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "1rem" }}>
                <div>
                    <h1 className="dash-page-title">Analytics</h1>
                    <p className="dash-page-subtitle">Métricas e insights do seu atendimento</p>
                </div>
                <div style={{ display: "flex", gap: "0.5rem", alignItems: "center", flexWrap: "wrap" }}>
                    {/* Period Selector */}
                    <div style={{
                        display: "flex",
                        background: "rgba(255,255,255,0.05)",
                        borderRadius: "8px",
                        padding: "4px",
                    }}>
                        {(["7d", "30d", "90d"] as Period[]).map((p) => (
                            <button
                                key={p}
                                onClick={() => setPeriod(p)}
                                style={{
                                    padding: "0.5rem 1rem",
                                    borderRadius: "6px",
                                    border: "none",
                                    background: period === p ? "rgba(168, 85, 247, 0.2)" : "transparent",
                                    color: period === p ? "#a855f7" : "#94a3b8",
                                    cursor: "pointer",
                                    fontSize: "0.85rem",
                                    fontWeight: 500,
                                }}
                            >
                                {p === "7d" ? "7 dias" : p === "30d" ? "30 dias" : "90 dias"}
                            </button>
                        ))}
                    </div>
                    <button className="dash-btn secondary sm" onClick={fetchData}>
                        <RefreshCw style={{ width: 16, height: 16 }} />
                    </button>
                    <button
                        className="dash-btn primary sm"
                        onClick={() => setShowReport(true)}
                        style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}
                    >
                        <Download style={{ width: 16, height: 16 }} />
                        Exportar
                    </button>
                </div>
            </div>

            {/* Report Modal */}
            {showReport && data && (
                <AnalyticsReport
                    data={data}
                    onClose={() => setShowReport(false)}
                />
            )}

            {/* KPI Cards */}
            <div className="dash-stats-grid" style={{ marginBottom: '1.5rem' }}>
                {statsCards.map((stat, index) => (
                    <StatCard
                        key={index}
                        title={stat.title}
                        value={stat.value}
                        icon={stat.icon}
                        color={stat.color}
                        trend={stat.trend}
                        index={index}
                    />
                ))}
            </div>

            {/* Main Grid - Bento Box Layout */}
            <div style={{
                display: "grid",
                gridTemplateColumns: "1fr",
                gap: "1.5rem",
            }}
                className="analytics-grid"
            >
                {/* Conversas ao longo do tempo - 2x1 */}
                <div className="dash-card">
                    <div className="dash-card-header">
                        <h3 className="dash-card-title">
                            <TrendingUp style={{ color: "#22d3ee" }} />
                            Conversas ao Longo do Tempo
                        </h3>
                    </div>
                    <div className="dash-card-content">
                        <ConversationsLineChart data={data.conversationsOverTime} />
                    </div>
                </div>

                {/* Grid 2 colunas em desktop */}
                <div style={{
                    display: "grid",
                    gridTemplateColumns: "1fr",
                    gap: "1.5rem"
                }}
                    className="analytics-grid-2col"
                >
                    {/* Top Performers */}
                    <div className="dash-card">
                        <div className="dash-card-header">
                            <h3 className="dash-card-title">
                                <Target style={{ color: "#fbbf24" }} />
                                Top Performers
                            </h3>
                        </div>
                        <div className="dash-card-content">
                            <TopPerformersCard
                                agents={data.topPerformers.agents}
                                products={data.topPerformers.products}
                            />
                        </div>
                    </div>

                    {/* Taxa de Resolução */}
                    <div className="dash-card">
                        <div className="dash-card-header">
                            <h3 className="dash-card-title">
                                <Activity style={{ color: "#a855f7" }} />
                                Taxa de Resolução
                            </h3>
                        </div>
                        <div className="dash-card-content">
                            <ResolutionPieChart data={data.resolutionRate} />
                        </div>
                    </div>
                </div>

                {/* Heatmap - Full Width */}
                <div className="dash-card">
                    <div className="dash-card-header">
                        <h3 className="dash-card-title">
                            <Zap style={{ color: "#f59e0b" }} />
                            Mapa de Calor - Horários de Atividade
                        </h3>
                    </div>
                    <div className="dash-card-content">
                        <HeatmapChart data={data.heatmapData} />
                    </div>
                </div>

                {/* Grid 3 colunas em desktop */}
                <div style={{
                    display: "grid",
                    gridTemplateColumns: "1fr",
                    gap: "1.5rem"
                }}
                    className="analytics-grid-3col"
                >
                    {/* Mensagens por Agente */}
                    {data.messagesByAgent.length > 0 && (
                        <div className="dash-card">
                            <div className="dash-card-header">
                                <h3 className="dash-card-title">
                                    <Users style={{ color: "#a855f7" }} />
                                    Mensagens por Agente
                                </h3>
                            </div>
                            <div className="dash-card-content">
                                <MessagesByAgentChart data={data.messagesByAgent} />
                            </div>
                        </div>
                    )}

                    {/* Distribuição de Status */}
                    <div className="dash-card">
                        <div className="dash-card-header">
                            <h3 className="dash-card-title">
                                <BarChart3 style={{ color: "#10b981" }} />
                                Distribuição de Status
                            </h3>
                        </div>
                        <div className="dash-card-content">
                            <StatusDistributionChart data={data.statusDistribution} />
                        </div>
                    </div>

                    {/* Funil de Vendas */}
                    <div className="dash-card">
                        <div className="dash-card-header">
                            <h3 className="dash-card-title">
                                <ShoppingCart style={{ color: "#34d399" }} />
                                Funil de Vendas
                            </h3>
                        </div>
                        <div className="dash-card-content">
                            {[
                                { label: "Conversas", value: data.funnel.conversations, color: "#22d3ee", width: 100 },
                                { label: "Interesses", value: data.funnel.interests, color: "#a855f7", width: 70 },
                                { label: "Vendas", value: data.funnel.orders, color: "#34d399", width: 40 },
                            ].map((stage, i) => (
                                <div key={stage.label} style={{ marginBottom: i < 2 ? "1rem" : 0 }}>
                                    <div style={{
                                        display: "flex",
                                        justifyContent: "space-between",
                                        marginBottom: "0.5rem",
                                        fontSize: "0.85rem",
                                    }}>
                                        <span style={{ color: "#94a3b8" }}>{stage.label}</span>
                                        <span style={{ color: "white", fontWeight: 600 }}>{stage.value}</span>
                                    </div>
                                    <div style={{
                                        height: 8,
                                        background: "rgba(255,255,255,0.08)",
                                        borderRadius: 4,
                                        overflow: "hidden",
                                    }}>
                                        <div style={{
                                            width: `${stage.width}%`,
                                            height: "100%",
                                            background: stage.color,
                                            borderRadius: 4,
                                        }} />
                                    </div>
                                </div>
                            ))}
                            <div style={{
                                marginTop: "1rem",
                                padding: "0.75rem",
                                background: "rgba(52, 211, 153, 0.1)",
                                borderRadius: 8,
                                textAlign: "center",
                            }}>
                                <span style={{ fontSize: "0.85rem", color: "#94a3b8" }}>Taxa de conversão: </span>
                                <span style={{ fontSize: "1.1rem", color: "#34d399", fontWeight: 700 }}>
                                    {data.funnel.conversionRate}%
                                </span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Horários de Pico */}
                <div className="dash-card">
                    <div className="dash-card-header">
                        <h3 className="dash-card-title">
                            <Clock style={{ color: "#fbbf24" }} />
                            Horários de Pico
                        </h3>
                    </div>
                    <div className="dash-card-content">
                        <PeakHoursChart data={data.peakHours} />
                    </div>
                </div>

                {/* Agent Metrics Table */}
                {agentMetrics.length > 0 && (
                    <div className="dash-card" style={{ gridColumn: "1 / -1" }}>
                        <div className="dash-card-header">
                            <h3 className="dash-card-title">
                                <Bot style={{ color: "#a855f7" }} />
                                Performance por Agente
                            </h3>
                        </div>
                        <div className="dash-card-content">
                            <div style={{ overflowX: "auto" }}>
                                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                                    <thead>
                                        <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.1)" }}>
                                            <th style={{ textAlign: "left", padding: "12px 8px", color: "#94a3b8", fontSize: 12, fontWeight: 500 }}>Agente</th>
                                            <th style={{ textAlign: "center", padding: "12px 8px", color: "#94a3b8", fontSize: 12, fontWeight: 500 }}>Status</th>
                                            <th style={{ textAlign: "right", padding: "12px 8px", color: "#94a3b8", fontSize: 12, fontWeight: 500 }}>Conversas</th>
                                            <th style={{ textAlign: "right", padding: "12px 8px", color: "#94a3b8", fontSize: 12, fontWeight: 500 }}>Resolvidas</th>
                                            <th style={{ textAlign: "right", padding: "12px 8px", color: "#94a3b8", fontSize: 12, fontWeight: 500 }}>Mensagens</th>
                                            <th style={{ textAlign: "right", padding: "12px 8px", color: "#94a3b8", fontSize: 12, fontWeight: 500 }}>Satisfação</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {agentMetrics.map((agent) => (
                                            <tr key={agent.id} style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
                                                <td style={{ padding: "12px 8px" }}>
                                                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                                        <Bot size={16} style={{ color: "#a855f7" }} />
                                                        <span style={{ color: "#fff", fontWeight: 500 }}>{agent.name}</span>
                                                    </div>
                                                </td>
                                                <td style={{ textAlign: "center", padding: "12px 8px" }}>
                                                    <span style={{
                                                        padding: "4px 8px",
                                                        borderRadius: 12,
                                                        fontSize: 11,
                                                        background: agent.isActive ? "rgba(52, 211, 153, 0.2)" : "rgba(248, 113, 113, 0.2)",
                                                        color: agent.isActive ? "#34d399" : "#f87171",
                                                    }}>
                                                        {agent.isActive ? "Ativo" : "Inativo"}
                                                    </span>
                                                </td>
                                                <td style={{ textAlign: "right", padding: "12px 8px", color: "#e2e8f0", fontWeight: 600 }}>
                                                    {agent.totalConversations}
                                                </td>
                                                <td style={{ textAlign: "right", padding: "12px 8px", color: "#34d399" }}>
                                                    {agent.resolvedConversations}
                                                </td>
                                                <td style={{ textAlign: "right", padding: "12px 8px", color: "#60a5fa" }}>
                                                    {agent.totalMessages}
                                                </td>
                                                <td style={{ textAlign: "right", padding: "12px 8px" }}>
                                                    {agent.satisfactionRate !== null ? (
                                                        <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 6 }}>
                                                            <div style={{
                                                                width: 40,
                                                                height: 6,
                                                                background: "rgba(255,255,255,0.1)",
                                                                borderRadius: 3,
                                                                overflow: "hidden",
                                                            }}>
                                                                <div style={{
                                                                    width: `${agent.satisfactionRate}%`,
                                                                    height: "100%",
                                                                    background: agent.satisfactionRate >= 70 ? "#34d399" : agent.satisfactionRate >= 40 ? "#fbbf24" : "#f87171",
                                                                }} />
                                                            </div>
                                                            <span style={{ color: "#e2e8f0", fontSize: 12 }}>{agent.satisfactionRate}%</span>
                                                        </div>
                                                    ) : (
                                                        <span style={{ color: "#64748b" }}>-</span>
                                                    )}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* CSS for responsive grid */}
            <style jsx>{`
                @media (min-width: 768px) {
                    .analytics-grid-2col {
                        grid-template-columns: repeat(2, 1fr);
                    }
                }

                @media (min-width: 1024px) {
                    .analytics-grid-3col {
                        grid-template-columns: repeat(2, 1fr);
                    }
                }

                @media (min-width: 1440px) {
                    .analytics-grid-3col {
                        grid-template-columns: repeat(3, 1fr);
                    }
                }
            `}</style>
        </div>
    );
}
