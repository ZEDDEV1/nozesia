"use client";

import { useState, useEffect } from "react";
import {
    Key,
    Globe,
    Bell,
    Save,
    Loader2,
    Eye,
    EyeOff,
    Shield,
    Palette,
    Database,
    Mail,
    Slack,
    Sparkles,
    Brain,
    Zap,
    DollarSign,
    Check
} from "lucide-react";
import { cn } from "@/lib/utils";

// Available AI Models Configuration
const AI_MODELS = [
    {
        id: "gpt-4o-mini",
        name: "GPT-4o Mini",
        description: "Modelo compacto e eficiente. Ótimo custo-benefício para atendimento geral.",
        inputCost: 0.15,
        outputCost: 0.60,
        costUnit: "por 1M tokens",
        maxTokens: 128000,
        speed: "Muito Rápido",
        quality: "Alta",
        recommended: true,
        bestFor: ["Atendimento ao cliente", "Respostas rápidas", "Alto volume"],
    },
    {
        id: "gpt-4o",
        name: "GPT-4o",
        description: "Modelo avançado com raciocínio superior. Ideal para respostas complexas.",
        inputCost: 5.0,
        outputCost: 15.0,
        costUnit: "por 1M tokens",
        maxTokens: 128000,
        speed: "Rápido",
        quality: "Muito Alta",
        recommended: false,
        bestFor: ["Análises complexas", "Decisões sofisticadas", "Qualidade premium"],
    },
    {
        id: "gpt-4-turbo",
        name: "GPT-4 Turbo",
        description: "Suporta contexto longo de até 128K tokens. Bom para conversas extensas.",
        inputCost: 10.0,
        outputCost: 30.0,
        costUnit: "por 1M tokens",
        maxTokens: 128000,
        speed: "Médio",
        quality: "Muito Alta",
        recommended: false,
        bestFor: ["Contextos longos", "Documentos extensos", "Análises profundas"],
    },
    {
        id: "gpt-3.5-turbo",
        name: "GPT-3.5 Turbo",
        description: "Modelo básico e econômico. Bom para tarefas simples de baixo custo.",
        inputCost: 0.50,
        outputCost: 1.50,
        costUnit: "por 1M tokens",
        maxTokens: 16385,
        speed: "Muito Rápido",
        quality: "Boa",
        recommended: false,
        bestFor: ["Tarefas simples", "Custo mínimo", "Alto volume baixa complexidade"],
    },
];

interface Settings {
    openaiApiKey: string;
    openaiModel: string;
    webhookUrl: string;
    defaultTimezone: string;
    emailNotifications: boolean;
    slackNotifications: boolean;
    systemName: string;
    supportEmail: string;
}

export default function SettingsPage() {
    const [saving, setSaving] = useState(false);
    const [loading, setLoading] = useState(true);
    const [showApiKey, setShowApiKey] = useState(false);
    const [activeTab, setActiveTab] = useState("api");

    // Security state
    const [adminEmail, setAdminEmail] = useState("");
    const [currentPassword, setCurrentPassword] = useState("");
    const [newPassword, setNewPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [savingSecurity, setSavingSecurity] = useState(false);
    const [securityMessage, setSecurityMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
    const [settings, setSettings] = useState<Settings>({
        openaiApiKey: "sk-****************************",
        openaiModel: "gpt-4o-mini",
        webhookUrl: "http://localhost:3000/api/whatsapp/webhook",
        defaultTimezone: "America/Sao_Paulo",
        emailNotifications: true,
        slackNotifications: false,
        systemName: "NozesIA",
        supportEmail: "suporte@nozesia.com",
    });

    useEffect(() => {
        fetchSettings();
    }, []);

    const fetchSettings = async () => {
        try {
            const [settingsRes, securityRes] = await Promise.all([
                fetch("/api/admin/settings"),
                fetch("/api/admin/settings/security"),
            ]);
            const settingsData = await settingsRes.json();
            const securityData = await securityRes.json();

            if (settingsData.success && settingsData.data) {
                setSettings((prev) => ({ ...prev, ...settingsData.data }));
            }
            if (securityData.success && securityData.data) {
                setAdminEmail(securityData.data.email || "");
            }
        } catch (error) {
            console.error("Error fetching settings:", error);
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async () => {
        setSaving(true);
        try {
            await fetch("/api/admin/settings", {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(settings),
            });
        } catch (error) {
            console.error("Error saving settings:", error);
        }
        setSaving(false);
    };

    const selectedModel = AI_MODELS.find((m) => m.id === settings.openaiModel) || AI_MODELS[0];

    const tabs = [
        { id: "api", label: "API & Integrações", icon: Key },
        { id: "model", label: "Modelo IA", icon: Brain },
        { id: "general", label: "Geral", icon: Globe },
        { id: "notifications", label: "Notificações", icon: Bell },
        { id: "security", label: "Segurança", icon: Shield },
    ];

    if (loading) {
        return (
            <div className="loading-container">
                <div className="loading-content">
                    <div className="loading-icon">
                        <Sparkles className="w-7 h-7 text-white" />
                    </div>
                    <div className="loading-spinner" />
                    <p className="loading-text">Carregando configurações...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="dashboard-page">
            {/* Page Header */}
            <div className="page-header">
                <div className="page-title-section">
                    <div className="status-indicator">
                        <span className="status-dot" />
                        Sistema Configurado
                    </div>
                    <h1 className="page-title">
                        <span className="highlight">Configurações</span>
                    </h1>
                    <p className="page-subtitle">Gerencie as configurações do sistema</p>
                </div>
                <button onClick={handleSave} disabled={saving} className="refresh-btn">
                    {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                    Salvar Alterações
                </button>
            </div>

            {/* Tabs */}
            <div className="filter-pills">
                {tabs.map((tab) => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        className={cn("filter-pill", activeTab === tab.id && "active")}
                    >
                        <tab.icon className="w-4 h-4" />
                        {tab.label}
                    </button>
                ))}
            </div>

            {/* Content */}
            <div className="content-grid">
                {/* API Settings */}
                {activeTab === "api" && (
                    <>
                        <div className="panel-card">
                            <div className="panel-header">
                                <div className="panel-title">
                                    <div className="panel-title-icon purple">
                                        <Sparkles />
                                    </div>
                                    OpenAI API
                                </div>
                            </div>
                            <div className="panel-body" style={{ padding: '1.5rem' }}>
                                <div className="form-field">
                                    <label className="form-label">API Key</label>
                                    <div className="relative">
                                        <input
                                            type={showApiKey ? "text" : "password"}
                                            value={settings.openaiApiKey}
                                            onChange={(e) => setSettings({ ...settings, openaiApiKey: e.target.value })}
                                            className="form-input w-full pr-12"
                                            style={{ fontFamily: 'monospace' }}
                                        />
                                        <button
                                            type="button"
                                            onClick={() => setShowApiKey(!showApiKey)}
                                            className="absolute right-4 top-1/2 -translate-y-1/2 text-muted hover:text-primary transition-colors"
                                        >
                                            {showApiKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                        </button>
                                    </div>
                                    <p className="form-hint">Chave de API do OpenAI para geração de respostas com IA</p>
                                </div>

                                <div className="alert-banner" style={{ background: 'rgba(139, 92, 246, 0.05)', border: '1px solid rgba(139, 92, 246, 0.1)', marginTop: '1.25rem' }}>
                                    <div className="status-indicator">
                                        <span className="status-dot" />
                                        API Conectada
                                    </div>
                                    <p className="text-muted text-xs">Modelo: {selectedModel.name} • Última verificação: agora</p>
                                </div>
                            </div>
                        </div>

                        <div className="panel-card">
                            <div className="panel-header">
                                <div className="panel-title">
                                    <div className="panel-title-icon green">
                                        <Database />
                                    </div>
                                    Webhook WhatsApp
                                </div>
                            </div>
                            <div className="panel-body" style={{ padding: '1.5rem' }}>
                                <div className="form-field">
                                    <label className="form-label">URL do Webhook</label>
                                    <input
                                        type="text"
                                        value={settings.webhookUrl}
                                        onChange={(e) => setSettings({ ...settings, webhookUrl: e.target.value })}
                                        className="form-input w-full"
                                    />
                                    <p className="form-hint">URL para receber eventos do WPPConnect Server</p>
                                </div>
                            </div>
                        </div>
                    </>
                )}

                {/* Model Settings - NEW TAB */}
                {activeTab === "model" && (
                    <div style={{ gridColumn: 'span 2' }}>
                        {/* Current Model Info */}
                        <div className="panel-card" style={{ marginBottom: '1.5rem' }}>
                            <div className="panel-header">
                                <div className="panel-title">
                                    <div className="panel-title-icon purple">
                                        <Brain />
                                    </div>
                                    Modelo Atual
                                </div>
                            </div>
                            <div className="panel-body" style={{ padding: '1.5rem' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1rem' }}>
                                    <div style={{
                                        width: 56,
                                        height: 56,
                                        borderRadius: 12,
                                        background: 'linear-gradient(135deg, var(--primary), #06b6d4)',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center'
                                    }}>
                                        <Sparkles className="w-7 h-7 text-white" />
                                    </div>
                                    <div>
                                        <h3 style={{ fontSize: '1.25rem', fontWeight: 600, color: 'white', margin: 0 }}>
                                            {selectedModel.name}
                                            {selectedModel.recommended && (
                                                <span style={{
                                                    marginLeft: 8,
                                                    padding: '2px 8px',
                                                    background: 'rgba(16, 185, 129, 0.15)',
                                                    color: '#10b981',
                                                    fontSize: '0.7rem',
                                                    borderRadius: 4,
                                                    fontWeight: 600
                                                }}>RECOMENDADO</span>
                                            )}
                                        </h3>
                                        <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', margin: 0 }}>{selectedModel.description}</p>
                                    </div>
                                </div>

                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1rem' }}>
                                    <div style={{ background: 'rgba(255,255,255,0.02)', padding: '1rem', borderRadius: 8, textAlign: 'center' }}>
                                        <DollarSign style={{ width: 20, height: 20, color: 'var(--primary)', marginBottom: 4 }} />
                                        <div style={{ fontSize: '1.1rem', fontWeight: 600, color: 'white' }}>${selectedModel.inputCost}</div>
                                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Input/1M tokens</div>
                                    </div>
                                    <div style={{ background: 'rgba(255,255,255,0.02)', padding: '1rem', borderRadius: 8, textAlign: 'center' }}>
                                        <DollarSign style={{ width: 20, height: 20, color: 'var(--cyan)', marginBottom: 4 }} />
                                        <div style={{ fontSize: '1.1rem', fontWeight: 600, color: 'white' }}>${selectedModel.outputCost}</div>
                                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Output/1M tokens</div>
                                    </div>
                                    <div style={{ background: 'rgba(255,255,255,0.02)', padding: '1rem', borderRadius: 8, textAlign: 'center' }}>
                                        <Zap style={{ width: 20, height: 20, color: '#10b981', marginBottom: 4 }} />
                                        <div style={{ fontSize: '1.1rem', fontWeight: 600, color: 'white' }}>{selectedModel.speed}</div>
                                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Velocidade</div>
                                    </div>
                                    <div style={{ background: 'rgba(255,255,255,0.02)', padding: '1rem', borderRadius: 8, textAlign: 'center' }}>
                                        <Brain style={{ width: 20, height: 20, color: '#f59e0b', marginBottom: 4 }} />
                                        <div style={{ fontSize: '1.1rem', fontWeight: 600, color: 'white' }}>{selectedModel.quality}</div>
                                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Qualidade</div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Available Models */}
                        <div className="panel-card">
                            <div className="panel-header">
                                <div className="panel-title">
                                    <div className="panel-title-icon cyan">
                                        <Sparkles />
                                    </div>
                                    Modelos Disponíveis
                                </div>
                            </div>
                            <div className="panel-body" style={{ padding: '1.5rem' }}>
                                <div style={{ display: 'grid', gap: '1rem' }}>
                                    {AI_MODELS.map((model) => {
                                        const isSelected = settings.openaiModel === model.id;
                                        return (
                                            <div
                                                key={model.id}
                                                onClick={() => setSettings({ ...settings, openaiModel: model.id })}
                                                style={{
                                                    padding: '1.25rem',
                                                    background: isSelected ? 'rgba(139, 92, 246, 0.1)' : 'rgba(255,255,255,0.02)',
                                                    border: `1px solid ${isSelected ? 'rgba(139, 92, 246, 0.4)' : 'rgba(255,255,255,0.06)'}`,
                                                    borderRadius: 12,
                                                    cursor: 'pointer',
                                                    transition: 'all 0.2s ease',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    gap: '1rem',
                                                }}
                                            >
                                                <div style={{
                                                    width: 24,
                                                    height: 24,
                                                    borderRadius: '50%',
                                                    border: `2px solid ${isSelected ? 'var(--primary)' : 'rgba(255,255,255,0.2)'}`,
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'center',
                                                    background: isSelected ? 'var(--primary)' : 'transparent',
                                                    flexShrink: 0
                                                }}>
                                                    {isSelected && <Check style={{ width: 14, height: 14, color: 'white' }} />}
                                                </div>

                                                <div style={{ flex: 1 }}>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: 4 }}>
                                                        <span style={{ fontSize: '1rem', fontWeight: 600, color: 'white' }}>{model.name}</span>
                                                        {model.recommended && (
                                                            <span style={{
                                                                padding: '2px 6px',
                                                                background: 'rgba(16, 185, 129, 0.15)',
                                                                color: '#10b981',
                                                                fontSize: '0.65rem',
                                                                borderRadius: 4,
                                                                fontWeight: 600
                                                            }}>RECOMENDADO</span>
                                                        )}
                                                    </div>
                                                    <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', margin: 0 }}>{model.description}</p>
                                                    <div style={{ display: 'flex', gap: '1rem', marginTop: '0.5rem', flexWrap: 'wrap' }}>
                                                        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                                                            💰 Input: <strong style={{ color: 'var(--primary)' }}>${model.inputCost}</strong>/1M
                                                        </span>
                                                        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                                                            💬 Output: <strong style={{ color: 'var(--cyan)' }}>${model.outputCost}</strong>/1M
                                                        </span>
                                                        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                                                            ⚡ {model.speed}
                                                        </span>
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>

                                <div className="alert-banner" style={{ background: 'rgba(245, 158, 11, 0.05)', border: '1px solid rgba(245, 158, 11, 0.1)', marginTop: '1.5rem' }}>
                                    <p className="text-muted text-sm">
                                        ⚠️ <strong>Importante:</strong> Modelos mais caros oferecem respostas de maior qualidade, mas aumentam o custo por conversa.
                                        O GPT-4o-mini é recomendado para a maioria dos casos de atendimento ao cliente.
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* General Settings */}
                {activeTab === "general" && (
                    <>
                        <div className="panel-card">
                            <div className="panel-header">
                                <div className="panel-title">
                                    <div className="panel-title-icon purple">
                                        <Palette />
                                    </div>
                                    Identidade do Sistema
                                </div>
                            </div>
                            <div className="panel-body" style={{ padding: '1.5rem' }}>
                                <div className="form-field">
                                    <label className="form-label">Nome do Sistema</label>
                                    <input
                                        type="text"
                                        value={settings.systemName}
                                        onChange={(e) => setSettings({ ...settings, systemName: e.target.value })}
                                        className="form-input w-full"
                                    />
                                </div>
                                <div className="form-field" style={{ marginTop: '1.25rem' }}>
                                    <label className="form-label">Email de Suporte</label>
                                    <input
                                        type="email"
                                        value={settings.supportEmail}
                                        onChange={(e) => setSettings({ ...settings, supportEmail: e.target.value })}
                                        className="form-input w-full"
                                    />
                                </div>
                            </div>
                        </div>

                        <div className="panel-card">
                            <div className="panel-header">
                                <div className="panel-title">
                                    <div className="panel-title-icon green">
                                        <Globe />
                                    </div>
                                    Localização
                                </div>
                            </div>
                            <div className="panel-body" style={{ padding: '1.5rem' }}>
                                <div className="form-field">
                                    <label className="form-label">Fuso Horário Padrão</label>
                                    <select
                                        value={settings.defaultTimezone}
                                        onChange={(e) => setSettings({ ...settings, defaultTimezone: e.target.value })}
                                        className="form-input w-full"
                                    >
                                        <option value="America/Sao_Paulo">São Paulo (GMT-3)</option>
                                        <option value="America/New_York">New York (GMT-5)</option>
                                        <option value="Europe/London">London (GMT+0)</option>
                                        <option value="Europe/Paris">Paris (GMT+1)</option>
                                    </select>
                                </div>
                            </div>
                        </div>
                    </>
                )}

                {/* Notification Settings */}
                {activeTab === "notifications" && (
                    <div className="panel-card" style={{ gridColumn: 'span 2' }}>
                        <div className="panel-header">
                            <div className="panel-title">
                                <div className="panel-title-icon purple">
                                    <Bell />
                                </div>
                                Canais de Notificação
                            </div>
                        </div>
                        <div className="panel-body" style={{ padding: '1.5rem' }}>
                            <div className="stats-grid">
                                {/* Email */}
                                <div className="stat-card" style={{ justifyContent: 'space-between' }}>
                                    <div className="stat-card-content">
                                        <div className="stat-icon" style={{ background: 'rgba(139, 92, 246, 0.15)' }}>
                                            <Mail style={{ color: 'var(--primary)' }} />
                                        </div>
                                        <div className="stat-info">
                                            <span className="stat-value" style={{ fontSize: '1rem' }}>Email</span>
                                            <span className="stat-label">Receber alertas por email</span>
                                        </div>
                                    </div>
                                    <label className="relative inline-flex items-center cursor-pointer">
                                        <input
                                            type="checkbox"
                                            checked={settings.emailNotifications}
                                            onChange={(e) => setSettings({ ...settings, emailNotifications: e.target.checked })}
                                            className="sr-only peer"
                                        />
                                        <div className="w-12 h-6 bg-[rgba(255,255,255,0.1)] peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-[rgba(139,92,246,0.3)] rounded-full peer peer-checked:after:translate-x-6 peer-checked:bg-gradient-to-r peer-checked:from-[#8b5cf6] peer-checked:to-[#a855f7] after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all after:shadow-md"></div>
                                    </label>
                                </div>

                                {/* Slack */}
                                <div className="stat-card" style={{ justifyContent: 'space-between' }}>
                                    <div className="stat-card-content">
                                        <div className="stat-icon" style={{ background: 'rgba(6, 182, 212, 0.15)' }}>
                                            <Slack style={{ color: 'var(--cyan)' }} />
                                        </div>
                                        <div className="stat-info">
                                            <span className="stat-value" style={{ fontSize: '1rem' }}>Slack</span>
                                            <span className="stat-label">Receber alertas no Slack</span>
                                        </div>
                                    </div>
                                    <label className="relative inline-flex items-center cursor-pointer">
                                        <input
                                            type="checkbox"
                                            checked={settings.slackNotifications}
                                            onChange={(e) => setSettings({ ...settings, slackNotifications: e.target.checked })}
                                            className="sr-only peer"
                                        />
                                        <div className="w-12 h-6 bg-[rgba(255,255,255,0.1)] peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-[rgba(139,92,246,0.3)] rounded-full peer peer-checked:after:translate-x-6 peer-checked:bg-gradient-to-r peer-checked:from-[#8b5cf6] peer-checked:to-[#a855f7] after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all after:shadow-md"></div>
                                    </label>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* Security Settings */}
                {activeTab === "security" && (
                    <div className="panel-card" style={{ gridColumn: 'span 2' }}>
                        <div className="panel-header">
                            <div className="panel-title">
                                <div className="panel-title-icon purple">
                                    <Shield />
                                </div>
                                Segurança do Admin
                            </div>
                        </div>
                        <div className="panel-body" style={{ padding: '1.5rem' }}>
                            {securityMessage && (
                                <div className="alert-banner" style={{
                                    background: securityMessage.type === "success" ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                                    border: `1px solid ${securityMessage.type === "success" ? 'rgba(16, 185, 129, 0.3)' : 'rgba(239, 68, 68, 0.3)'}`,
                                    marginBottom: '1.5rem'
                                }}>
                                    <p style={{ color: securityMessage.type === "success" ? '#10b981' : '#f87171', margin: 0 }}>
                                        {securityMessage.type === "success" ? '✅' : '❌'} {securityMessage.text}
                                    </p>
                                </div>
                            )}

                            <div style={{ display: 'grid', gap: '1.5rem' }}>
                                {/* Email Section */}
                                <div style={{ padding: '1.5rem', background: 'rgba(255,255,255,0.02)', borderRadius: 12, border: '1px solid rgba(255,255,255,0.06)' }}>
                                    <h4 style={{ color: 'white', margin: '0 0 1rem', fontSize: '1rem', fontWeight: 600 }}>📧 Alterar Email</h4>
                                    <div className="form-field">
                                        <label className="form-label">Email do Admin</label>
                                        <input
                                            type="email"
                                            value={adminEmail}
                                            onChange={(e) => setAdminEmail(e.target.value)}
                                            className="form-input w-full"
                                            placeholder="admin@exemplo.com"
                                        />
                                    </div>
                                </div>

                                {/* Password Section */}
                                <div style={{ padding: '1.5rem', background: 'rgba(255,255,255,0.02)', borderRadius: 12, border: '1px solid rgba(255,255,255,0.06)' }}>
                                    <h4 style={{ color: 'white', margin: '0 0 1rem', fontSize: '1rem', fontWeight: 600 }}>🔐 Alterar Senha</h4>
                                    <div className="form-field">
                                        <label className="form-label">Senha Atual</label>
                                        <input
                                            type="password"
                                            value={currentPassword}
                                            onChange={(e) => setCurrentPassword(e.target.value)}
                                            className="form-input w-full"
                                            placeholder="••••••••"
                                        />
                                    </div>
                                    <div className="form-row" style={{ marginTop: '1rem' }}>
                                        <div className="form-field">
                                            <label className="form-label">Nova Senha</label>
                                            <input
                                                type="password"
                                                value={newPassword}
                                                onChange={(e) => setNewPassword(e.target.value)}
                                                className="form-input w-full"
                                                placeholder="••••••••"
                                            />
                                        </div>
                                        <div className="form-field">
                                            <label className="form-label">Confirmar Nova Senha</label>
                                            <input
                                                type="password"
                                                value={confirmPassword}
                                                onChange={(e) => setConfirmPassword(e.target.value)}
                                                className="form-input w-full"
                                                placeholder="••••••••"
                                            />
                                        </div>
                                    </div>
                                    <p className="form-hint" style={{ marginTop: '0.5rem' }}>
                                        A senha deve ter pelo menos 6 caracteres
                                    </p>
                                </div>

                                {/* Save Button */}
                                <button
                                    onClick={async () => {
                                        setSecurityMessage(null);

                                        // Validation
                                        if (newPassword && newPassword !== confirmPassword) {
                                            setSecurityMessage({ type: "error", text: "As senhas não coincidem" });
                                            return;
                                        }

                                        if (newPassword && !currentPassword) {
                                            setSecurityMessage({ type: "error", text: "Informe a senha atual" });
                                            return;
                                        }

                                        setSavingSecurity(true);
                                        try {
                                            const res = await fetch("/api/admin/settings/security", {
                                                method: "PATCH",
                                                headers: { "Content-Type": "application/json" },
                                                body: JSON.stringify({
                                                    newEmail: adminEmail,
                                                    currentPassword,
                                                    newPassword: newPassword || undefined,
                                                }),
                                            });
                                            const data = await res.json();

                                            if (data.success) {
                                                setSecurityMessage({ type: "success", text: "Credenciais atualizadas com sucesso!" });
                                                setCurrentPassword("");
                                                setNewPassword("");
                                                setConfirmPassword("");
                                            } else {
                                                setSecurityMessage({ type: "error", text: data.error || "Erro ao atualizar" });
                                            }
                                        } catch (error) {
                                            setSecurityMessage({ type: "error", text: "Erro de conexão" });
                                        } finally {
                                            setSavingSecurity(false);
                                        }
                                    }}
                                    disabled={savingSecurity}
                                    className="btn-primary"
                                    style={{ width: '100%', padding: '0.875rem', justifyContent: 'center' }}
                                >
                                    {savingSecurity ? (
                                        <><Loader2 className="w-4 h-4 animate-spin" /> Salvando...</>
                                    ) : (
                                        <><Save className="w-4 h-4" /> Salvar Alterações de Segurança</>
                                    )}
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
