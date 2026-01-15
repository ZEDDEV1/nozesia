"use client";

import { useState, useEffect } from "react";
import {
    CreditCard,
    Plus,
    Edit2,
    Trash2,
    Users,
    Check,
    X,
    Smartphone,
    Bot,
    Zap,
    Save,
    Sparkles,
    Crown,
    Star,
    RefreshCw,
    TrendingUp,
    Gift
} from "lucide-react";
import { formatCurrency } from "@/lib/utils";

interface Plan {
    id: string;
    name: string;
    type: string;
    price: number;
    features: string[] | string;
    maxAgents: number;
    maxWhatsAppNumbers: number;
    maxTokensPerMonth: number;
    maxMessagesPerMonth?: number;
    isActive: boolean;
    totalSubscriptions: number;
    activeSubscriptions: number;
    monthlyRevenue: number;
    createdAt: string;
    allowAudio?: boolean;
    allowVoice?: boolean;
    allowHumanTransfer?: boolean;
    allowApiAccess?: boolean;
    allowWhiteLabel?: boolean;
}

interface FormData {
    name: string;
    type: string;
    price: number;
    features: string[];
    maxAgents: number;
    maxWhatsAppNumbers: number;
    maxTokensPerMonth: number;
    maxMessagesPerMonth: number;
}

const defaultForm: FormData = {
    name: "",
    type: "BASIC",
    price: 0,
    features: [""],
    maxAgents: 1,
    maxWhatsAppNumbers: 1,
    maxTokensPerMonth: 10000,
    maxMessagesPerMonth: 1000,
};

export default function PlansPage() {
    const [plans, setPlans] = useState<Plan[]>([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [editingPlan, setEditingPlan] = useState<Plan | null>(null);
    const [formData, setFormData] = useState<FormData>(defaultForm);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        fetchPlans();
    }, []);

    const fetchPlans = async () => {
        try {
            setLoading(true);
            const response = await fetch("/api/admin/plans");
            const data = await response.json();
            if (data.success) {
                setPlans(data.data);
            }
        } catch (error) {
            console.error("Error fetching plans:", error);
        } finally {
            setLoading(false);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true);

        try {
            const url = editingPlan ? `/api/admin/plans/${editingPlan.id}` : "/api/admin/plans";
            const method = editingPlan ? "PUT" : "POST";

            const response = await fetch(url, {
                method,
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    ...formData,
                    features: formData.features.filter((f) => f.trim() !== ""),
                }),
            });

            const data = await response.json();
            if (data.success) {
                fetchPlans();
                closeModal();
            }
        } catch (error) {
            console.error("Error saving plan:", error);
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm("Tem certeza que deseja excluir este plano?")) return;

        try {
            const response = await fetch(`/api/admin/plans/${id}`, {
                method: "DELETE",
            });
            const data = await response.json();
            if (data.success) {
                fetchPlans();
            } else {
                alert(data.error);
            }
        } catch (error) {
            console.error("Error deleting plan:", error);
        }
    };

    const openEditModal = (plan: Plan) => {
        setEditingPlan(plan);
        const features = Array.isArray(plan.features) ? plan.features : [];
        setFormData({
            name: plan.name,
            type: plan.type,
            price: plan.price,
            features: features.length > 0 ? features : [""],
            maxAgents: plan.maxAgents,
            maxWhatsAppNumbers: plan.maxWhatsAppNumbers,
            maxTokensPerMonth: plan.maxTokensPerMonth,
            maxMessagesPerMonth: plan.maxMessagesPerMonth || 1000,
        });
        setShowModal(true);
    };

    const openNewModal = () => {
        setEditingPlan(null);
        setFormData(defaultForm);
        setShowModal(true);
    };

    const closeModal = () => {
        setShowModal(false);
        setEditingPlan(null);
        setFormData(defaultForm);
    };

    const addFeature = () => {
        setFormData({ ...formData, features: [...formData.features, ""] });
    };

    const removeFeature = (index: number) => {
        const newFeatures = formData.features.filter((_, i) => i !== index);
        setFormData({ ...formData, features: newFeatures.length ? newFeatures : [""] });
    };

    const updateFeature = (index: number, value: string) => {
        const newFeatures = [...formData.features];
        newFeatures[index] = value;
        setFormData({ ...formData, features: newFeatures });
    };

    const getPlanIcon = (type: string) => {
        switch (type?.toUpperCase()) {
            case "TRIAL": return Gift;
            case "BASIC": return Star;
            case "PRO": return Crown;
            case "ENTERPRISE": return Sparkles;
            default: return Star;
        }
    };

    const getPlanClass = (type: string) => {
        switch (type?.toUpperCase()) {
            case "TRIAL": return "trial";
            case "BASIC": return "basic";
            case "PRO": return "pro";
            case "ENTERPRISE": return "enterprise";
            default: return "basic";
        }
    };

    // Calculate stats
    const stats = {
        total: plans.length,
        active: plans.filter(p => p.isActive).length,
        totalSubscribers: plans.reduce((sum, p) => sum + p.activeSubscriptions, 0),
        monthlyRevenue: plans.reduce((sum, p) => sum + p.monthlyRevenue, 0),
    };

    if (loading) {
        return (
            <div className="loading-container">
                <div className="loading-content">
                    <div className="loading-icon">
                        <Sparkles className="w-7 h-7 text-white" />
                    </div>
                    <div className="loading-spinner" />
                    <p className="loading-text">Carregando planos...</p>
                </div>
            </div>
        );
    }

    const kpiCards = [
        {
            title: "Total de Planos",
            value: stats.total,
            icon: CreditCard,
            color: "purple"
        },
        {
            title: "Planos Ativos",
            value: stats.active,
            icon: Check,
            color: "green"
        },
        {
            title: "Assinantes",
            value: stats.totalSubscribers,
            icon: Users,
            color: "cyan"
        },
        {
            title: "Receita Mensal",
            value: formatCurrency(stats.monthlyRevenue),
            icon: TrendingUp,
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
                        Gerenciamento de <span className="highlight">Planos</span>
                    </h1>
                    <p className="page-subtitle">Configure os planos de assinatura do seu SaaS</p>
                </div>
                <div className="flex gap-3">
                    <button onClick={fetchPlans} className="refresh-btn">
                        <RefreshCw className="w-4 h-4" />
                        Atualizar
                    </button>
                    <button onClick={openNewModal} className="btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <Plus className="w-4 h-4" />
                        Novo Plano
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

            {/* Plans Grid */}
            <div className="panel-card">
                <div className="panel-header">
                    <div className="panel-title">
                        <div className="panel-title-icon purple">
                            <CreditCard />
                        </div>
                        Planos Disponíveis ({plans.length})
                    </div>
                </div>
                <div className="panel-body">
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '1.5rem' }}>
                        {plans.map((plan) => {
                            const Icon = getPlanIcon(plan.type);
                            const features = Array.isArray(plan.features) ? plan.features : [];

                            return (
                                <div key={plan.id} className="plan-card" style={{
                                    background: 'rgba(255,255,255,0.02)',
                                    border: '1px solid rgba(255,255,255,0.08)',
                                    borderRadius: '16px',
                                    padding: '1.5rem',
                                    position: 'relative',
                                    transition: 'all 0.3s ease'
                                }}>
                                    {/* Plan Badge */}
                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
                                        <span className={`plan-badge ${getPlanClass(plan.type)}`}>
                                            <Icon style={{ width: 14, height: 14 }} />
                                            {plan.type}
                                        </span>
                                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                                            <button
                                                onClick={() => openEditModal(plan)}
                                                className="icon-btn"
                                                title="Editar"
                                            >
                                                <Edit2 style={{ width: 16, height: 16 }} />
                                            </button>
                                            <button
                                                onClick={() => handleDelete(plan.id)}
                                                className="icon-btn danger"
                                                title="Excluir"
                                            >
                                                <Trash2 style={{ width: 16, height: 16 }} />
                                            </button>
                                        </div>
                                    </div>

                                    {/* Plan Name & Price */}
                                    <h3 style={{ fontSize: '1.25rem', fontWeight: 600, color: 'white', marginBottom: '0.25rem' }}>
                                        {plan.name}
                                    </h3>
                                    <div style={{ display: 'flex', alignItems: 'baseline', marginBottom: '1rem' }}>
                                        <span style={{ fontSize: '2rem', fontWeight: 700, color: 'white' }}>
                                            {formatCurrency(plan.price)}
                                        </span>
                                        <span style={{ fontSize: '0.9rem', color: 'var(--text-muted)', marginLeft: '0.25rem' }}>/mês</span>
                                    </div>

                                    {/* Limits Grid */}
                                    <div style={{
                                        display: 'grid',
                                        gridTemplateColumns: 'repeat(3, 1fr)',
                                        gap: '0.75rem',
                                        padding: '1rem 0',
                                        borderTop: '1px solid rgba(255,255,255,0.08)',
                                        borderBottom: '1px solid rgba(255,255,255,0.08)',
                                        marginBottom: '1rem'
                                    }}>
                                        <div style={{ textAlign: 'center' }}>
                                            <Bot style={{ width: 18, height: 18, color: 'var(--primary)', marginBottom: '0.25rem' }} />
                                            <div style={{ fontSize: '1.25rem', fontWeight: 600, color: 'white' }}>{plan.maxAgents}</div>
                                            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Agentes</div>
                                        </div>
                                        <div style={{ textAlign: 'center' }}>
                                            <Smartphone style={{ width: 18, height: 18, color: 'var(--cyan)', marginBottom: '0.25rem' }} />
                                            <div style={{ fontSize: '1.25rem', fontWeight: 600, color: 'white' }}>{plan.maxWhatsAppNumbers}</div>
                                            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>WhatsApp</div>
                                        </div>
                                        <div style={{ textAlign: 'center' }}>
                                            <Zap style={{ width: 18, height: 18, color: 'var(--green)', marginBottom: '0.25rem' }} />
                                            <div style={{ fontSize: '1.25rem', fontWeight: 600, color: 'white' }}>{(plan.maxTokensPerMonth / 1000).toFixed(0)}K</div>
                                            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Tokens</div>
                                        </div>
                                    </div>

                                    {/* Features */}
                                    {features.length > 0 && (
                                        <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 1rem' }}>
                                            {features.slice(0, 4).map((feature, i) => (
                                                <li key={i} style={{
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    gap: '0.5rem',
                                                    fontSize: '0.85rem',
                                                    color: 'var(--text-muted)',
                                                    marginBottom: '0.5rem'
                                                }}>
                                                    <Check style={{ width: 14, height: 14, color: 'var(--green)' }} />
                                                    {feature}
                                                </li>
                                            ))}
                                        </ul>
                                    )}

                                    {/* Stats */}
                                    <div style={{
                                        display: 'flex',
                                        justifyContent: 'space-between',
                                        paddingTop: '1rem',
                                        borderTop: '1px solid rgba(255,255,255,0.08)'
                                    }}>
                                        <div>
                                            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Assinantes</div>
                                            <div style={{ fontSize: '1rem', fontWeight: 600, color: 'white' }}>{plan.activeSubscriptions}</div>
                                        </div>
                                        <div style={{ textAlign: 'right' }}>
                                            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Receita</div>
                                            <div style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--green)' }}>{formatCurrency(plan.monthlyRevenue)}</div>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>

            {/* Empty State */}
            {plans.length === 0 && (
                <div className="empty-state">
                    <div className="empty-state-icon">
                        <CreditCard />
                    </div>
                    <h3 className="empty-state-title">Nenhum plano cadastrado</h3>
                    <p className="empty-state-text">Crie seu primeiro plano para começar a vender.</p>
                    <button onClick={openNewModal} className="refresh-btn" style={{ marginTop: '1rem' }}>
                        <Plus className="w-4 h-4" />
                        Criar Plano
                    </button>
                </div>
            )}

            {/* Modal */}
            {showModal && (
                <div className="modal-overlay">
                    <div className="modal-content" style={{ maxWidth: '600px' }}>
                        <div className="modal-header">
                            <h2 className="modal-title">
                                {editingPlan ? (
                                    <><Edit2 style={{ width: 20, height: 20 }} /> Editar Plano</>
                                ) : (
                                    <><Plus style={{ width: 20, height: 20 }} /> Novo Plano</>
                                )}
                            </h2>
                            <button onClick={closeModal} className="modal-close">
                                <X />
                            </button>
                        </div>
                        <form onSubmit={handleSubmit}>
                            <div className="modal-body">
                                {/* Name & Type */}
                                <div className="form-row">
                                    <div className="form-group">
                                        <label className="form-label">Nome do Plano</label>
                                        <input
                                            type="text"
                                            className="form-input"
                                            value={formData.name}
                                            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                            placeholder="Ex: Plano Pro"
                                            required
                                        />
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label">Tipo</label>
                                        <select
                                            className="form-input"
                                            value={formData.type}
                                            onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                                        >
                                            <option value="TRIAL">TRIAL (Free)</option>
                                            <option value="BASIC">BASIC</option>
                                            <option value="PRO">PRO</option>
                                            <option value="ENTERPRISE">ENTERPRISE</option>
                                        </select>
                                    </div>
                                </div>

                                {/* Price */}
                                <div className="form-row">
                                    <div className="form-group">
                                        <label className="form-label">Preço (R$)</label>
                                        <input
                                            type="number"
                                            step="0.01"
                                            className="form-input"
                                            value={formData.price}
                                            onChange={(e) => setFormData({ ...formData, price: parseFloat(e.target.value) || 0 })}
                                            placeholder="197.00"
                                            required
                                        />
                                    </div>
                                </div>

                                {/* Limits */}
                                <div className="form-row" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
                                    <div className="form-group">
                                        <label className="form-label">Agentes</label>
                                        <input
                                            type="number"
                                            className="form-input"
                                            value={formData.maxAgents}
                                            onChange={(e) => setFormData({ ...formData, maxAgents: parseInt(e.target.value) || 1 })}
                                        />
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label">WhatsApp</label>
                                        <input
                                            type="number"
                                            className="form-input"
                                            value={formData.maxWhatsAppNumbers}
                                            onChange={(e) => setFormData({ ...formData, maxWhatsAppNumbers: parseInt(e.target.value) || 1 })}
                                        />
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label">Tokens/mês</label>
                                        <input
                                            type="number"
                                            className="form-input"
                                            value={formData.maxTokensPerMonth}
                                            onChange={(e) => setFormData({ ...formData, maxTokensPerMonth: parseInt(e.target.value) || 10000 })}
                                        />
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label">Mensagens/mês</label>
                                        <input
                                            type="number"
                                            className="form-input"
                                            value={formData.maxMessagesPerMonth}
                                            onChange={(e) => setFormData({ ...formData, maxMessagesPerMonth: parseInt(e.target.value) || 1000 })}
                                        />
                                    </div>
                                </div>

                                {/* Features */}
                                <div className="form-group">
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                                        <label className="form-label" style={{ margin: 0 }}>Funcionalidades</label>
                                        <button
                                            type="button"
                                            onClick={addFeature}
                                            style={{
                                                background: 'none',
                                                border: 'none',
                                                color: 'var(--primary)',
                                                cursor: 'pointer',
                                                fontSize: '0.85rem',
                                                fontWeight: 500
                                            }}
                                        >
                                            + Adicionar
                                        </button>
                                    </div>
                                    {formData.features.map((feature, index) => (
                                        <div key={index} style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem' }}>
                                            <input
                                                type="text"
                                                className="form-input"
                                                value={feature}
                                                onChange={(e) => updateFeature(index, e.target.value)}
                                                placeholder="Ex: Suporte prioritário"
                                            />
                                            <button
                                                type="button"
                                                onClick={() => removeFeature(index)}
                                                className="icon-btn danger"
                                            >
                                                <X style={{ width: 16, height: 16 }} />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            </div>
                            <div className="modal-footer">
                                <button type="button" onClick={closeModal} className="btn-secondary">
                                    Cancelar
                                </button>
                                <button type="submit" className="btn-primary" disabled={saving}>
                                    {saving ? (
                                        <><RefreshCw style={{ width: 16, height: 16, animation: 'spin 1s linear infinite' }} /> Salvando...</>
                                    ) : (
                                        <><Save style={{ width: 16, height: 16 }} /> {editingPlan ? "Salvar" : "Criar Plano"}</>
                                    )}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
