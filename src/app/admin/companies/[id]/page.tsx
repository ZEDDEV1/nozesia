"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
    Building2,
    ArrowLeft,
    Mail,
    Phone,
    Calendar,
    Users,
    Bot,
    Smartphone,
    MessageCircle,
    Zap,
    CreditCard,
    Edit2,
    Save,
    Loader2,
    Trash2,
    X,
    Gauge,
    AlertTriangle,
    Plus,
    Minus,
    Hourglass,
    Wifi,
    WifiOff,
    Sparkles,
    RefreshCw,
    FileText,
    CheckCircle,
} from "lucide-react";
import { formatDate, formatCurrency } from "@/lib/utils";

interface Company {
    id: string;
    name: string;
    email: string;
    phone: string | null;
    document: string | null;
    status: string;
    timezone: string;
    createdAt: string;
    subscription: {
        plan: {
            id: string;
            name: string;
            price: number;
            maxTokensMonth: number;
        };
    } | null;
    users: Array<{
        id: string;
        name: string;
        email: string;
        role: string;
        createdAt: string;
        lastLoginAt: string | null;
    }>;
    aiAgents: Array<{
        id: string;
        name: string;
        isActive: boolean;
    }>;
    whatsAppSessions: Array<{
        id: string;
        sessionName: string;
        phoneNumber: string | null;
        status: string;
    }>;
    conversations: Array<{
        id: string;
        customerName: string;
        status: string;
        updatedAt: string;
        _count: { messages: number };
    }>;
    tokenUsage: Array<{
        month: string;
        inputTokens: number;
        outputTokens: number;
    }>;
    _count: {
        users: number;
        aiAgents: number;
        whatsAppSessions: number;
        conversations: number;
        messages: number;
    };
    monthlyTokenLimit: number;
    trialEndsAt: string | null;
    extraAgents: number;
    extraWhatsApps: number;
}

interface Plan {
    id: string;
    name: string;
    price: number;
    maxTokensMonth?: number;
}

interface PageProps {
    params: Promise<{ id: string }>;
}

interface Invoice {
    id: string;
    amount: number;
    description: string | null;
    dueDate: string | null;
    paidAt: string | null;
    status: string;
    createdAt: string;
}

export default function CompanyDetailPage({ params }: PageProps) {
    const router = useRouter();
    const [company, setCompany] = useState<Company | null>(null);
    const [plans, setPlans] = useState<Plan[]>([]);
    const [loading, setLoading] = useState(true);
    const [editing, setEditing] = useState(false);
    const [saving, setSaving] = useState(false);
    const [formData, setFormData] = useState({
        name: "",
        email: "",
        phone: "",
        status: "",
        planId: "",
        monthlyTokenLimit: 0,
        extraAgents: 0,
        extraWhatsApps: 0,
    });
    const [companyId, setCompanyId] = useState<string>("");
    const [actionLoading, setActionLoading] = useState<string | null>(null);
    const [invoices, setInvoices] = useState<Invoice[]>([]);
    const [invoicesLoading, setInvoicesLoading] = useState(false);

    useEffect(() => {
        const loadParams = async () => {
            const { id } = await params;
            setCompanyId(id);
        };
        loadParams();
    }, [params]);

    useEffect(() => {
        if (companyId) {
            fetchCompany();
            fetchPlans();
            fetchInvoices();
        }
    }, [companyId]);

    const fetchCompany = async () => {
        try {
            setLoading(true);
            const response = await fetch(`/api/admin/companies/${companyId}`);
            const data = await response.json();
            if (data.success) {
                setCompany(data.data);
                setFormData({
                    name: data.data.name,
                    email: data.data.email,
                    phone: data.data.phone || "",
                    status: data.data.status,
                    planId: data.data.subscription?.plan?.id || "",
                    monthlyTokenLimit: data.data.monthlyTokenLimit || 0,
                    extraAgents: data.data.extraAgents || 0,
                    extraWhatsApps: data.data.extraWhatsApps || 0,
                });
            }
        } catch (error) {
            console.error("Error fetching company:", error);
        } finally {
            setLoading(false);
        }
    };

    const fetchPlans = async () => {
        try {
            const response = await fetch("/api/admin/plans");
            const data = await response.json();
            if (data.success) {
                setPlans(data.data);
            }
        } catch (error) {
            console.error("Error fetching plans:", error);
        }
    };

    const fetchInvoices = async () => {
        try {
            setInvoicesLoading(true);
            const response = await fetch(`/api/admin/companies/${companyId}/invoices`);
            const data = await response.json();
            if (data.success) {
                setInvoices(data.data.invoices || []);
            }
        } catch (error) {
            console.error("Error fetching invoices:", error);
        } finally {
            setInvoicesLoading(false);
        }
    };

    const handleSave = async () => {
        setSaving(true);
        try {
            const response = await fetch(`/api/admin/companies/${companyId}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(formData),
            });
            const data = await response.json();
            if (data.success) {
                setEditing(false);
                fetchCompany();
            }
        } catch (error) {
            console.error("Error saving company:", error);
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async () => {
        if (!confirm("Tem certeza que deseja EXCLUIR esta empresa? Todos os dados serão perdidos.")) return;
        if (!confirm("Esta ação é IRREVERSÍVEL. Confirmar exclusão?")) return;

        try {
            const response = await fetch(`/api/admin/companies/${companyId}`, {
                method: "DELETE",
            });
            const data = await response.json();
            if (data.success) {
                router.push("/admin/companies");
            }
        } catch (error) {
            console.error("Error deleting company:", error);
        }
    };

    const handleExtendTrial = async (days: number) => {
        if (!confirm(`Estender trial por ${days} dias?`)) return;

        setActionLoading(`extend-${days}`);
        try {
            const response = await fetch(`/api/admin/companies/${companyId}/extend-trial`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ days }),
            });
            const data = await response.json();
            if (data.success) {
                fetchCompany();
                alert(`Trial estendido em ${days} dias!`);
            } else {
                alert(data.error || "Erro ao estender trial");
            }
        } catch (error) {
            console.error("Error extending trial:", error);
        } finally {
            setActionLoading(null);
        }
    };

    const handleUpdateExtras = async (field: "extraAgents" | "extraWhatsApps", delta: number) => {
        const currentValue = formData[field];
        const newValue = Math.max(0, currentValue + delta);

        setActionLoading(`${field}-${delta > 0 ? 'plus' : 'minus'}`);
        try {
            const response = await fetch(`/api/admin/companies/${companyId}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ [field]: newValue }),
            });
            const data = await response.json();
            if (data.success) {
                setFormData({ ...formData, [field]: newValue });
                fetchCompany();
            } else {
                alert(data.error || "Erro ao atualizar extras");
            }
        } catch (error) {
            console.error("Error updating extras:", error);
        } finally {
            setActionLoading(null);
        }
    };

    const getStatusBadge = (status: string) => {
        switch (status) {
            case "ACTIVE": return { class: "active", label: "Ativo" };
            case "PENDING": return { class: "pending", label: "Pendente" };
            case "SUSPENDED": return { class: "suspended", label: "Suspenso" };
            default: return { class: "", label: status };
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

    if (loading) {
        return (
            <div className="loading-container">
                <div className="loading-content">
                    <div className="loading-icon">
                        <Sparkles className="w-7 h-7 text-white" />
                    </div>
                    <div className="loading-spinner" />
                    <p className="loading-text">Carregando empresa...</p>
                </div>
            </div>
        );
    }

    if (!company) {
        return (
            <div className="empty-state">
                <div className="empty-state-icon">
                    <Building2 />
                </div>
                <h3 className="empty-state-title">Empresa não encontrada</h3>
                <Link href="/admin/companies" className="panel-link">
                    Voltar para lista
                </Link>
            </div>
        );
    }

    const statusBadge = getStatusBadge(company.status);

    const kpiCards = [
        { title: "Usuários", value: company._count.users, icon: Users, color: "purple" },
        { title: "Agentes IA", value: company._count.aiAgents, icon: Bot, color: "cyan" },
        { title: "WhatsApp", value: company._count.whatsAppSessions, icon: Smartphone, color: "green" },
        { title: "Conversas", value: company._count.conversations, icon: MessageCircle, color: "blue" },
        { title: "Mensagens", value: company._count.messages, icon: Zap, color: "purple" },
    ];

    return (
        <div className="dashboard-page">
            {/* Page Header */}
            <div className="page-header">
                <div className="page-title-section">
                    <Link href="/admin/companies" className="status-indicator" style={{ cursor: 'pointer', textDecoration: 'none' }}>
                        <ArrowLeft style={{ width: 14, height: 14 }} />
                        Voltar
                    </Link>
                    <h1 className="page-title">
                        {company.name}
                    </h1>
                    <p className="page-subtitle">{company.email}</p>
                </div>
                <div className="flex gap-3">
                    {editing ? (
                        <>
                            <button onClick={() => setEditing(false)} className="refresh-btn">
                                <X className="w-4 h-4" />
                                Cancelar
                            </button>
                            <button onClick={handleSave} disabled={saving} className="refresh-btn" style={{ background: 'rgba(16, 185, 129, 0.2)', borderColor: 'rgba(16, 185, 129, 0.3)' }}>
                                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                                Salvar
                            </button>
                        </>
                    ) : (
                        <>
                            <button onClick={fetchCompany} className="refresh-btn">
                                <RefreshCw className="w-4 h-4" />
                                Atualizar
                            </button>
                            <button onClick={() => setEditing(true)} className="refresh-btn">
                                <Edit2 className="w-4 h-4" />
                                Editar
                            </button>
                            <button onClick={handleDelete} className="refresh-btn" style={{ background: 'rgba(239, 68, 68, 0.2)', borderColor: 'rgba(239, 68, 68, 0.3)' }}>
                                <Trash2 className="w-4 h-4" />
                                Excluir
                            </button>
                        </>
                    )}
                </div>
            </div>

            {/* KPI Cards */}
            <div className="kpi-grid" style={{ gridTemplateColumns: 'repeat(5, 1fr)' }}>
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

            {/* Company Info + Plan */}
            <div className="content-grid">
                {/* Company Info Panel */}
                <div className="panel-card">
                    <div className="panel-header">
                        <div className="panel-title">
                            <div className="panel-title-icon purple">
                                <Building2 />
                            </div>
                            Informações da Empresa
                        </div>
                        <span className={`status-badge ${statusBadge.class}`}>
                            <span className="status-badge-dot" />
                            {statusBadge.label}
                        </span>
                    </div>
                    <div className="panel-body">
                        {editing ? (
                            <div style={{ display: 'grid', gap: '1rem' }}>
                                <div>
                                    <label style={{ display: 'block', fontSize: '0.75rem', color: '#94a3b8', marginBottom: '0.5rem' }}>Nome</label>
                                    <input
                                        type="text"
                                        value={formData.name}
                                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                        className="search-input"
                                        style={{ width: '100%' }}
                                    />
                                </div>
                                <div>
                                    <label style={{ display: 'block', fontSize: '0.75rem', color: '#94a3b8', marginBottom: '0.5rem' }}>Email</label>
                                    <input
                                        type="email"
                                        value={formData.email}
                                        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                        className="search-input"
                                        style={{ width: '100%' }}
                                    />
                                </div>
                                <div>
                                    <label style={{ display: 'block', fontSize: '0.75rem', color: '#94a3b8', marginBottom: '0.5rem' }}>Telefone</label>
                                    <input
                                        type="text"
                                        value={formData.phone}
                                        onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                                        className="search-input"
                                        style={{ width: '100%' }}
                                    />
                                </div>
                                <div>
                                    <label style={{ display: 'block', fontSize: '0.75rem', color: '#94a3b8', marginBottom: '0.5rem' }}>Status</label>
                                    <select
                                        value={formData.status}
                                        onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                                        style={{
                                            width: '100%',
                                            padding: '0.75rem 1rem',
                                            background: 'rgba(15, 23, 42, 0.6)',
                                            border: '1px solid rgba(148, 163, 184, 0.2)',
                                            borderRadius: '12px',
                                            color: 'white',
                                            fontSize: '0.875rem'
                                        }}
                                    >
                                        <option value="ACTIVE">Ativo</option>
                                        <option value="PENDING">Pendente</option>
                                        <option value="SUSPENDED">Suspenso</option>
                                    </select>
                                </div>
                                <div>
                                    <label style={{ display: 'block', fontSize: '0.75rem', color: '#94a3b8', marginBottom: '0.5rem' }}>Plano</label>
                                    <select
                                        value={formData.planId}
                                        onChange={(e) => setFormData({ ...formData, planId: e.target.value })}
                                        style={{
                                            width: '100%',
                                            padding: '0.75rem 1rem',
                                            background: 'rgba(15, 23, 42, 0.6)',
                                            border: '1px solid rgba(148, 163, 184, 0.2)',
                                            borderRadius: '12px',
                                            color: 'white',
                                            fontSize: '0.875rem'
                                        }}
                                    >
                                        <option value="">Sem plano</option>
                                        {plans.map((plan) => (
                                            <option key={plan.id} value={plan.id}>{plan.name} - {formatCurrency(plan.price)}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>
                        ) : (
                            <div style={{ display: 'grid', gap: '0.75rem' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                    <Mail style={{ width: 16, height: 16, color: '#64748b' }} />
                                    <span style={{ color: '#e2e8f0' }}>{company.email}</span>
                                </div>
                                {company.phone && (
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                        <Phone style={{ width: 16, height: 16, color: '#64748b' }} />
                                        <span style={{ color: '#e2e8f0' }}>{company.phone}</span>
                                    </div>
                                )}
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                    <Calendar style={{ width: 16, height: 16, color: '#64748b' }} />
                                    <span style={{ color: '#e2e8f0' }}>{formatDate(company.createdAt)}</span>
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                    <CreditCard style={{ width: 16, height: 16, color: '#64748b' }} />
                                    {company.subscription ? (
                                        <span className={`plan-badge ${getPlanClass(company.subscription.plan.name.toUpperCase())}`}>
                                            {company.subscription.plan.name} - {formatCurrency(company.subscription.plan.price)}
                                        </span>
                                    ) : (
                                        <span style={{ color: '#64748b' }}>Sem plano</span>
                                    )}
                                </div>
                                {company.trialEndsAt && (
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                        <Hourglass style={{ width: 16, height: 16, color: '#f59e0b' }} />
                                        <span style={{ color: '#f59e0b' }}>Trial até: {formatDate(company.trialEndsAt)}</span>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>

                {/* Quick Actions Panel */}
                <div className="panel-card">
                    <div className="panel-header">
                        <div className="panel-title">
                            <div className="panel-title-icon cyan">
                                <Hourglass />
                            </div>
                            Ações Rápidas
                        </div>
                    </div>
                    <div className="panel-body">
                        {/* Trial Extension */}
                        <div style={{ marginBottom: '1.5rem' }}>
                            <h4 style={{ fontSize: '0.875rem', fontWeight: 500, color: '#e2e8f0', marginBottom: '0.75rem' }}>Estender Trial</h4>
                            <div style={{ display: 'flex', gap: '0.5rem' }}>
                                {[7, 14, 30].map((days) => (
                                    <button
                                        key={days}
                                        onClick={() => handleExtendTrial(days)}
                                        disabled={actionLoading === `extend-${days}`}
                                        className="filter-pill active"
                                        style={{ flex: 1 }}
                                    >
                                        {actionLoading === `extend-${days}` ? (
                                            <Loader2 style={{ width: 14, height: 14, animation: 'spin 1s linear infinite' }} />
                                        ) : (
                                            <>+{days}d</>
                                        )}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Extras */}
                        <div>
                            <h4 style={{ fontSize: '0.875rem', fontWeight: 500, color: '#e2e8f0', marginBottom: '0.75rem' }}>Extras</h4>
                            <div style={{ display: 'grid', gap: '0.75rem' }}>
                                {/* Extra Agents */}
                                <div style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'space-between',
                                    padding: '0.75rem 1rem',
                                    background: 'rgba(15, 23, 42, 0.6)',
                                    borderRadius: '12px',
                                    border: '1px solid rgba(148, 163, 184, 0.1)'
                                }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                        <Bot style={{ width: 16, height: 16, color: '#a855f7' }} />
                                        <span style={{ color: '#e2e8f0' }}>Agentes Extra</span>
                                    </div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                        <button
                                            onClick={() => handleUpdateExtras("extraAgents", -1)}
                                            disabled={formData.extraAgents === 0 || actionLoading?.includes("extraAgents")}
                                            className="icon-btn danger"
                                            style={{ padding: '0.25rem' }}
                                        >
                                            <Minus style={{ width: 14, height: 14 }} />
                                        </button>
                                        <span style={{ width: '2rem', textAlign: 'center', fontWeight: 600, color: 'white' }}>{formData.extraAgents}</span>
                                        <button
                                            onClick={() => handleUpdateExtras("extraAgents", 1)}
                                            disabled={actionLoading?.includes("extraAgents")}
                                            className="icon-btn"
                                            style={{ padding: '0.25rem', background: 'rgba(16, 185, 129, 0.2)', color: '#10b981' }}
                                        >
                                            <Plus style={{ width: 14, height: 14 }} />
                                        </button>
                                    </div>
                                </div>

                                {/* Extra WhatsApp */}
                                <div style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'space-between',
                                    padding: '0.75rem 1rem',
                                    background: 'rgba(15, 23, 42, 0.6)',
                                    borderRadius: '12px',
                                    border: '1px solid rgba(148, 163, 184, 0.1)'
                                }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                        <Smartphone style={{ width: 16, height: 16, color: '#22c55e' }} />
                                        <span style={{ color: '#e2e8f0' }}>WhatsApp Extra</span>
                                    </div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                        <button
                                            onClick={() => handleUpdateExtras("extraWhatsApps", -1)}
                                            disabled={formData.extraWhatsApps === 0 || actionLoading?.includes("extraWhatsApps")}
                                            className="icon-btn danger"
                                            style={{ padding: '0.25rem' }}
                                        >
                                            <Minus style={{ width: 14, height: 14 }} />
                                        </button>
                                        <span style={{ width: '2rem', textAlign: 'center', fontWeight: 600, color: 'white' }}>{formData.extraWhatsApps}</span>
                                        <button
                                            onClick={() => handleUpdateExtras("extraWhatsApps", 1)}
                                            disabled={actionLoading?.includes("extraWhatsApps")}
                                            className="icon-btn"
                                            style={{ padding: '0.25rem', background: 'rgba(16, 185, 129, 0.2)', color: '#10b981' }}
                                        >
                                            <Plus style={{ width: 14, height: 14 }} />
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Users + Agents + WhatsApp */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1.5rem' }}>
                {/* Users */}
                <div className="panel-card">
                    <div className="panel-header">
                        <div className="panel-title">
                            <div className="panel-title-icon purple">
                                <Users />
                            </div>
                            Usuários ({company.users.length})
                        </div>
                    </div>
                    <div className="panel-body">
                        <div style={{ display: 'grid', gap: '0.5rem' }}>
                            {company.users.map((user) => (
                                <div key={user.id} style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '0.75rem',
                                    padding: '0.75rem',
                                    background: 'rgba(15, 23, 42, 0.6)',
                                    borderRadius: '10px'
                                }}>
                                    <div className="company-avatar">{user.name.charAt(0)}</div>
                                    <div style={{ flex: 1 }}>
                                        <p style={{ fontWeight: 500, color: 'white', fontSize: '0.875rem' }}>{user.name}</p>
                                        <p style={{ fontSize: '0.75rem', color: '#64748b' }}>{user.email}</p>
                                    </div>
                                    <span style={{
                                        fontSize: '0.7rem',
                                        padding: '0.25rem 0.5rem',
                                        borderRadius: '6px',
                                        background: 'rgba(148, 163, 184, 0.15)',
                                        color: '#94a3b8'
                                    }}>
                                        {user.role}
                                    </span>
                                </div>
                            ))}
                            {company.users.length === 0 && (
                                <p style={{ textAlign: 'center', color: '#64748b', padding: '1rem' }}>Nenhum usuário</p>
                            )}
                        </div>
                    </div>
                </div>

                {/* Agents */}
                <div className="panel-card">
                    <div className="panel-header">
                        <div className="panel-title">
                            <div className="panel-title-icon green">
                                <Bot />
                            </div>
                            Agentes IA ({company.aiAgents.length})
                        </div>
                    </div>
                    <div className="panel-body">
                        <div style={{ display: 'grid', gap: '0.5rem' }}>
                            {company.aiAgents.map((agent) => (
                                <div key={agent.id} style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '0.75rem',
                                    padding: '0.75rem',
                                    background: 'rgba(15, 23, 42, 0.6)',
                                    borderRadius: '10px'
                                }}>
                                    <div style={{
                                        width: '36px',
                                        height: '36px',
                                        borderRadius: '10px',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        background: agent.isActive ? 'rgba(16, 185, 129, 0.2)' : 'rgba(148, 163, 184, 0.1)'
                                    }}>
                                        <Bot style={{ width: 18, height: 18, color: agent.isActive ? '#10b981' : '#64748b' }} />
                                    </div>
                                    <div style={{ flex: 1 }}>
                                        <p style={{ fontWeight: 500, color: 'white', fontSize: '0.875rem' }}>{agent.name}</p>
                                    </div>
                                    <span className={`status-badge ${agent.isActive ? 'active' : 'suspended'}`} style={{ fontSize: '0.7rem' }}>
                                        <span className="status-badge-dot" />
                                        {agent.isActive ? 'Ativo' : 'Inativo'}
                                    </span>
                                </div>
                            ))}
                            {company.aiAgents.length === 0 && (
                                <p style={{ textAlign: 'center', color: '#64748b', padding: '1rem' }}>Nenhum agente</p>
                            )}
                        </div>
                    </div>
                </div>

                {/* WhatsApp Sessions */}
                <div className="panel-card">
                    <div className="panel-header">
                        <div className="panel-title">
                            <div className="panel-title-icon cyan">
                                <Smartphone />
                            </div>
                            WhatsApp ({company.whatsAppSessions.length})
                        </div>
                    </div>
                    <div className="panel-body">
                        <div style={{ display: 'grid', gap: '0.5rem' }}>
                            {company.whatsAppSessions.map((session) => (
                                <div key={session.id} style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '0.75rem',
                                    padding: '0.75rem',
                                    background: 'rgba(15, 23, 42, 0.6)',
                                    borderRadius: '10px'
                                }}>
                                    <div style={{
                                        width: '36px',
                                        height: '36px',
                                        borderRadius: '10px',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        background: session.status === 'CONNECTED' ? 'rgba(16, 185, 129, 0.2)' : 'rgba(148, 163, 184, 0.1)'
                                    }}>
                                        {session.status === 'CONNECTED' ? (
                                            <Wifi style={{ width: 18, height: 18, color: '#10b981' }} />
                                        ) : (
                                            <WifiOff style={{ width: 18, height: 18, color: '#64748b' }} />
                                        )}
                                    </div>
                                    <div style={{ flex: 1 }}>
                                        <p style={{ fontWeight: 500, color: 'white', fontSize: '0.875rem' }}>{session.sessionName}</p>
                                        <p style={{ fontSize: '0.75rem', color: '#64748b' }}>{session.phoneNumber || 'Sem número'}</p>
                                    </div>
                                    <span className={`status-badge ${session.status === 'CONNECTED' ? 'active' : 'suspended'}`} style={{ fontSize: '0.7rem' }}>
                                        <span className="status-badge-dot" />
                                        {session.status === 'CONNECTED' ? 'Online' : 'Offline'}
                                    </span>
                                </div>
                            ))}
                            {company.whatsAppSessions.length === 0 && (
                                <p style={{ textAlign: 'center', color: '#64748b', padding: '1rem' }}>Nenhuma sessão</p>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* Token Usage */}
            <div className="panel-card">
                <div className="panel-header">
                    <div className="panel-title">
                        <div className="panel-title-icon purple">
                            <Gauge />
                        </div>
                        Uso de Tokens (IA)
                    </div>
                </div>
                <div className="panel-body">
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem' }}>
                        {/* Limit */}
                        <div>
                            <h4 style={{ fontSize: '0.875rem', fontWeight: 500, color: '#e2e8f0', marginBottom: '0.75rem' }}>Limite Mensal</h4>
                            <div style={{
                                padding: '1rem',
                                background: 'rgba(15, 23, 42, 0.6)',
                                borderRadius: '12px',
                                border: '1px solid rgba(148, 163, 184, 0.1)'
                            }}>
                                {(() => {
                                    // Calculate effective limit: custom limit or plan limit
                                    const customLimit = company.monthlyTokenLimit;
                                    const planLimit = company.subscription?.plan?.maxTokensMonth || 0;
                                    const effectiveLimit = customLimit > 0 ? customLimit : planLimit;

                                    return (
                                        <>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                                                <span style={{ color: '#94a3b8' }}>Limite:</span>
                                                <span style={{ color: 'white', fontWeight: 500 }}>
                                                    {effectiveLimit === 0 || effectiveLimit === -1
                                                        ? "Ilimitado"
                                                        : `${effectiveLimit.toLocaleString()} tokens/mês`}
                                                </span>
                                            </div>
                                            {customLimit > 0 && planLimit > 0 && (
                                                <div style={{ fontSize: '0.75rem', color: '#64748b', marginBottom: '0.5rem' }}>
                                                    Limite personalizado (plano: {planLimit.toLocaleString()})
                                                </div>
                                            )}
                                        </>
                                    );
                                })()}
                                {(() => {
                                    const customLimit = company.monthlyTokenLimit;
                                    const planLimit = company.subscription?.plan?.maxTokensMonth || 0;
                                    const effectiveLimit = customLimit > 0 ? customLimit : planLimit;

                                    if (effectiveLimit <= 0 || effectiveLimit === -1 || company.tokenUsage.length === 0) return null;

                                    const used = (company.tokenUsage[0]?.inputTokens || 0) + (company.tokenUsage[0]?.outputTokens || 0);
                                    const percent = Math.min(100, (used / effectiveLimit) * 100);
                                    const isWarning = percent >= 80;

                                    return (
                                        <>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
                                                <span style={{ color: '#94a3b8' }}>Usado este mês:</span>
                                                <span style={{ color: 'white' }}>
                                                    {used.toLocaleString()}
                                                </span>
                                            </div>
                                            <div>
                                                <div style={{
                                                    width: '100%',
                                                    height: '6px',
                                                    background: 'rgba(148, 163, 184, 0.2)',
                                                    borderRadius: '3px',
                                                    overflow: 'hidden'
                                                }}>
                                                    <div style={{
                                                        width: `${percent}%`,
                                                        height: '100%',
                                                        background: isWarning ? '#ef4444' : '#10b981',
                                                        borderRadius: '3px'
                                                    }} />
                                                </div>
                                                <p style={{
                                                    fontSize: '0.75rem',
                                                    marginTop: '0.5rem',
                                                    color: isWarning ? '#ef4444' : '#64748b',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    gap: '0.25rem'
                                                }}>
                                                    {percent.toFixed(1)}% utilizado
                                                    {isWarning && <AlertTriangle style={{ width: 12, height: 12 }} />}
                                                </p>
                                            </div>
                                        </>
                                    );
                                })()}
                            </div>
                        </div>

                        {/* History */}
                        <div>
                            <h4 style={{ fontSize: '0.875rem', fontWeight: 500, color: '#e2e8f0', marginBottom: '0.75rem' }}>Histórico (últimos 6 meses)</h4>
                            <div style={{ display: 'grid', gap: '0.5rem' }}>
                                {company.tokenUsage.length > 0 ? (
                                    company.tokenUsage.map((usage, i) => (
                                        <div key={i} style={{
                                            display: 'flex',
                                            justifyContent: 'space-between',
                                            padding: '0.5rem 0.75rem',
                                            background: 'rgba(15, 23, 42, 0.6)',
                                            borderRadius: '8px',
                                            fontSize: '0.875rem'
                                        }}>
                                            <span style={{ color: '#94a3b8' }}>
                                                {new Date(usage.month).toLocaleDateString("pt-BR", { month: "long", year: "numeric" })}
                                            </span>
                                            <span style={{ color: 'white' }}>
                                                {(usage.inputTokens + usage.outputTokens).toLocaleString()} tokens
                                            </span>
                                        </div>
                                    ))
                                ) : (
                                    <p style={{ textAlign: 'center', color: '#64748b', padding: '1rem' }}>Nenhum uso registrado</p>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Invoice History */}
            <div className="panel-card">
                <div className="panel-header">
                    <div className="panel-title">
                        <div className="panel-title-icon green">
                            <FileText />
                        </div>
                        Histórico de Faturas ({invoices.length})
                    </div>
                </div>
                <div className="panel-body">
                    {invoicesLoading ? (
                        <div style={{ display: 'flex', justifyContent: 'center', padding: '2rem' }}>
                            <Loader2 style={{ width: 24, height: 24, animation: 'spin 1s linear infinite', color: '#a855f7' }} />
                        </div>
                    ) : invoices.length > 0 ? (
                        <div className="table-container">
                            <table className="data-table">
                                <thead>
                                    <tr>
                                        <th>Descrição</th>
                                        <th>Valor</th>
                                        <th>Status</th>
                                        <th>Vencimento</th>
                                        <th>Pago em</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {invoices.map((invoice) => (
                                        <tr key={invoice.id}>
                                            <td>
                                                <span style={{ color: '#e2e8f0' }}>
                                                    {invoice.description || 'Fatura'}
                                                </span>
                                            </td>
                                            <td>
                                                <span style={{ color: '#10b981', fontWeight: 600 }}>
                                                    {formatCurrency(invoice.amount)}
                                                </span>
                                            </td>
                                            <td>
                                                <span className={`status-badge ${invoice.status === 'PAID' ? 'active' :
                                                    invoice.status === 'PENDING' ? 'pending' :
                                                        invoice.status === 'CANCELLED' ? 'suspended' : ''
                                                    }`}>
                                                    <span className="status-badge-dot" />
                                                    {invoice.status === 'PAID' ? 'Pago' :
                                                        invoice.status === 'PENDING' ? 'Pendente' :
                                                            invoice.status === 'CANCELLED' ? 'Cancelado' : invoice.status}
                                                </span>
                                            </td>
                                            <td>
                                                <span style={{ color: '#94a3b8' }}>
                                                    {invoice.dueDate ? formatDate(invoice.dueDate) : '-'}
                                                </span>
                                            </td>
                                            <td>
                                                {invoice.paidAt ? (
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                                        <CheckCircle style={{ width: 14, height: 14, color: '#10b981' }} />
                                                        <span style={{ color: '#10b981' }}>
                                                            {formatDate(invoice.paidAt)}
                                                        </span>
                                                    </div>
                                                ) : (
                                                    <span style={{ color: '#64748b' }}>-</span>
                                                )}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    ) : (
                        <p style={{ textAlign: 'center', color: '#64748b', padding: '2rem' }}>
                            Nenhuma fatura encontrada
                        </p>
                    )}
                </div>
            </div>
        </div>
    );
}
