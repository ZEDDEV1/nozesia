"use client";

import { useState, useEffect, useCallback } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import {
    Settings,
    Building2,
    User,
    Mail,
    Bell,
    Shield,
    Save,
    RefreshCw,
    Check,
    Globe,
    CreditCard,
    Smartphone,
    X,
    Loader2,
    LayoutGrid,
} from "lucide-react";
import { useModules } from "@/contexts/modules-context";

interface UserData {
    id: string;
    name: string;
    email: string;
    role: string;
    company?: {
        id: string;
        name: string;
        email: string;
        phone: string | null;
        document: string | null;
        timezone: string;
        settings: string;
    };
}

interface NotificationSettings {
    emailNewConversation: boolean;
    emailDailyReport: boolean;
    emailWeeklyReport: boolean;
    browserNotifications: boolean;
}

interface TwoFactorSetup {
    secret: string;
    qrCode: string;
}

export default function SettingsPage() {
    const searchParams = useSearchParams();
    const router = useRouter();

    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [success, setSuccess] = useState("");
    const [error, setError] = useState("");

    // Get initial tab from URL or default to "profile"
    const validTabs = ["profile", "company", "pix", "notifications", "security", "modules"] as const;
    type TabType = typeof validTabs[number];
    const urlTab = searchParams.get("tab") as TabType | null;
    const initialTab: TabType = urlTab && validTabs.includes(urlTab) ? urlTab : "profile";
    const [activeTab, setActiveTab] = useState<TabType>(initialTab);

    // Update URL when tab changes
    const handleTabChange = useCallback((tab: TabType) => {
        setActiveTab(tab);
        const newParams = new URLSearchParams(searchParams.toString());
        newParams.set("tab", tab);
        router.replace(`?${newParams.toString()}`, { scroll: false });
    }, [searchParams, router]);

    // User data - used by setUser in useEffect
    const [, setUser] = useState<UserData | null>(null);

    // Profile form
    const [profileForm, setProfileForm] = useState({
        name: "",
        email: "",
    });

    // Company form
    const [companyForm, setCompanyForm] = useState({
        name: "",
        email: "",
        phone: "",
        document: "",
        niche: "",
        description: "",
        timezone: "America/Sao_Paulo",
    });

    // Notification settings
    const [notificationSettings, setNotificationSettings] = useState<NotificationSettings>({
        emailNewConversation: true,
        emailDailyReport: false,
        emailWeeklyReport: true,
        browserNotifications: true,
    });

    // Password form
    const [passwordForm, setPasswordForm] = useState({
        currentPassword: "",
        newPassword: "",
        confirmPassword: "",
    });

    // PIX form
    const [pixForm, setPixForm] = useState({
        pixKeyType: "",
        pixKey: "",
    });

    // 2FA State
    const [twoFactorEnabled, setTwoFactorEnabled] = useState(false);
    const [twoFactorSetup, setTwoFactorSetup] = useState<TwoFactorSetup | null>(null);
    const [showTwoFactorModal, setShowTwoFactorModal] = useState(false);
    const [twoFactorCode, setTwoFactorCode] = useState("");
    const [twoFactorLoading, setTwoFactorLoading] = useState(false);

    // Modules State - use shared context for real-time updates
    const { enabledModules, setEnabledModules } = useModules();

    // Available Modules for sidebar
    const AVAILABLE_MODULES = [
        { id: "analytics", label: "Analytics", description: "Relatórios e métricas do negócio", defaultEnabled: true },
        { id: "interests", label: "Interesses", description: "Leads e interesses de clientes", defaultEnabled: true },
        { id: "products", label: "Produtos", description: "Catálogo de produtos", defaultEnabled: true },
        { id: "orders", label: "Pedidos", description: "Gestão de pedidos e vendas", defaultEnabled: true },
        { id: "campaigns", label: "Campanhas", description: "Campanhas de mensagens em massa", defaultEnabled: false },
        { id: "templates", label: "Templates", description: "Templates de mensagens", defaultEnabled: false },
        { id: "delivery-zones", label: "Taxas de Entrega", description: "Zonas e taxas de entrega", defaultEnabled: false },
        { id: "crm", label: "CRM", description: "Gestão de relacionamento", defaultEnabled: true },
        { id: "calendar", label: "Calendário", description: "Agendamentos e calendário", defaultEnabled: false },
        { id: "creatives", label: "Criativos", description: "Geração de imagens com IA", defaultEnabled: false },
        { id: "contacts", label: "Contatos WA", description: "Lista de contatos do WhatsApp", defaultEnabled: true },
        { id: "webhooks", label: "Webhooks", description: "Integrações via webhook", defaultEnabled: false },
    ];

    useEffect(() => {
        fetchUser();
        fetchTwoFactorStatus();
    }, []);

    const fetchUser = async () => {
        try {
            const response = await fetch("/api/users/profile");
            const data = await response.json();

            if (data.success) {
                setUser(data.data);
                setProfileForm({
                    name: data.data.name || "",
                    email: data.data.email || "",
                });
                if (data.data.company) {
                    setCompanyForm({
                        name: data.data.company.name || "",
                        email: data.data.company.email || "",
                        phone: data.data.company.phone || "",
                        document: data.data.company.document || "",
                        niche: data.data.company.niche || "",
                        description: data.data.company.description || "",
                        timezone: data.data.company.timezone || "America/Sao_Paulo",
                    });
                    // Load PIX data
                    setPixForm({
                        pixKeyType: data.data.company.pixKeyType || "",
                        pixKey: data.data.company.pixKey || "",
                    });
                    // Load enabled modules ONLY if context is empty (not yet loaded by layout)
                    // This prevents overwriting valid modules during navigation
                    if (enabledModules.length === 0) {
                        try {
                            const modules = JSON.parse(data.data.company.enabledModules || "[]");
                            if (Array.isArray(modules) && modules.length > 0) {
                                setEnabledModules(modules);
                            } else {
                                // Set defaults if empty
                                const defaults = AVAILABLE_MODULES.filter(m => m.defaultEnabled).map(m => m.id);
                                setEnabledModules(defaults);
                            }
                        } catch {
                            // Set defaults on parse error
                            const defaults = AVAILABLE_MODULES.filter(m => m.defaultEnabled).map(m => m.id);
                            setEnabledModules(defaults);
                        }
                    }
                    // Parse settings if available
                    try {
                        const settings = JSON.parse(data.data.company.settings || "{}");
                        if (settings.notifications) {
                            setNotificationSettings(prev => ({ ...prev, ...settings.notifications }));
                        }
                    } catch {
                        // ignore parse errors
                    }
                }
            }
        } catch {
            setError("Erro ao carregar dados");
        } finally {
            setLoading(false);
        }
    };

    const fetchTwoFactorStatus = async () => {
        try {
            const response = await fetch("/api/auth/2fa/setup");
            const data = await response.json();
            if (data.success) {
                setTwoFactorEnabled(data.data.enabled);
            }
        } catch {
            // ignore
        }
    };

    const handleSetupTwoFactor = async () => {
        setTwoFactorLoading(true);
        try {
            const response = await fetch("/api/auth/2fa/setup", { method: "POST" });
            const data = await response.json();
            if (data.success) {
                setTwoFactorSetup({
                    secret: data.data.secret,
                    qrCode: data.data.qrCode,
                });
                setShowTwoFactorModal(true);
            } else {
                showError(data.error || "Erro ao gerar 2FA");
            }
        } catch {
            showError("Erro ao configurar 2FA");
        } finally {
            setTwoFactorLoading(false);
        }
    };

    const handleEnableTwoFactor = async () => {
        if (twoFactorCode.length !== 6) {
            showError("Digite o código de 6 dígitos");
            return;
        }

        setTwoFactorLoading(true);
        try {
            const response = await fetch("/api/auth/2fa/setup", {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    secret: twoFactorSetup?.secret,
                    token: twoFactorCode,
                }),
            });
            const data = await response.json();

            if (data.success) {
                setTwoFactorEnabled(true);
                setShowTwoFactorModal(false);
                setTwoFactorSetup(null);
                setTwoFactorCode("");
                showSuccess("2FA ativado com sucesso!");
            } else {
                showError(data.error || "Código inválido");
            }
        } catch {
            showError("Erro ao ativar 2FA");
        } finally {
            setTwoFactorLoading(false);
        }
    };

    const handleDisableTwoFactor = async () => {
        const code = prompt("Digite o código do seu app autenticador para desativar o 2FA:");
        if (!code) return;

        setTwoFactorLoading(true);
        try {
            const response = await fetch("/api/auth/2fa/setup", {
                method: "DELETE",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ token: code }),
            });
            const data = await response.json();

            if (data.success) {
                setTwoFactorEnabled(false);
                showSuccess("2FA desativado com sucesso!");
            } else {
                showError(data.error || "Código inválido");
            }
        } catch {
            showError("Erro ao desativar 2FA");
        } finally {
            setTwoFactorLoading(false);
        }
    };

    const showSuccess = (message: string) => {
        setSuccess(message);
        setError("");
        setTimeout(() => setSuccess(""), 3000);
    };

    const showError = (message: string) => {
        setError(message);
        setSuccess("");
    };

    const handleSaveProfile = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true);

        try {
            const response = await fetch("/api/users/profile", {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(profileForm),
            });
            const data = await response.json();

            if (data.success) {
                showSuccess(data.message || "Perfil atualizado com sucesso!");
            } else {
                showError(data.error || "Erro ao atualizar perfil");
            }
        } catch {
            showError("Erro ao atualizar perfil");
        } finally {
            setSaving(false);
        }
    };

    const handleSaveCompany = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true);

        try {
            const response = await fetch("/api/company", {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(companyForm),
            });
            const data = await response.json();

            if (data.success) {
                showSuccess(data.message || "Empresa atualizada com sucesso!");
            } else {
                showError(data.error || "Erro ao atualizar empresa");
            }
        } catch {
            showError("Erro ao atualizar empresa");
        } finally {
            setSaving(false);
        }
    };

    const handleSaveNotifications = async () => {
        setSaving(true);

        try {
            const response = await fetch("/api/company", {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ notifications: notificationSettings }),
            });
            const data = await response.json();

            if (data.success) {
                showSuccess("Notificações atualizadas!");
            } else {
                showError(data.error || "Erro ao salvar notificações");
            }
        } catch {
            showError("Erro ao salvar notificações");
        } finally {
            setSaving(false);
        }
    };

    const handleChangePassword = async (e: React.FormEvent) => {
        e.preventDefault();

        if (passwordForm.newPassword !== passwordForm.confirmPassword) {
            showError("As senhas não coincidem");
            return;
        }

        if (passwordForm.newPassword.length < 6) {
            showError("A nova senha deve ter pelo menos 6 caracteres");
            return;
        }

        setSaving(true);

        try {
            const response = await fetch("/api/users/profile", {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    currentPassword: passwordForm.currentPassword,
                    newPassword: passwordForm.newPassword,
                }),
            });
            const data = await response.json();

            if (data.success) {
                setPasswordForm({ currentPassword: "", newPassword: "", confirmPassword: "" });
                showSuccess(data.message || "Senha alterada com sucesso!");
            } else {
                showError(data.error || "Erro ao alterar senha");
            }
        } catch {
            showError("Erro ao alterar senha");
        } finally {
            setSaving(false);
        }
    };

    const handleSavePix = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true);

        try {
            const response = await fetch("/api/company", {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    pixKeyType: pixForm.pixKeyType,
                    pixKey: pixForm.pixKey,
                }),
            });
            const data = await response.json();

            if (data.success) {
                showSuccess("PIX configurado com sucesso!");
            } else {
                showError(data.error || "Erro ao salvar PIX");
            }
        } catch {
            showError("Erro ao salvar PIX");
        } finally {
            setSaving(false);
        }
    };

    const handleToggleModule = (moduleId: string) => {
        if (enabledModules.includes(moduleId)) {
            setEnabledModules(enabledModules.filter(id => id !== moduleId));
        } else {
            setEnabledModules([...enabledModules, moduleId]);
        }
    };

    const handleSaveModules = async () => {
        setSaving(true);

        try {
            const response = await fetch("/api/company", {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ enabledModules }),
            });
            const data = await response.json();

            if (data.success) {
                showSuccess("Módulos atualizados! Recarregue a página para ver as mudanças no menu.");
            } else {
                showError(data.error || "Erro ao salvar módulos");
            }
        } catch {
            showError("Erro ao salvar módulos");
        } finally {
            setSaving(false);
        }
    };

    const tabs = [
        { id: "profile" as const, label: "Meu Perfil", icon: User },
        { id: "company" as const, label: "Empresa", icon: Building2 },
        { id: "pix" as const, label: "PIX", icon: CreditCard },
        { id: "notifications" as const, label: "Notificações", icon: Bell },
        { id: "security" as const, label: "Segurança", icon: Shield },
        { id: "modules" as const, label: "Módulos", icon: LayoutGrid },
    ];

    if (loading) {
        return (
            <div className="dash-loading">
                <div className="dash-spinner" />
            </div>
        );
    }

    return (
        <div className="dash-fade-in">
            {/* Page Header */}
            <div className="dash-page-header">
                <h1 className="dash-page-title">
                    <Settings style={{ width: 28, height: 28, marginRight: 8, color: '#34d399', display: 'inline' }} />
                    Configurações
                </h1>
                <p className="dash-page-subtitle">Gerencie sua conta e preferências</p>
            </div>

            {/* Alerts */}
            {success && (
                <div style={{
                    padding: '1rem',
                    background: 'rgba(16, 185, 129, 0.1)',
                    border: '1px solid rgba(16, 185, 129, 0.2)',
                    borderRadius: '12px',
                    color: '#34d399',
                    marginBottom: '1.5rem',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem'
                }}>
                    <Check style={{ width: 18, height: 18 }} />
                    {success}
                </div>
            )}

            {error && (
                <div style={{
                    padding: '1rem',
                    background: 'rgba(239, 68, 68, 0.1)',
                    border: '1px solid rgba(239, 68, 68, 0.2)',
                    borderRadius: '12px',
                    color: '#f87171',
                    marginBottom: '1.5rem'
                }}>
                    {error}
                </div>
            )}

            <div className="dash-sidebar-layout">
                {/* Sidebar Tabs */}
                <div className="dash-card dash-settings-sidebar">
                    <div style={{ padding: '0.5rem' }}>
                        {tabs.map(tab => (
                            <button
                                key={tab.id}
                                onClick={() => handleTabChange(tab.id as TabType)}
                                className={`dash-nav-item ${activeTab === tab.id ? 'active' : ''}`}
                                style={{ width: '100%' }}
                            >
                                <tab.icon />
                                {tab.label}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Content Area */}
                <div className="dash-card" style={{ flex: 1 }}>
                    <div className="dash-card-content">
                        {/* Profile Tab */}
                        {activeTab === "profile" && (
                            <form onSubmit={handleSaveProfile} className="dash-form">
                                <h3 style={{ fontSize: '1.1rem', fontWeight: 600, color: 'white', marginBottom: '1rem' }}>
                                    Meu Perfil
                                </h3>

                                <div className="dash-field">
                                    <label className="dash-label">Nome Completo</label>
                                    <input
                                        type="text"
                                        value={profileForm.name}
                                        onChange={(e) => setProfileForm({ ...profileForm, name: e.target.value })}
                                        className="dash-input"
                                        placeholder="Seu nome"
                                    />
                                </div>

                                <div className="dash-field">
                                    <label className="dash-label">Email</label>
                                    <div style={{ position: 'relative' }}>
                                        <Mail style={{
                                            position: 'absolute',
                                            left: 12,
                                            top: '50%',
                                            transform: 'translateY(-50%)',
                                            width: 18,
                                            height: 18,
                                            color: '#64748b'
                                        }} />
                                        <input
                                            type="email"
                                            value={profileForm.email}
                                            onChange={(e) => setProfileForm({ ...profileForm, email: e.target.value })}
                                            className="dash-input"
                                            style={{ paddingLeft: '2.75rem' }}
                                            placeholder="seu@email.com"
                                        />
                                    </div>
                                </div>

                                <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1rem' }}>
                                    <button type="submit" className="dash-btn primary" disabled={saving}>
                                        {saving ? <RefreshCw style={{ animation: 'spin 1s linear infinite' }} /> : <Save />}
                                        Salvar Alterações
                                    </button>
                                </div>
                            </form>
                        )}

                        {/* Company Tab */}
                        {activeTab === "company" && (
                            <form onSubmit={handleSaveCompany} className="dash-form">
                                <h3 style={{ fontSize: '1.1rem', fontWeight: 600, color: 'white', marginBottom: '1rem' }}>
                                    Dados da Empresa
                                </h3>

                                <div className="dash-form-row">
                                    <div className="dash-field">
                                        <label className="dash-label">Nome da Empresa</label>
                                        <input
                                            type="text"
                                            value={companyForm.name}
                                            onChange={(e) => setCompanyForm({ ...companyForm, name: e.target.value })}
                                            className="dash-input"
                                            placeholder="Nome da empresa"
                                        />
                                    </div>
                                    <div className="dash-field">
                                        <label className="dash-label">CNPJ</label>
                                        <input
                                            type="text"
                                            value={companyForm.document}
                                            onChange={(e) => setCompanyForm({ ...companyForm, document: e.target.value })}
                                            className="dash-input"
                                            placeholder="00.000.000/0000-00"
                                        />
                                    </div>
                                </div>

                                <div className="dash-form-row">
                                    <div className="dash-field">
                                        <label className="dash-label">Email Comercial</label>
                                        <input
                                            type="email"
                                            value={companyForm.email}
                                            onChange={(e) => setCompanyForm({ ...companyForm, email: e.target.value })}
                                            className="dash-input"
                                            placeholder="contato@empresa.com"
                                        />
                                    </div>
                                    <div className="dash-field">
                                        <label className="dash-label">Telefone</label>
                                        <input
                                            type="tel"
                                            value={companyForm.phone}
                                            onChange={(e) => setCompanyForm({ ...companyForm, phone: e.target.value })}
                                            className="dash-input"
                                            placeholder="(11) 99999-9999"
                                        />
                                    </div>
                                </div>

                                <div className="dash-field">
                                    <label className="dash-label">Fuso Horário</label>
                                    <div style={{ position: 'relative' }}>
                                        <Globe style={{
                                            position: 'absolute',
                                            left: 12,
                                            top: '50%',
                                            transform: 'translateY(-50%)',
                                            width: 18,
                                            height: 18,
                                            color: '#64748b'
                                        }} />
                                        <select
                                            value={companyForm.timezone}
                                            onChange={(e) => setCompanyForm({ ...companyForm, timezone: e.target.value })}
                                            className="dash-input dash-select"
                                            style={{ paddingLeft: '2.75rem' }}
                                        >
                                            <option value="America/Sao_Paulo">Brasília (GMT-3)</option>
                                            <option value="America/Manaus">Manaus (GMT-4)</option>
                                            <option value="America/Belem">Belém (GMT-3)</option>
                                            <option value="America/Fortaleza">Fortaleza (GMT-3)</option>
                                            <option value="America/Recife">Recife (GMT-3)</option>
                                        </select>
                                    </div>
                                </div>

                                <div className="dash-form-row">
                                    <div className="dash-field">
                                        <label className="dash-label">Segmento/Nicho da Empresa</label>
                                        <select
                                            value={companyForm.niche}
                                            onChange={(e) => setCompanyForm({ ...companyForm, niche: e.target.value })}
                                            className="dash-input dash-select"
                                        >
                                            <option value="">Selecione o segmento...</option>
                                            <option value="Loja de Roupas">Loja de Roupas</option>
                                            <option value="Restaurante/Lanchonete">Restaurante/Lanchonete</option>
                                            <option value="Clínica Estética">Clínica Estética</option>
                                            <option value="Consultório Médico">Consultório Médico</option>
                                            <option value="Imobiliária">Imobiliária</option>
                                            <option value="Advogado/Escritório Jurídico">Advogado/Escritório Jurídico</option>
                                            <option value="Academia/Personal Trainer">Academia/Personal Trainer</option>
                                            <option value="E-commerce/Loja Online">E-commerce/Loja Online</option>
                                            <option value="Agência de Marketing">Agência de Marketing</option>
                                            <option value="Salão de Beleza/Barbearia">Salão de Beleza/Barbearia</option>
                                            <option value="Pet Shop/Veterinário">Pet Shop/Veterinário</option>
                                            <option value="Oficina Mecânica">Oficina Mecânica</option>
                                            <option value="Contabilidade">Contabilidade</option>
                                            <option value="Escola/Curso">Escola/Curso</option>
                                            <option value="Outro">Outro</option>
                                        </select>
                                        <p style={{ fontSize: '0.75rem', color: '#64748b', marginTop: 4 }}>
                                            Isso ajuda a IA a entender seu negócio
                                        </p>
                                    </div>
                                </div>

                                <div className="dash-field">
                                    <label className="dash-label">Descrição da Empresa (para a IA)</label>
                                    <textarea
                                        value={companyForm.description}
                                        onChange={(e) => setCompanyForm({ ...companyForm, description: e.target.value })}
                                        className="dash-input"
                                        rows={3}
                                        placeholder="Descreva sua empresa, produtos/serviços oferecidos, localização, horário de funcionamento..."
                                        style={{ minHeight: 80, resize: 'vertical' }}
                                    />
                                    <p style={{ fontSize: '0.75rem', color: '#64748b', marginTop: 4 }}>
                                        Quanto mais detalhes, melhor a IA vai responder sobre sua empresa
                                    </p>
                                </div>

                                <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1rem' }}>
                                    <button type="submit" className="dash-btn primary" disabled={saving}>
                                        {saving ? <RefreshCw style={{ animation: 'spin 1s linear infinite' }} /> : <Save />}
                                        Salvar Alterações
                                    </button>
                                </div>
                            </form>
                        )}

                        {/* Notifications Tab */}
                        {activeTab === "notifications" && (
                            <div className="dash-form">
                                <h3 style={{ fontSize: '1.1rem', fontWeight: 600, color: 'white', marginBottom: '1rem' }}>
                                    Preferências de Notificação
                                </h3>

                                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                                    {[
                                        { key: "emailNewConversation" as const, label: "Nova Conversa", desc: "Receber email quando há uma nova conversa" },
                                        { key: "emailDailyReport" as const, label: "Relatório Diário", desc: "Resumo diário de atividades por email" },
                                        { key: "emailWeeklyReport" as const, label: "Relatório Semanal", desc: "Relatório semanal com métricas detalhadas" },
                                        { key: "browserNotifications" as const, label: "Notificações do Navegador", desc: "Alertas em tempo real no navegador" },
                                    ].map(item => (
                                        <div key={item.key} style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'space-between',
                                            padding: '1rem',
                                            background: 'rgba(255,255,255,0.03)',
                                            borderRadius: '12px',
                                            border: '1px solid rgba(255,255,255,0.08)'
                                        }}>
                                            <div>
                                                <h4 style={{ fontWeight: 500, color: 'white', margin: '0 0 0.25rem' }}>{item.label}</h4>
                                                <p style={{ fontSize: '0.85rem', color: '#94a3b8', margin: 0 }}>{item.desc}</p>
                                            </div>
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    setNotificationSettings({
                                                        ...notificationSettings,
                                                        [item.key]: !notificationSettings[item.key]
                                                    });
                                                }}
                                                style={{
                                                    width: 48,
                                                    height: 28,
                                                    borderRadius: 14,
                                                    background: notificationSettings[item.key] ? '#10b981' : '#475569',
                                                    border: 'none',
                                                    cursor: 'pointer',
                                                    position: 'relative',
                                                    transition: 'all 0.2s ease'
                                                }}
                                            >
                                                <span style={{
                                                    position: 'absolute',
                                                    top: 4,
                                                    left: notificationSettings[item.key] ? 24 : 4,
                                                    width: 20,
                                                    height: 20,
                                                    borderRadius: '50%',
                                                    background: 'white',
                                                    transition: 'left 0.2s ease'
                                                }} />
                                            </button>
                                        </div>
                                    ))}
                                </div>

                                <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1.5rem' }}>
                                    <button type="button" className="dash-btn primary" onClick={handleSaveNotifications} disabled={saving}>
                                        {saving ? <RefreshCw style={{ animation: 'spin 1s linear infinite' }} /> : <Save />}
                                        Salvar Preferências
                                    </button>
                                </div>
                            </div>
                        )}

                        {/* PIX Tab */}
                        {activeTab === "pix" && (
                            <form onSubmit={handleSavePix} className="dash-form">
                                <h3 style={{ fontSize: '1.1rem', fontWeight: 600, color: 'white', marginBottom: '1rem' }}>
                                    Configurar PIX para Recebimentos
                                </h3>

                                <div style={{
                                    padding: '1rem',
                                    background: 'rgba(59, 130, 246, 0.1)',
                                    border: '1px solid rgba(59, 130, 246, 0.2)',
                                    borderRadius: '12px',
                                    color: '#60a5fa',
                                    fontSize: '0.9rem',
                                    marginBottom: '1.5rem'
                                }}>
                                    💡 Configure sua chave PIX para que a IA possa enviar automaticamente para clientes que confirmarem compra.
                                </div>

                                <div className="dash-field">
                                    <label className="dash-label">Tipo de Chave PIX</label>
                                    <select
                                        value={pixForm.pixKeyType}
                                        onChange={(e) => setPixForm({ ...pixForm, pixKeyType: e.target.value })}
                                        className="dash-input dash-select"
                                    >
                                        <option value="">Selecione o tipo...</option>
                                        <option value="CPF">CPF</option>
                                        <option value="CNPJ">CNPJ</option>
                                        <option value="EMAIL">E-mail</option>
                                        <option value="TELEFONE">Telefone</option>
                                        <option value="ALEATORIA">Chave Aleatória</option>
                                    </select>
                                </div>

                                <div className="dash-field">
                                    <label className="dash-label">Chave PIX</label>
                                    <input
                                        type="text"
                                        value={pixForm.pixKey}
                                        onChange={(e) => setPixForm({ ...pixForm, pixKey: e.target.value })}
                                        className="dash-input"
                                        placeholder={
                                            pixForm.pixKeyType === "CPF" ? "000.000.000-00" :
                                                pixForm.pixKeyType === "CNPJ" ? "00.000.000/0000-00" :
                                                    pixForm.pixKeyType === "EMAIL" ? "email@exemplo.com" :
                                                        pixForm.pixKeyType === "TELEFONE" ? "+5511999999999" :
                                                            pixForm.pixKeyType === "ALEATORIA" ? "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx" :
                                                                "Selecione o tipo primeiro"
                                        }
                                    />
                                    <p style={{ fontSize: '0.75rem', color: '#64748b', marginTop: 4 }}>
                                        Essa chave será enviada automaticamente para clientes que confirmarem compra
                                    </p>
                                </div>

                                <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1rem' }}>
                                    <button
                                        type="submit"
                                        className="dash-btn primary"
                                        disabled={saving || !pixForm.pixKeyType || !pixForm.pixKey}
                                    >
                                        {saving ? <RefreshCw style={{ animation: 'spin 1s linear infinite' }} /> : <Save />}
                                        Salvar PIX
                                    </button>
                                </div>
                            </form>
                        )}

                        {/* Security Tab */}
                        {activeTab === "security" && (
                            <div className="dash-form">
                                <form onSubmit={handleChangePassword}>
                                    <h3 style={{ fontSize: '1.1rem', fontWeight: 600, color: 'white', marginBottom: '1rem' }}>
                                        Alterar Senha
                                    </h3>

                                    <div className="dash-field">
                                        <label className="dash-label">Senha Atual</label>
                                        <input
                                            type="password"
                                            value={passwordForm.currentPassword}
                                            onChange={(e) => setPasswordForm({ ...passwordForm, currentPassword: e.target.value })}
                                            className="dash-input"
                                            placeholder="••••••••"
                                            required
                                        />
                                    </div>

                                    <div className="dash-form-row">
                                        <div className="dash-field">
                                            <label className="dash-label">Nova Senha</label>
                                            <input
                                                type="password"
                                                value={passwordForm.newPassword}
                                                onChange={(e) => setPasswordForm({ ...passwordForm, newPassword: e.target.value })}
                                                className="dash-input"
                                                placeholder="••••••••"
                                                required
                                            />
                                        </div>
                                        <div className="dash-field">
                                            <label className="dash-label">Confirmar Nova Senha</label>
                                            <input
                                                type="password"
                                                value={passwordForm.confirmPassword}
                                                onChange={(e) => setPasswordForm({ ...passwordForm, confirmPassword: e.target.value })}
                                                className="dash-input"
                                                placeholder="••••••••"
                                                required
                                            />
                                        </div>
                                    </div>

                                    <div style={{
                                        padding: '1rem',
                                        background: 'rgba(59, 130, 246, 0.1)',
                                        border: '1px solid rgba(59, 130, 246, 0.2)',
                                        borderRadius: '12px',
                                        color: '#60a5fa',
                                        fontSize: '0.85rem'
                                    }}>
                                        💡 A senha deve ter pelo menos 6 caracteres. Recomendamos usar letras, números e símbolos.
                                    </div>

                                    <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1rem' }}>
                                        <button type="submit" className="dash-btn primary" disabled={saving}>
                                            {saving ? <RefreshCw style={{ animation: 'spin 1s linear infinite' }} /> : <Shield />}
                                            Alterar Senha
                                        </button>
                                    </div>
                                </form>

                                {/* 2FA Section */}
                                <div style={{ marginTop: '2rem', paddingTop: '2rem', borderTop: '1px solid rgba(255,255,255,0.1)' }}>
                                    <h3 style={{ fontSize: '1.1rem', fontWeight: 600, color: 'white', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                        <Smartphone style={{ width: 20, height: 20, color: '#8b5cf6' }} />
                                        Autenticação de Dois Fatores (2FA)
                                    </h3>
                                    <p style={{ color: '#94a3b8', fontSize: '0.9rem', marginBottom: '1.5rem' }}>
                                        Adicione uma camada extra de segurança à sua conta usando um app autenticador.
                                    </p>

                                    <div style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'space-between',
                                        padding: '1.25rem',
                                        background: twoFactorEnabled ? 'rgba(16, 185, 129, 0.1)' : 'rgba(255,255,255,0.03)',
                                        border: `1px solid ${twoFactorEnabled ? 'rgba(16, 185, 129, 0.3)' : 'rgba(255,255,255,0.08)'}`,
                                        borderRadius: '12px',
                                    }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                                            <div style={{
                                                width: 44,
                                                height: 44,
                                                borderRadius: '50%',
                                                background: twoFactorEnabled ? 'rgba(16, 185, 129, 0.2)' : 'rgba(139, 92, 246, 0.1)',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                            }}>
                                                <Shield style={{ width: 22, height: 22, color: twoFactorEnabled ? '#10b981' : '#8b5cf6' }} />
                                            </div>
                                            <div>
                                                <h4 style={{ fontWeight: 600, color: 'white', margin: 0 }}>
                                                    {twoFactorEnabled ? '2FA Ativado' : '2FA Desativado'}
                                                </h4>
                                                <p style={{ fontSize: '0.85rem', color: '#94a3b8', margin: 0 }}>
                                                    {twoFactorEnabled
                                                        ? 'Sua conta está protegida com verificação em duas etapas'
                                                        : 'Ative para maior segurança no login'}
                                                </p>
                                            </div>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={twoFactorEnabled ? handleDisableTwoFactor : handleSetupTwoFactor}
                                            disabled={twoFactorLoading}
                                            className={`dash-btn ${twoFactorEnabled ? 'ghost' : 'primary'}`}
                                            style={{ minWidth: 120 }}
                                        >
                                            {twoFactorLoading ? (
                                                <Loader2 style={{ animation: 'spin 1s linear infinite' }} />
                                            ) : twoFactorEnabled ? (
                                                'Desativar'
                                            ) : (
                                                'Ativar 2FA'
                                            )}
                                        </button>
                                    </div>

                                    {!twoFactorEnabled && (
                                        <div style={{
                                            marginTop: '1rem',
                                            padding: '1rem',
                                            background: 'rgba(139, 92, 246, 0.1)',
                                            border: '1px solid rgba(139, 92, 246, 0.2)',
                                            borderRadius: '12px',
                                            fontSize: '0.85rem',
                                            color: '#a78bfa'
                                        }}>
                                            <strong>Como funciona:</strong> Após ativar, você precisará digitar um código de 6 dígitos do seu app autenticador (Google Authenticator, Authy, etc.) sempre que fizer login.
                                        </div>
                                    )}
                                </div>

                                {/* LGPD - Data Deletion Section */}
                                <div style={{ marginTop: '2rem', paddingTop: '2rem', borderTop: '1px solid rgba(255,255,255,0.1)' }}>
                                    <h3 style={{ fontSize: '1.1rem', fontWeight: 600, color: '#ef4444', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                        ⚠️ Exclusão de Dados (LGPD)
                                    </h3>
                                    <p style={{ color: '#94a3b8', fontSize: '0.9rem', marginBottom: '1.5rem' }}>
                                        De acordo com a Lei Geral de Proteção de Dados (LGPD), você tem o direito de solicitar a exclusão de todos os seus dados.
                                    </p>

                                    <div style={{
                                        padding: '1.25rem',
                                        background: 'rgba(239, 68, 68, 0.1)',
                                        border: '1px solid rgba(239, 68, 68, 0.3)',
                                        borderRadius: '12px',
                                    }}>
                                        <div style={{ marginBottom: '1rem' }}>
                                            <h4 style={{ fontWeight: 600, color: '#ef4444', margin: '0 0 0.5rem' }}>
                                                Atenção: Esta ação é irreversível!
                                            </h4>
                                            <p style={{ fontSize: '0.85rem', color: '#f87171', margin: 0 }}>
                                                Ao solicitar a exclusão, serão removidos permanentemente:
                                            </p>
                                            <ul style={{ fontSize: '0.85rem', color: '#f87171', margin: '0.5rem 0 0 1.5rem', padding: 0 }}>
                                                <li>Todas as conversas e mensagens</li>
                                                <li>Pedidos, produtos e catálogos</li>
                                                <li>Agentes de IA e treinamentos</li>
                                                <li>Contatos e dados de CRM</li>
                                                <li>Sua conta e todos os dados associados</li>
                                            </ul>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={async () => {
                                                const confirmed = window.confirm(
                                                    "ATENÇÃO: Esta ação é PERMANENTE e não pode ser desfeita!\n\n" +
                                                    "Todos os seus dados serão excluídos, incluindo:\n" +
                                                    "- Conversas e mensagens\n" +
                                                    "- Pedidos e produtos\n" +
                                                    "- Agentes de IA\n" +
                                                    "- Sua conta\n\n" +
                                                    "Deseja realmente excluir todos os seus dados?"
                                                );
                                                if (!confirmed) return;

                                                const doubleConfirm = window.confirm(
                                                    "TEM CERTEZA ABSOLUTA?\n\n" +
                                                    "Digite OK na próxima caixa para confirmar a exclusão definitiva."
                                                );
                                                if (!doubleConfirm) return;

                                                const finalConfirm = window.prompt(
                                                    "Digite 'EXCLUIR MEUS DADOS' para confirmar a exclusão definitiva:"
                                                );
                                                if (finalConfirm !== "EXCLUIR MEUS DADOS") {
                                                    showError("Texto de confirmação incorreto. Exclusão cancelada.");
                                                    return;
                                                }

                                                setSaving(true);
                                                try {
                                                    const response = await fetch("/api/users/me/data", { method: "DELETE" });
                                                    const data = await response.json();
                                                    if (data.success) {
                                                        alert("Seus dados foram excluídos. Você será redirecionado.");
                                                        window.location.href = "/";
                                                    } else {
                                                        showError(data.error || "Erro ao excluir dados");
                                                    }
                                                } catch {
                                                    showError("Erro ao processar exclusão");
                                                } finally {
                                                    setSaving(false);
                                                }
                                            }}
                                            className="dash-btn danger"
                                            disabled={saving}
                                            style={{ width: '100%' }}
                                        >
                                            {saving ? <Loader2 style={{ animation: 'spin 1s linear infinite' }} /> : null}
                                            Solicitar Exclusão de Todos os Dados
                                        </button>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Modules Tab */}
                        {activeTab === "modules" && (
                            <div>
                                <h3 style={{ fontSize: '1.1rem', fontWeight: 600, color: 'white', marginBottom: '0.5rem' }}>
                                    Módulos do Menu
                                </h3>
                                <p style={{ color: '#94a3b8', fontSize: '0.9rem', marginBottom: '1.5rem' }}>
                                    Escolha quais módulos deseja visualizar no menu lateral. Módulos desativados ficarão ocultos.
                                </p>

                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                                    {AVAILABLE_MODULES.map(mod => (
                                        <div
                                            key={mod.id}
                                            onClick={() => handleToggleModule(mod.id)}
                                            style={{
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'space-between',
                                                padding: '1rem',
                                                background: enabledModules.includes(mod.id)
                                                    ? 'rgba(16, 185, 129, 0.1)'
                                                    : 'rgba(255, 255, 255, 0.03)',
                                                border: enabledModules.includes(mod.id)
                                                    ? '1px solid rgba(16, 185, 129, 0.3)'
                                                    : '1px solid rgba(255, 255, 255, 0.1)',
                                                borderRadius: '12px',
                                                cursor: 'pointer',
                                                transition: 'all 0.2s ease',
                                            }}
                                        >
                                            <div>
                                                <h4 style={{
                                                    fontWeight: 600,
                                                    color: enabledModules.includes(mod.id) ? '#34d399' : 'white',
                                                    margin: 0
                                                }}>
                                                    {mod.label}
                                                </h4>
                                                <p style={{ fontSize: '0.85rem', color: '#94a3b8', margin: '0.25rem 0 0' }}>
                                                    {mod.description}
                                                </p>
                                            </div>
                                            <div style={{
                                                width: 48,
                                                height: 28,
                                                borderRadius: 14,
                                                background: enabledModules.includes(mod.id)
                                                    ? 'linear-gradient(135deg, #10b981, #059669)'
                                                    : 'rgba(100, 116, 139, 0.3)',
                                                position: 'relative',
                                                transition: 'all 0.2s ease',
                                                flexShrink: 0,
                                            }}>
                                                <div style={{
                                                    width: 22,
                                                    height: 22,
                                                    borderRadius: '50%',
                                                    background: 'white',
                                                    position: 'absolute',
                                                    top: 3,
                                                    left: enabledModules.includes(mod.id) ? 23 : 3,
                                                    transition: 'all 0.2s ease',
                                                    boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
                                                }} />
                                            </div>
                                        </div>
                                    ))}
                                </div>

                                <div style={{
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    alignItems: 'center',
                                    marginTop: '1.5rem',
                                    paddingTop: '1rem',
                                    borderTop: '1px solid rgba(255,255,255,0.1)'
                                }}>
                                    <p style={{ color: '#94a3b8', fontSize: '0.85rem', margin: 0 }}>
                                        {enabledModules.length} de {AVAILABLE_MODULES.length} módulos ativos
                                    </p>
                                    <button
                                        onClick={handleSaveModules}
                                        className="dash-btn primary"
                                        disabled={saving}
                                    >
                                        {saving ? <RefreshCw style={{ animation: 'spin 1s linear infinite' }} /> : <Save />}
                                        Salvar Módulos
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
            {/* 2FA Setup Modal */}
            {showTwoFactorModal && twoFactorSetup && (
                <div style={{
                    position: 'fixed',
                    inset: 0,
                    background: 'rgba(0,0,0,0.8)',
                    backdropFilter: 'blur(4px)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    zIndex: 9999,
                    padding: '1rem',
                }}>
                    <div style={{
                        background: '#1a1a2e',
                        border: '1px solid rgba(255,255,255,0.1)',
                        borderRadius: '20px',
                        padding: '2rem',
                        maxWidth: 420,
                        width: '100%',
                        position: 'relative',
                    }}>
                        <button
                            onClick={() => {
                                setShowTwoFactorModal(false);
                                setTwoFactorSetup(null);
                                setTwoFactorCode("");
                            }}
                            style={{
                                position: 'absolute',
                                top: 16,
                                right: 16,
                                background: 'transparent',
                                border: 'none',
                                color: '#94a3b8',
                                cursor: 'pointer',
                            }}
                        >
                            <X />
                        </button>

                        <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
                            <div style={{
                                width: 60,
                                height: 60,
                                borderRadius: '50%',
                                background: 'rgba(139, 92, 246, 0.1)',
                                color: '#8b5cf6',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                margin: '0 auto 1rem',
                            }}>
                                <Smartphone style={{ width: 28, height: 28 }} />
                            </div>
                            <h3 style={{ fontSize: '1.25rem', fontWeight: 600, color: 'white', margin: 0 }}>
                                Configurar 2FA
                            </h3>
                            <p style={{ color: '#94a3b8', fontSize: '0.9rem', marginTop: '0.5rem' }}>
                                Escaneie o QR code no seu app autenticador
                            </p>
                        </div>

                        {/* QR Code */}
                        <div style={{
                            background: 'white',
                            borderRadius: '12px',
                            padding: '1rem',
                            display: 'flex',
                            justifyContent: 'center',
                            marginBottom: '1.5rem',
                        }}>
                            <img
                                src={twoFactorSetup.qrCode}
                                alt="QR Code 2FA"
                                style={{ width: 200, height: 200 }}
                            />
                        </div>

                        {/* Manual entry */}
                        <div style={{
                            background: 'rgba(255,255,255,0.05)',
                            borderRadius: '8px',
                            padding: '0.75rem',
                            marginBottom: '1.5rem',
                            textAlign: 'center',
                        }}>
                            <p style={{ fontSize: '0.75rem', color: '#94a3b8', margin: '0 0 0.5rem' }}>
                                Ou digite manualmente:
                            </p>
                            <code style={{ color: '#f59e0b', fontSize: '0.9rem', wordBreak: 'break-all' }}>
                                {twoFactorSetup.secret}
                            </code>
                        </div>

                        {/* Verification code input */}
                        <div className="dash-field" style={{ marginBottom: '1rem' }}>
                            <label className="dash-label">Código de verificação</label>
                            <input
                                type="text"
                                inputMode="numeric"
                                maxLength={6}
                                value={twoFactorCode}
                                onChange={(e) => setTwoFactorCode(e.target.value.replace(/\D/g, ""))}
                                className="dash-input"
                                placeholder="000000"
                                style={{ textAlign: 'center', fontSize: '1.5rem', letterSpacing: '0.5rem' }}
                            />
                            <p style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '0.5rem', textAlign: 'center' }}>
                                Digite o código de 6 dígitos do seu app autenticador
                            </p>
                        </div>

                        <button
                            type="button"
                            onClick={handleEnableTwoFactor}
                            disabled={twoFactorLoading || twoFactorCode.length !== 6}
                            className="dash-btn primary"
                            style={{ width: '100%' }}
                        >
                            {twoFactorLoading ? (
                                <Loader2 style={{ animation: 'spin 1s linear infinite' }} />
                            ) : (
                                <>
                                    <Check />
                                    Verificar e Ativar 2FA
                                </>
                            )}
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}

