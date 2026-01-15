"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
    Building2,
    RefreshCw,
    Search,
    Eye,
    Trash2,
    Bot,
    MessageCircle,
    CheckCircle2,
    Clock,
    Sparkles,
    AlertTriangle,
    CreditCard,
    Hourglass
} from "lucide-react";
import { cn } from "@/lib/utils";

interface Company {
    id: string;
    name: string;
    email: string;
    phone: string | null;
    status: string;
    plan: string;
    planName: string;
    subscriptionStatus: string;
    expiresAt: string | null;
    daysRemaining: number | null;
    agentsCount: number;
    sessionsCount: number;
    usersCount: number;
    messagesCount: number;
    createdAt: string;
}

interface Stats {
    total: number;
    active: number;
    pending: number;
    suspended: number;
}

export default function CompaniesPage() {
    const [companies, setCompanies] = useState<Company[]>([]);
    const [stats, setStats] = useState<Stats>({ total: 0, active: 0, pending: 0, suspended: 0 });
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState("");
    const [statusFilter, setStatusFilter] = useState("all");
    const [paymentFilter, setPaymentFilter] = useState("all"); // all, trial, paying, expired
    const [deleting, setDeleting] = useState<string | null>(null);

    useEffect(() => {
        fetchCompanies();
    }, []);

    const fetchCompanies = async () => {
        try {
            setLoading(true);
            const response = await fetch("/api/admin/companies");
            const data = await response.json();
            if (data.success) {
                setCompanies(data.data.companies);
                setStats(data.data.stats);
            }
        } catch (error) {
            console.error("Error fetching companies:", error);
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async (id: string, name: string) => {
        if (!confirm(`Tem certeza que deseja excluir a empresa "${name}"?\n\nEsta ação é IRREVERSÍVEL e excluirá:\n- Todos os usuários\n- Todos os agentes\n- Todas as conversas\n- Todas as sessões WhatsApp`)) {
            return;
        }

        try {
            setDeleting(id);
            const response = await fetch(`/api/admin/companies/${id}`, {
                method: "DELETE",
            });
            const data = await response.json();
            if (data.success) {
                fetchCompanies();
            } else {
                alert(data.error || "Erro ao excluir empresa");
            }
        } catch (error) {
            console.error("Error deleting company:", error);
            alert("Erro ao excluir empresa");
        } finally {
            setDeleting(null);
        }
    };

    const getStatusBadge = (status: string) => {
        switch (status) {
            case "ACTIVE":
                return { class: "active", label: "Ativo" };
            case "PENDING":
                return { class: "pending", label: "Pendente" };
            case "SUSPENDED":
                return { class: "suspended", label: "Suspenso" };
            default:
                return { class: "", label: status };
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

    const getExpirationBadge = (daysRemaining: number | null) => {
        if (daysRemaining === null) return null;

        if (daysRemaining <= 0) {
            return { class: "expired", label: "Expirado", color: "#ef4444" };
        } else if (daysRemaining <= 3) {
            return { class: "critical", label: `${daysRemaining}d`, color: "#ef4444" };
        } else if (daysRemaining <= 7) {
            return { class: "warning", label: `${daysRemaining}d`, color: "#f59e0b" };
        } else if (daysRemaining <= 14) {
            return { class: "soon", label: `${daysRemaining}d`, color: "#06b6d4" };
        }
        return { class: "ok", label: `${daysRemaining}d`, color: "#10b981" };
    };

    // Helper to get subscription status badge
    const getSubscriptionBadge = (subscriptionStatus: string, daysRemaining: number | null) => {
        if (subscriptionStatus === "ACTIVE") {
            return { class: "paying", label: "Pagando", icon: CreditCard, color: "#10b981" };
        }
        if (subscriptionStatus === "TRIAL") {
            return { class: "trial", label: "Trial", icon: Hourglass, color: "#f59e0b" };
        }
        if (daysRemaining !== null && daysRemaining > 0) {
            return { class: "trial", label: "Trial", icon: Hourglass, color: "#f59e0b" };
        }
        return { class: "expired", label: "Expirado", icon: AlertTriangle, color: "#ef4444" };
    };

    const filteredCompanies = companies.filter((company) => {
        const matchesSearch =
            company.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            company.email.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesStatus = statusFilter === "all" || company.status === statusFilter;

        // Payment filter
        let matchesPayment = true;
        if (paymentFilter === "paying") {
            matchesPayment = company.subscriptionStatus === "ACTIVE";
        } else if (paymentFilter === "trial") {
            matchesPayment = company.subscriptionStatus !== "ACTIVE" && company.daysRemaining !== null && company.daysRemaining > 0;
        } else if (paymentFilter === "expired") {
            matchesPayment = company.subscriptionStatus !== "ACTIVE" && (company.daysRemaining === null || company.daysRemaining <= 0);
        }

        return matchesSearch && matchesStatus && matchesPayment;
    });

    if (loading) {
        return (
            <div className="loading-container">
                <div className="loading-content">
                    <div className="loading-icon">
                        <Sparkles className="w-7 h-7 text-white" />
                    </div>
                    <div className="loading-spinner" />
                    <p className="loading-text">Carregando empresas...</p>
                </div>
            </div>
        );
    }

    // Count companies by payment status
    const payingCount = companies.filter(c => c.subscriptionStatus === "ACTIVE").length;
    const trialCount = companies.filter(c => c.subscriptionStatus !== "ACTIVE" && c.daysRemaining !== null && c.daysRemaining > 0).length;
    const expiredCount = companies.filter(c => c.subscriptionStatus !== "ACTIVE" && (c.daysRemaining === null || c.daysRemaining <= 0)).length;
    const _expiringSoon = companies.filter(c => c.daysRemaining !== null && c.daysRemaining <= 7 && c.daysRemaining > 0).length;

    const kpiCards = [
        {
            title: "Total de Empresas",
            value: stats.total,
            icon: Building2,
            color: "purple"
        },
        {
            title: "Empresas Ativas",
            value: stats.active,
            icon: CheckCircle2,
            color: "green"
        },
        {
            title: "Pagando",
            value: payingCount,
            icon: CreditCard,
            color: "green"
        },
        {
            title: "Trial",
            value: trialCount,
            icon: Hourglass,
            color: "cyan"
        },
        {
            title: "Expiradas",
            value: expiredCount,
            icon: AlertTriangle,
            color: "blue"
        },
    ];

    return (
        <div className="dashboard-page">
            {/* Page Header */}
            <div className="page-header">
                <div className="page-title-section">
                    <div className="status-indicator">
                        <span className="status-dot" />
                        Sistema Ativo
                    </div>
                    <h1 className="page-title">
                        Gerenciamento de <span className="highlight">Empresas</span>
                    </h1>
                    <p className="page-subtitle">Gerencie as empresas cadastradas no sistema</p>
                </div>
                <div className="flex gap-3">
                    <button onClick={fetchCompanies} className="refresh-btn">
                        <RefreshCw className="w-4 h-4" />
                        Atualizar
                    </button>
                </div>
            </div>

            {/* KPI Cards */}
            <div className="kpi-grid">
                {kpiCards.map((kpi, index) => (
                    <div key={index} className="kpi-card">
                        <div className="kpi-content">
                            <div className="kpi-info">
                                <span className="kpi-label">{kpi.title}</span>
                                <span className="kpi-value">{kpi.value}</span>
                            </div>
                            <div className={`kpi-icon ${kpi.color}`}>
                                <kpi.icon />
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            {/* Search and Filters */}
            <div className="filter-section">
                <div className="search-input">
                    <Search />
                    <input
                        type="text"
                        placeholder="Buscar por nome ou email..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
                <div className="filter-pills">
                    {[
                        { value: "all", label: "Todos" },
                        { value: "ACTIVE", label: "Ativos" },
                        { value: "PENDING", label: "Pendentes" },
                        { value: "SUSPENDED", label: "Suspensos" }
                    ].map((f) => (
                        <button
                            key={f.value}
                            onClick={() => setStatusFilter(f.value)}
                            className={cn("filter-pill", statusFilter === f.value && "active")}
                        >
                            {f.label}
                        </button>
                    ))}
                </div>
                <div className="filter-pills" style={{ marginLeft: '0.5rem' }}>
                    {[
                        { value: "all", label: "Todos", icon: null },
                        { value: "paying", label: "Pagando", icon: CreditCard },
                        { value: "trial", label: "Trial", icon: Hourglass },
                        { value: "expired", label: "Expirado", icon: AlertTriangle }
                    ].map((f) => (
                        <button
                            key={`payment-${f.value}`}
                            onClick={() => setPaymentFilter(f.value)}
                            className={cn("filter-pill", paymentFilter === f.value && "active")}
                        >
                            {f.icon && <f.icon style={{ width: 14, height: 14 }} />}
                            {f.label}
                        </button>
                    ))}
                </div>
            </div>

            {/* Companies Table */}
            <div className="panel-card">
                <div className="panel-header">
                    <div className="panel-title">
                        <div className="panel-title-icon purple">
                            <Building2 />
                        </div>
                        Empresas ({filteredCompanies.length})
                    </div>
                </div>
                <div className="panel-body">
                    <div className="table-container">
                        <table className="data-table">
                            <thead>
                                <tr>
                                    <th>Empresa</th>
                                    <th>Plano</th>
                                    <th>Pagamento</th>
                                    <th>Expira em</th>
                                    <th>Status</th>
                                    <th className="text-right">Agentes</th>
                                    <th className="text-right">Conversas</th>
                                    <th>Ações</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredCompanies.map((company) => {
                                    const statusBadge = getStatusBadge(company.status);
                                    const expirationBadge = getExpirationBadge(company.daysRemaining);
                                    const subscriptionBadge = getSubscriptionBadge(company.subscriptionStatus, company.daysRemaining);
                                    return (
                                        <tr key={company.id}>
                                            <td>
                                                <div className="company-cell">
                                                    <div className="company-avatar">
                                                        <Building2 className="w-5 h-5" />
                                                    </div>
                                                    <div className="company-info">
                                                        <div className="company-name">{company.name}</div>
                                                        <div className="company-date">{company.email}</div>
                                                    </div>
                                                </div>
                                            </td>
                                            <td>
                                                <span className={`plan-badge ${getPlanClass(company.plan)}`}>
                                                    {company.planName}
                                                </span>
                                            </td>
                                            <td>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                                    <subscriptionBadge.icon style={{ width: 14, height: 14, color: subscriptionBadge.color }} />
                                                    <span style={{
                                                        color: subscriptionBadge.color,
                                                        fontWeight: 600,
                                                        fontSize: '0.85rem'
                                                    }}>
                                                        {subscriptionBadge.label}
                                                    </span>
                                                </div>
                                            </td>
                                            <td>
                                                {expirationBadge ? (
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                                        <Clock style={{ width: 14, height: 14, color: expirationBadge.color }} />
                                                        <span style={{
                                                            color: expirationBadge.color,
                                                            fontWeight: 600,
                                                            fontSize: '0.85rem'
                                                        }}>
                                                            {expirationBadge.label}
                                                        </span>
                                                    </div>
                                                ) : (
                                                    <span className="text-muted">-</span>
                                                )}
                                            </td>
                                            <td>
                                                <span className={`status-badge ${statusBadge.class}`}>
                                                    <span className="status-badge-dot" />
                                                    {statusBadge.label}
                                                </span>
                                            </td>
                                            <td className="text-right">
                                                <div className="flex items-center justify-end gap-2">
                                                    <Bot className="w-4 h-4 text-primary" />
                                                    <span className="font-semibold text-white">{company.agentsCount}</span>
                                                </div>
                                            </td>
                                            <td className="text-right">
                                                <div className="flex items-center justify-end gap-2">
                                                    <MessageCircle className="w-4 h-4 text-cyan" />
                                                    <span className="font-semibold text-white">{company.messagesCount}</span>
                                                </div>
                                            </td>
                                            <td>
                                                <div style={{ display: 'flex', gap: '0.5rem' }}>
                                                    <Link
                                                        href={`/admin/companies/${company.id}`}
                                                        className="icon-btn"
                                                        title="Ver detalhes"
                                                    >
                                                        <Eye style={{ width: 16, height: 16 }} />
                                                    </Link>
                                                    <button
                                                        onClick={() => handleDelete(company.id, company.name)}
                                                        disabled={deleting === company.id}
                                                        className="icon-btn danger"
                                                        title="Excluir empresa"
                                                    >
                                                        {deleting === company.id ? (
                                                            <RefreshCw style={{ width: 16, height: 16, animation: 'spin 1s linear infinite' }} />
                                                        ) : (
                                                            <Trash2 style={{ width: 16, height: 16 }} />
                                                        )}
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            {/* Empty State */}
            {filteredCompanies.length === 0 && (
                <div className="empty-state">
                    <div className="empty-state-icon">
                        <Building2 />
                    </div>
                    <h3 className="empty-state-title">Nenhuma empresa encontrada</h3>
                    <p className="empty-state-text">Não há empresas com os filtros selecionados.</p>
                </div>
            )}
        </div>
    );
}
