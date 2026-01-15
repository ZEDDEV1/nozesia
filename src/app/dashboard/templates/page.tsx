"use client";

import { useState, useEffect } from "react";
import {
    FileText, Plus, Trash2, Edit2, Save, X, MessageSquare,
    RefreshCw, Settings, Loader2, Eye
} from "lucide-react";
import { TemplatePreview } from "@/components/template-preview";

interface Template {
    id: string;
    name: string;
    content: string;
    category: string;
    variables: string[];
    isActive: boolean;
    usageCount: number;
}

interface AutoRecoveryConfig {
    id: string;
    enabled: boolean;
    inactiveDays: number;
    message: string;
    startHour: number;
    endHour: number;
    activeDays: number[];
    dailyLimit: number;
    lastRunAt: string | null;
    lastRunCount: number;
}

const CATEGORIES = [
    { id: "WELCOME", label: "👋 Boas-vindas", color: "#22c55e" },
    { id: "FOLLOW_UP", label: "📞 Acompanhamento", color: "#3b82f6" },
    { id: "PROMO", label: "🎉 Promoções", color: "#f59e0b" },
    { id: "RECOVERY", label: "🔙 Recuperação", color: "#a78bfa" },
    { id: "REMINDER", label: "⏰ Lembretes", color: "#ec4899" },
    { id: "THANKS", label: "🙏 Agradecimentos", color: "#10b981" },
    { id: "CUSTOM", label: "✏️ Personalizado", color: "#64748b" },
];

const DAYS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

export default function TemplatesPage() {
    const [templates, setTemplates] = useState<Template[]>([]);
    const [recoveryConfig, setRecoveryConfig] = useState<AutoRecoveryConfig | null>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [showForm, setShowForm] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [activeTab, setActiveTab] = useState<"templates" | "recovery">("templates");

    const [newTemplate, setNewTemplate] = useState({
        name: "",
        content: "",
        category: "CUSTOM",
    });
    const [executing, setExecuting] = useState(false);

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        try {
            const [templatesRes, recoveryRes] = await Promise.all([
                fetch("/api/templates"),
                fetch("/api/auto-recovery"),
            ]);

            const templatesData = await templatesRes.json();
            const recoveryData = await recoveryRes.json();

            if (templatesData.success) setTemplates(templatesData.data);
            if (recoveryData.success) setRecoveryConfig(recoveryData.data);
        } catch (error) {
            console.error("Erro:", error);
        } finally {
            setLoading(false);
        }
    };

    const handleExecuteRecovery = async () => {
        if (!confirm("Executar recuperação agora? Isso vai criar uma campanha com os clientes inativos.")) return;
        setExecuting(true);

        try {
            const response = await fetch("/api/auto-recovery/execute", { method: "POST" });
            const data = await response.json();

            if (data.success) {
                alert(`✅ ${data.message}\n\nEncontrados: ${data.stats.found}\nElegíveis: ${data.stats.eligible}`);
                fetchData();
            } else {
                alert(`❌ ${data.error}`);
            }
        } catch (error) {
            console.error("Erro:", error);
            alert("Erro ao executar recuperação");
        } finally {
            setExecuting(false);
        }
    };

    const handleCreateTemplate = async () => {
        if (!newTemplate.name.trim() || !newTemplate.content.trim()) return;
        setSaving(true);

        try {
            const response = await fetch("/api/templates", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(newTemplate),
            });

            const data = await response.json();
            if (data.success) {
                setNewTemplate({ name: "", content: "", category: "CUSTOM" });
                setShowForm(false);
                fetchData();
            } else {
                alert(data.error);
            }
        } catch (error) {
            console.error("Erro:", error);
        } finally {
            setSaving(false);
        }
    };

    const handleDeleteTemplate = async (id: string) => {
        if (!confirm("Excluir este template?")) return;

        try {
            await fetch(`/api/templates/${id}`, { method: "DELETE" });
            fetchData();
        } catch (error) {
            console.error("Erro:", error);
        }
    };

    const handleEditTemplate = (template: Template) => {
        setEditingId(template.id);
        setNewTemplate({
            name: template.name,
            content: template.content,
            category: template.category,
        });
        setShowForm(true);
    };

    const handleUpdateTemplate = async () => {
        if (!editingId || !newTemplate.name.trim() || !newTemplate.content.trim()) return;
        setSaving(true);

        try {
            const response = await fetch(`/api/templates/${editingId}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(newTemplate),
            });

            const data = await response.json();
            if (data.success) {
                setNewTemplate({ name: "", content: "", category: "CUSTOM" });
                setShowForm(false);
                setEditingId(null);
                fetchData();
            } else {
                alert(data.error);
            }
        } catch (error) {
            console.error("Erro:", error);
        } finally {
            setSaving(false);
        }
    };

    const handleSaveTemplate = () => {
        if (editingId) {
            handleUpdateTemplate();
        } else {
            handleCreateTemplate();
        }
    };

    const handleCancelForm = () => {
        setShowForm(false);
        setEditingId(null);
        setNewTemplate({ name: "", content: "", category: "CUSTOM" });
    };

    const handleUpdateRecovery = async () => {
        if (!recoveryConfig) return;
        setSaving(true);

        try {
            await fetch("/api/auto-recovery", {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(recoveryConfig),
            });
        } catch (error) {
            console.error("Erro:", error);
        } finally {
            setSaving(false);
        }
    };

    const toggleRecoveryDay = (day: number) => {
        if (!recoveryConfig) return;
        const days = recoveryConfig.activeDays.includes(day)
            ? recoveryConfig.activeDays.filter(d => d !== day)
            : [...recoveryConfig.activeDays, day].sort();
        setRecoveryConfig({ ...recoveryConfig, activeDays: days });
    };

    if (loading) {
        return (
            <div className="dash-loading">
                <div className="dash-spinner" />
            </div>
        );
    }

    return (
        <div className="dash-fade-in">
            {/* Header */}
            <div className="dash-page-header">
                <h1 className="dash-page-title">
                    <FileText style={{ width: 28, height: 28, marginRight: 8, color: "#a78bfa" }} />
                    Templates & Recuperação
                </h1>
                <p className="dash-page-subtitle">
                    Mensagens prontas e recuperação automática de clientes
                </p>
            </div>

            {/* Tabs */}
            <div style={{ display: "flex", gap: "0.5rem", marginBottom: "1.5rem" }}>
                <button
                    onClick={() => setActiveTab("templates")}
                    className={`dash-btn ${activeTab === "templates" ? "primary" : "secondary"}`}
                >
                    <MessageSquare style={{ width: 16, height: 16 }} />
                    Templates
                </button>
                <button
                    onClick={() => setActiveTab("recovery")}
                    className={`dash-btn ${activeTab === "recovery" ? "primary" : "secondary"}`}
                >
                    <RefreshCw style={{ width: 16, height: 16 }} />
                    Recuperação Automática
                </button>
            </div>

            {/* Templates Tab */}
            {activeTab === "templates" && (
                <>
                    {/* Info */}
                    <div className="dash-card" style={{ padding: "1rem", marginBottom: "1.5rem", background: "rgba(167, 139, 250, 0.1)", border: "1px solid rgba(167, 139, 250, 0.3)" }}>
                        <p style={{ color: "#a78bfa", margin: 0, fontSize: "0.875rem" }}>
                            💡 Use variáveis: <code style={{ background: "rgba(0,0,0,0.3)", padding: "2px 6px", borderRadius: "4px" }}>{"{nome}"}</code>, <code style={{ background: "rgba(0,0,0,0.3)", padding: "2px 6px", borderRadius: "4px" }}>{"{produto}"}</code>, <code style={{ background: "rgba(0,0,0,0.3)", padding: "2px 6px", borderRadius: "4px" }}>{"{valor}"}</code>, <code style={{ background: "rgba(0,0,0,0.3)", padding: "2px 6px", borderRadius: "4px" }}>{"{empresa}"}</code>
                        </p>
                    </div>

                    {/* Create Button */}
                    {!showForm && (
                        <button onClick={() => setShowForm(true)} className="dash-btn primary" style={{ marginBottom: "1.5rem" }}>
                            <Plus style={{ width: 18, height: 18 }} />
                            Novo Template
                        </button>
                    )}

                    {/* Form */}
                    {showForm && (
                        <div className="dash-card" style={{ padding: "1.5rem", marginBottom: "1.5rem" }}>
                            <h3 style={{ color: "white", marginBottom: "1rem" }}>
                                {editingId ? "Editar Template" : "Novo Template"}
                            </h3>

                            <div style={{ marginBottom: "1rem" }}>
                                <label className="dash-label">Nome</label>
                                <input
                                    type="text"
                                    className="dash-input"
                                    placeholder="Ex: Boas-vindas novo cliente"
                                    value={newTemplate.name}
                                    onChange={(e) => setNewTemplate({ ...newTemplate, name: e.target.value })}
                                />
                            </div>

                            <div style={{ marginBottom: "1rem" }}>
                                <label className="dash-label">Categoria</label>
                                <select
                                    className="dash-input"
                                    value={newTemplate.category}
                                    onChange={(e) => setNewTemplate({ ...newTemplate, category: e.target.value })}
                                >
                                    {CATEGORIES.map(cat => (
                                        <option key={cat.id} value={cat.id}>{cat.label}</option>
                                    ))}
                                </select>
                            </div>

                            <div style={{ marginBottom: "1.5rem" }}>
                                <label className="dash-label">Conteúdo</label>
                                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
                                    <textarea
                                        className="dash-input"
                                        rows={6}
                                        placeholder="Oi {{nome}}! Seja bem-vindo(a) à {{empresa}}! 😊"
                                        value={newTemplate.content}
                                        onChange={(e) => setNewTemplate({ ...newTemplate, content: e.target.value })}
                                        style={{ resize: "vertical" }}
                                    />
                                    <div>
                                        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.5rem" }}>
                                            <Eye size={14} style={{ color: "#64748b" }} />
                                            <span style={{ color: "#64748b", fontSize: "0.8rem" }}>Preview</span>
                                        </div>
                                        <TemplatePreview content={newTemplate.content} />
                                    </div>
                                </div>
                            </div>

                            <div style={{ display: "flex", gap: "0.75rem" }}>
                                <button onClick={handleSaveTemplate} className="dash-btn primary" disabled={saving}>
                                    {saving ? <Loader2 className="animate-spin" style={{ width: 16, height: 16 }} /> : <Save style={{ width: 16, height: 16 }} />}
                                    {editingId ? "Atualizar" : "Salvar"}
                                </button>
                                <button onClick={handleCancelForm} className="dash-btn secondary">
                                    <X style={{ width: 16, height: 16 }} />
                                    Cancelar
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Templates List */}
                    {templates.length === 0 ? (
                        <div className="dash-card" style={{ textAlign: "center", padding: "3rem" }}>
                            <FileText style={{ width: 48, height: 48, color: "#475569", margin: "0 auto 1rem" }} />
                            <h3 style={{ color: "white", marginBottom: "0.5rem" }}>Nenhum template</h3>
                            <p style={{ color: "#94a3b8" }}>Crie templates para agilizar seus atendimentos</p>
                        </div>
                    ) : (
                        <div style={{ display: "grid", gap: "1rem" }}>
                            {templates.map(template => {
                                const cat = CATEGORIES.find(c => c.id === template.category) || CATEGORIES[6];
                                return (
                                    <div
                                        key={template.id}
                                        className="dash-card"
                                        style={{
                                            padding: "1.25rem",
                                            transition: "all 0.2s ease",
                                        }}
                                        onMouseEnter={(e) => {
                                            e.currentTarget.style.transform = "translateY(-2px)";
                                            e.currentTarget.style.boxShadow = "0 8px 25px rgba(0, 0, 0, 0.3)";
                                        }}
                                        onMouseLeave={(e) => {
                                            e.currentTarget.style.transform = "translateY(0)";
                                            e.currentTarget.style.boxShadow = "";
                                        }}
                                    >
                                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                                            <div style={{ flex: 1 }}>
                                                <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "0.5rem" }}>
                                                    <h3 style={{ color: "white", margin: 0 }}>{template.name}</h3>
                                                    <span style={{
                                                        padding: "0.25rem 0.75rem",
                                                        borderRadius: "999px",
                                                        fontSize: "0.75rem",
                                                        background: `${cat.color}20`,
                                                        color: cat.color,
                                                    }}>
                                                        {cat.label}
                                                    </span>
                                                </div>
                                                <p style={{ color: "#94a3b8", fontSize: "0.875rem", whiteSpace: "pre-wrap" }}>
                                                    {template.content}
                                                </p>
                                                {template.variables.length > 0 && (
                                                    <div style={{ marginTop: "0.5rem", display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
                                                        {template.variables.map(v => (
                                                            <span key={v} style={{
                                                                padding: "0.125rem 0.5rem",
                                                                borderRadius: "4px",
                                                                fontSize: "0.75rem",
                                                                background: "rgba(255,255,255,0.1)",
                                                                color: "#64748b",
                                                            }}>
                                                                {`{${v}}`}
                                                            </span>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                            <div style={{ display: "flex", gap: "0.5rem" }}>
                                                <button
                                                    onClick={() => handleEditTemplate(template)}
                                                    className="dash-btn secondary"
                                                    style={{ padding: "0.5rem" }}
                                                >
                                                    <Edit2 style={{ width: 16, height: 16 }} />
                                                </button>
                                                <button
                                                    onClick={() => handleDeleteTemplate(template.id)}
                                                    className="dash-btn secondary"
                                                    style={{ padding: "0.5rem", color: "#f87171" }}
                                                >
                                                    <Trash2 style={{ width: 16, height: 16 }} />
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </>
            )}

            {/* Recovery Tab */}
            {activeTab === "recovery" && recoveryConfig && (
                <div className="dash-card" style={{ padding: "1.5rem" }}>
                    <h3 style={{ color: "white", marginBottom: "1.5rem", display: "flex", alignItems: "center", gap: "0.5rem" }}>
                        <Settings style={{ width: 20, height: 20 }} />
                        Configurações de Recuperação
                    </h3>

                    {/* Enable Toggle */}
                    <div style={{ marginBottom: "1.5rem", display: "flex", alignItems: "center", gap: "1rem" }}>
                        <label style={{ color: "white" }}>Ativar recuperação automática</label>
                        <button
                            onClick={() => setRecoveryConfig({ ...recoveryConfig, enabled: !recoveryConfig.enabled })}
                            style={{
                                padding: "0.5rem 1rem",
                                borderRadius: "999px",
                                border: "none",
                                background: recoveryConfig.enabled ? "#22c55e" : "#475569",
                                color: "white",
                                cursor: "pointer",
                            }}
                        >
                            {recoveryConfig.enabled ? "ATIVO" : "DESATIVADO"}
                        </button>
                    </div>

                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem", marginBottom: "1.5rem" }}>
                        <div>
                            <label className="dash-label">Dias de inatividade</label>
                            <input
                                type="number"
                                className="dash-input"
                                value={recoveryConfig.inactiveDays}
                                onChange={(e) => setRecoveryConfig({ ...recoveryConfig, inactiveDays: parseInt(e.target.value) || 30 })}
                                min={7}
                                max={120}
                            />
                        </div>
                        <div>
                            <label className="dash-label">Limite diário</label>
                            <input
                                type="number"
                                className="dash-input"
                                value={recoveryConfig.dailyLimit}
                                onChange={(e) => setRecoveryConfig({ ...recoveryConfig, dailyLimit: parseInt(e.target.value) || 50 })}
                                min={1}
                                max={200}
                            />
                        </div>
                    </div>

                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem", marginBottom: "1.5rem" }}>
                        <div>
                            <label className="dash-label">Horário início</label>
                            <input
                                type="number"
                                className="dash-input"
                                value={recoveryConfig.startHour}
                                onChange={(e) => setRecoveryConfig({ ...recoveryConfig, startHour: parseInt(e.target.value) || 9 })}
                                min={0}
                                max={23}
                            />
                        </div>
                        <div>
                            <label className="dash-label">Horário fim</label>
                            <input
                                type="number"
                                className="dash-input"
                                value={recoveryConfig.endHour}
                                onChange={(e) => setRecoveryConfig({ ...recoveryConfig, endHour: parseInt(e.target.value) || 21 })}
                                min={0}
                                max={23}
                            />
                        </div>
                    </div>

                    <div style={{ marginBottom: "1.5rem" }}>
                        <label className="dash-label">Dias da semana</label>
                        <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.5rem" }}>
                            {DAYS.map((day, idx) => (
                                <button
                                    key={idx}
                                    onClick={() => toggleRecoveryDay(idx)}
                                    style={{
                                        padding: "0.5rem 1rem",
                                        borderRadius: "8px",
                                        border: recoveryConfig.activeDays.includes(idx)
                                            ? "2px solid #a78bfa"
                                            : "2px solid rgba(255,255,255,0.1)",
                                        background: recoveryConfig.activeDays.includes(idx)
                                            ? "rgba(167, 139, 250, 0.2)"
                                            : "transparent",
                                        color: recoveryConfig.activeDays.includes(idx) ? "#a78bfa" : "#64748b",
                                        cursor: "pointer",
                                    }}
                                >
                                    {day}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div style={{ marginBottom: "1.5rem" }}>
                        <label className="dash-label">Mensagem de recuperação</label>
                        <textarea
                            className="dash-input"
                            rows={4}
                            value={recoveryConfig.message}
                            onChange={(e) => setRecoveryConfig({ ...recoveryConfig, message: e.target.value })}
                            style={{ resize: "vertical" }}
                        />
                        <p style={{ color: "#64748b", fontSize: "0.75rem", marginTop: "0.5rem" }}>
                            Use {"{nome}"} para personalizar
                        </p>
                    </div>

                    <button onClick={handleUpdateRecovery} className="dash-btn primary" disabled={saving}>
                        {saving ? <Loader2 className="animate-spin" style={{ width: 16, height: 16 }} /> : <Save style={{ width: 16, height: 16 }} />}
                        Salvar Configurações
                    </button>

                    {/* Execute Button */}
                    <div style={{ marginTop: "2rem", paddingTop: "1.5rem", borderTop: "1px solid rgba(255,255,255,0.1)" }}>
                        <h4 style={{ color: "white", marginBottom: "1rem" }}>Execução Manual</h4>
                        <p style={{ color: "#94a3b8", fontSize: "0.875rem", marginBottom: "1rem" }}>
                            Execute agora para criar uma campanha com os clientes inativos. A campanha ficará em rascunho para você revisar antes de iniciar.
                        </p>

                        <button
                            onClick={handleExecuteRecovery}
                            className="dash-btn secondary"
                            disabled={executing}
                            style={{ background: "rgba(167, 139, 250, 0.2)", borderColor: "#a78bfa" }}
                        >
                            {executing ? <Loader2 className="animate-spin" style={{ width: 16, height: 16 }} /> : <RefreshCw style={{ width: 16, height: 16 }} />}
                            Executar Agora
                        </button>

                        {/* Last Run Stats */}
                        {recoveryConfig.lastRunAt && (
                            <div style={{ marginTop: "1rem", padding: "0.75rem", background: "rgba(255,255,255,0.05)", borderRadius: "8px" }}>
                                <p style={{ color: "#64748b", fontSize: "0.75rem", margin: 0 }}>
                                    Última execução: {new Date(recoveryConfig.lastRunAt).toLocaleString("pt-BR")}
                                    {recoveryConfig.lastRunCount > 0 && ` (${recoveryConfig.lastRunCount} clientes)`}
                                </p>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}

