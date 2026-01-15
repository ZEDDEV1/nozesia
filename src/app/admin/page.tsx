"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
    Building2,
    CreditCard,
    TrendingUp,
    MessageCircle,
    Smartphone,
    ArrowUpRight,
    ArrowDownRight,
    Users,
    Bot,
    Zap,
    RefreshCw,
    Eye,
    Sparkles,
    Activity,
    AlertTriangle,
    CheckCircle,
    XCircle,
    Clock,
} from "lucide-react";
import { formatCurrency, formatDate } from "@/lib/utils";

interface Stats {
    totalCompanies: number;
    activeCompanies: number;
    newCompaniesMonth: number;
    monthlyGrowth: number;
    totalMessages: number;
    messagesThisMonth: number;
    activeWhatsApp: number;
    totalWhatsApp: number;
    totalAgents: number;
    activeConversations: number;
    monthlyRevenue: number;
    totalTokens: number;
}

interface PlanRevenue {
    name: string;
    count: number;
    revenue: number;
    color: string;
}

interface RecentCompany {
    id: string;
    name: string;
    email: string;
    status: string;
    plan: string;
    revenue: number;
    messagesCount: number;
    createdAt: string;
}

interface MonitoringData {
    timestamp: string;
    metrics: {
        messagesLastMinute: number;
        messagesPerMinute: number;
        messagesLastHour: number;
        activeSessions: number;
        totalCompanies: number;
        activeConversations: number;
    };
    recentErrors: { id: string; action: string; details: string; time: string }[];
    systemHealth: {
        database: "healthy" | "unhealthy" | "unknown";
        redis: "healthy" | "unhealthy" | "unknown";
        openai: "healthy" | "unhealthy" | "unknown";
    };
}

export default function AdminDashboard() {
    const [loading, setLoading] = useState(true);
    const [stats, setStats] = useState<Stats | null>(null);
    const [planRevenue, setPlanRevenue] = useState<PlanRevenue[]>([]);
    const [recentCompanies, setRecentCompanies] = useState<RecentCompany[]>([]);
    const [monitoring, setMonitoring] = useState<MonitoringData | null>(null);

    useEffect(() => {
        fetchDashboardData();
        fetchMonitoring();

        // Auto-refresh monitoramento a cada 30 segundos
        const interval = setInterval(fetchMonitoring, 30000);
        return () => clearInterval(interval);
    }, []);

    const fetchDashboardData = async () => {
        try {
            setLoading(true);
            const response = await fetch("/api/admin/dashboard");
            const data = await response.json();

            if (data.success) {
                setStats(data.data.stats);
                setPlanRevenue(data.data.planRevenue);
                setRecentCompanies(data.data.recentCompanies);
            }
        } catch (error) {
            console.error("Error fetching dashboard:", error);
        } finally {
            setLoading(false);
        }
    };

    const fetchMonitoring = async () => {
        try {
            const response = await fetch("/api/admin/monitoring");
            const data = await response.json();
            if (data.success) {
                setMonitoring(data.data);
            }
        } catch (error) {
            console.error("Error fetching monitoring:", error);
        }
    };

    if (loading) {
        return (
            <div className="loading-container">
                <div className="loading-content">
                    <div className="loading-icon">
                        <Sparkles className="w-7 h-7 text-white" />
                    </div>
                    <div className="loading-spinner" />
                    <p className="loading-text">Carregando dashboard...</p>
                </div>
            </div>
        );
    }

    const kpiCards = stats ? [
        {
            title: "Empresas Ativas",
            value: stats.activeCompanies,
            meta: `de ${stats.totalCompanies} total`,
            change: `+${stats.newCompaniesMonth}`,
            trend: "up" as const,
            icon: Building2,
            color: "purple"
        },
        {
            title: "Receita Mensal",
            value: formatCurrency(stats.monthlyRevenue),
            meta: null,
            change: `+${stats.monthlyGrowth}%`,
            trend: stats.monthlyGrowth >= 0 ? "up" as const : "down" as const,
            icon: CreditCard,
            color: "green"
        },
        {
            title: "Mensagens",
            value: stats.messagesThisMonth.toLocaleString(),
            meta: `${stats.totalMessages.toLocaleString()} total`,
            change: "+23%",
            trend: "up" as const,
            icon: MessageCircle,
            color: "cyan"
        },
        {
            title: "WhatsApp",
            value: stats.activeWhatsApp,
            meta: `${stats.totalWhatsApp} sessões`,
            change: `${stats.activeWhatsApp} online`,
            trend: "up" as const,
            icon: Smartphone,
            color: "blue"
        },
    ] : [];

    const quickStats = stats ? [
        { label: "Agentes IA", value: stats.totalAgents, icon: Bot, bg: "rgba(139, 92, 246, 0.15)", color: "#8b5cf6" },
        { label: "Conversas", value: stats.activeConversations, icon: Users, bg: "rgba(6, 182, 212, 0.15)", color: "#06b6d4" },
        { label: "Tokens", value: (stats.totalTokens / 1000).toFixed(1) + "K", icon: Zap, bg: "rgba(16, 185, 129, 0.15)", color: "#10b981" },
        { label: "Uptime", value: "99.9%", icon: Activity, bg: "rgba(59, 130, 246, 0.15)", color: "#3b82f6" },
    ] : [];

    const getStatusClass = (status: string) => {
        switch (status) {
            case "ACTIVE": return "active";
            case "PENDING": return "pending";
            case "SUSPENDED": return "suspended";
            default: return "pending";
        }
    };

    const getStatusLabel = (status: string) => {
        switch (status) {
            case "ACTIVE": return "Ativo";
            case "PENDING": return "Pendente";
            case "SUSPENDED": return "Suspenso";
            default: return status;
        }
    };

    const getPlanClass = (plan: string) => {
        switch (plan) {
            case "BASIC": return "basic";
            case "PRO": return "pro";
            case "ENTERPRISE": return "enterprise";
            default: return "basic";
        }
    };

    return (
        <div className="dashboard-page">
            {/* Page Header */}
            <div className="page-header">
                <div className="page-title-section">
                    <div className="status-indicator">
                        <span className="status-dot" />
                        Sistema Online
                    </div>
                    <h1 className="page-title">
                        Dashboard <span className="highlight">Administrativo</span>
                    </h1>
                    <p className="page-subtitle">Visão geral em tempo real do seu SaaS</p>
                </div>
                <button onClick={fetchDashboardData} className="refresh-btn">
                    <RefreshCw className="w-4 h-4" />
                    Atualizar
                </button>
            </div>

            {/* KPI Cards */}
            <div className="kpi-grid">
                {kpiCards.map((kpi, index) => (
                    <div key={index} className="kpi-card">
                        <div className="kpi-content">
                            <div className="kpi-info">
                                <span className="kpi-label">{kpi.title}</span>
                                <span className="kpi-value">{kpi.value}</span>
                                {kpi.meta && <span className="kpi-meta">{kpi.meta}</span>}
                                <div className={`kpi-trend ${kpi.trend}`}>
                                    {kpi.trend === "up" ? (
                                        <ArrowUpRight className="w-3 h-3" />
                                    ) : (
                                        <ArrowDownRight className="w-3 h-3" />
                                    )}
                                    {kpi.change}
                                </div>
                            </div>
                            <div className={`kpi-icon ${kpi.color}`}>
                                <kpi.icon />
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            {/* Quick Stats */}
            <div className="stats-grid">
                {quickStats.map((stat, index) => (
                    <div key={index} className="stat-card">
                        <div className="stat-icon" style={{ background: stat.bg }}>
                            <stat.icon style={{ color: stat.color }} />
                        </div>
                        <div className="stat-info">
                            <span className="stat-value">{stat.value}</span>
                            <span className="stat-label">{stat.label}</span>
                        </div>
                    </div>
                ))}
            </div>

            {/* Monitoramento em Tempo Real */}
            {monitoring && (
                <div className="panel-card" style={{ marginBottom: '1.5rem' }}>
                    <div className="panel-header">
                        <div className="panel-title">
                            <div className="panel-title-icon cyan">
                                <Activity />
                            </div>
                            Monitoramento em Tempo Real
                            <span style={{
                                fontSize: '0.75rem',
                                color: '#64748b',
                                marginLeft: '0.5rem',
                                fontWeight: 400
                            }}>
                                (atualiza a cada 30s)
                            </span>
                        </div>
                        <button onClick={fetchMonitoring} className="panel-link" style={{ cursor: 'pointer' }}>
                            <RefreshCw className="w-3 h-3" />
                            Atualizar
                        </button>
                    </div>
                    <div className="panel-body">
                        {/* Métricas em tempo real */}
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1rem', marginBottom: '1.5rem' }}>
                            <div style={{
                                padding: '1rem',
                                background: 'rgba(34, 211, 238, 0.1)',
                                borderRadius: '12px',
                                border: '1px solid rgba(34, 211, 238, 0.2)'
                            }}>
                                <div style={{ fontSize: '0.75rem', color: '#22d3ee', marginBottom: '0.25rem' }}>
                                    <Clock style={{ width: 14, height: 14, display: 'inline', marginRight: '0.25rem' }} />
                                    Último Minuto
                                </div>
                                <div style={{ fontSize: '1.5rem', fontWeight: 600, color: 'white' }}>
                                    {monitoring.metrics.messagesLastMinute}
                                </div>
                                <div style={{ fontSize: '0.75rem', color: '#64748b' }}>mensagens</div>
                            </div>
                            <div style={{
                                padding: '1rem',
                                background: 'rgba(168, 85, 247, 0.1)',
                                borderRadius: '12px',
                                border: '1px solid rgba(168, 85, 247, 0.2)'
                            }}>
                                <div style={{ fontSize: '0.75rem', color: '#a855f7', marginBottom: '0.25rem' }}>
                                    <Activity style={{ width: 14, height: 14, display: 'inline', marginRight: '0.25rem' }} />
                                    Média/min
                                </div>
                                <div style={{ fontSize: '1.5rem', fontWeight: 600, color: 'white' }}>
                                    {monitoring.metrics.messagesPerMinute}
                                </div>
                                <div style={{ fontSize: '0.75rem', color: '#64748b' }}>msgs/min</div>
                            </div>
                            <div style={{
                                padding: '1rem',
                                background: 'rgba(34, 197, 94, 0.1)',
                                borderRadius: '12px',
                                border: '1px solid rgba(34, 197, 94, 0.2)'
                            }}>
                                <div style={{ fontSize: '0.75rem', color: '#22c55e', marginBottom: '0.25rem' }}>
                                    <Smartphone style={{ width: 14, height: 14, display: 'inline', marginRight: '0.25rem' }} />
                                    Sessões
                                </div>
                                <div style={{ fontSize: '1.5rem', fontWeight: 600, color: 'white' }}>
                                    {monitoring.metrics.activeSessions}
                                </div>
                                <div style={{ fontSize: '0.75rem', color: '#64748b' }}>WhatsApp ativas</div>
                            </div>
                            <div style={{
                                padding: '1rem',
                                background: 'rgba(251, 191, 36, 0.1)',
                                borderRadius: '12px',
                                border: '1px solid rgba(251, 191, 36, 0.2)'
                            }}>
                                <div style={{ fontSize: '0.75rem', color: '#fbbf24', marginBottom: '0.25rem' }}>
                                    <MessageCircle style={{ width: 14, height: 14, display: 'inline', marginRight: '0.25rem' }} />
                                    Conversas Ativas
                                </div>
                                <div style={{ fontSize: '1.5rem', fontWeight: 600, color: 'white' }}>
                                    {monitoring.metrics.activeConversations}
                                </div>
                                <div style={{ fontSize: '0.75rem', color: '#64748b' }}>última hora</div>
                            </div>
                        </div>

                        {/* Status dos Serviços */}
                        <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                {monitoring.systemHealth.database === 'healthy' ? (
                                    <CheckCircle style={{ width: 16, height: 16, color: '#22c55e' }} />
                                ) : (
                                    <XCircle style={{ width: 16, height: 16, color: '#ef4444' }} />
                                )}
                                <span style={{ fontSize: '0.875rem', color: '#94a3b8' }}>Database</span>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                {monitoring.systemHealth.redis === 'healthy' ? (
                                    <CheckCircle style={{ width: 16, height: 16, color: '#22c55e' }} />
                                ) : monitoring.systemHealth.redis === 'unknown' ? (
                                    <AlertTriangle style={{ width: 16, height: 16, color: '#fbbf24' }} />
                                ) : (
                                    <XCircle style={{ width: 16, height: 16, color: '#ef4444' }} />
                                )}
                                <span style={{ fontSize: '0.875rem', color: '#94a3b8' }}>Redis</span>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                {monitoring.systemHealth.openai === 'healthy' ? (
                                    <CheckCircle style={{ width: 16, height: 16, color: '#22c55e' }} />
                                ) : (
                                    <XCircle style={{ width: 16, height: 16, color: '#ef4444' }} />
                                )}
                                <span style={{ fontSize: '0.875rem', color: '#94a3b8' }}>OpenAI</span>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Main Content Grid */}
            <div className="content-grid">
                {/* Recent Companies Table */}
                <div className="panel-card">
                    <div className="panel-header">
                        <div className="panel-title">
                            <div className="panel-title-icon purple">
                                <Building2 />
                            </div>
                            Empresas Recentes
                        </div>
                        <Link href="/admin/companies" className="panel-link">
                            Ver todas
                            <ArrowUpRight className="w-3 h-3" />
                        </Link>
                    </div>
                    <div className="panel-body">
                        <div className="table-container">
                            <table className="data-table">
                                <thead>
                                    <tr>
                                        <th>Empresa</th>
                                        <th>Plano</th>
                                        <th>Status</th>
                                        <th className="text-right">Receita</th>
                                        <th className="text-right"></th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {recentCompanies.map((company) => (
                                        <tr key={company.id}>
                                            <td>
                                                <div className="company-cell">
                                                    <div className="company-avatar">
                                                        {company.name.charAt(0)}
                                                    </div>
                                                    <div className="company-info">
                                                        <div className="company-name">{company.name}</div>
                                                        <div className="company-date">{formatDate(company.createdAt)}</div>
                                                    </div>
                                                </div>
                                            </td>
                                            <td>
                                                <span className={`plan-badge ${getPlanClass(company.plan)}`}>
                                                    {company.plan}
                                                </span>
                                            </td>
                                            <td>
                                                <span className={`status-badge ${getStatusClass(company.status)}`}>
                                                    <span className="status-badge-dot" />
                                                    {getStatusLabel(company.status)}
                                                </span>
                                            </td>
                                            <td className="text-right">
                                                <span className="revenue-value">
                                                    {formatCurrency(company.revenue)}
                                                </span>
                                            </td>
                                            <td className="text-right">
                                                <Link href={`/admin/companies/${company.id}`} className="action-btn">
                                                    <Eye className="w-4 h-4" />
                                                </Link>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>

                {/* Revenue by Plan */}
                <div className="panel-card">
                    <div className="panel-header">
                        <div className="panel-title">
                            <div className="panel-title-icon green">
                                <TrendingUp />
                            </div>
                            Receita por Plano
                        </div>
                    </div>
                    <div className="panel-body chart-content">
                        {planRevenue.map((plan, index) => {
                            const totalRevenue = planRevenue.reduce((sum, p) => sum + p.revenue, 0);
                            const percentage = totalRevenue > 0 ? (plan.revenue / totalRevenue) * 100 : 0;
                            const colorClass = plan.color === "purple" ? "purple" : plan.color === "pink" ? "pink" : "slate";

                            return (
                                <div key={index} className="chart-item">
                                    <div className="chart-item-header">
                                        <div className="chart-item-label">
                                            <span className={`chart-dot ${colorClass}`} />
                                            {plan.name}
                                            <span className="chart-count">({plan.count})</span>
                                        </div>
                                        <span className="chart-item-value">{formatCurrency(plan.revenue)}</span>
                                    </div>
                                    <div className="chart-bar">
                                        <div
                                            className={`chart-bar-fill ${colorClass}`}
                                            style={{ width: `${percentage}%` }}
                                        />
                                    </div>
                                </div>
                            );
                        })}

                        <div className="chart-total">
                            <span className="chart-total-label">Total Mensal</span>
                            <span className="chart-total-value">
                                {formatCurrency(planRevenue.reduce((sum, p) => sum + p.revenue, 0))}
                            </span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
