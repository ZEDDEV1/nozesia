"use client";

import { useState, useEffect } from "react";
import {
    Send, Plus, Users, Play, Pause, Trash2,
    BarChart3, CheckCircle, MessageSquare, Loader2, FileText, Calendar,
    CheckCircle2, User
} from "lucide-react";

interface Campaign {
    id: string;
    name: string;
    originalMessage: string;
    variations: string[];
    targetSegments: string[];
    status: "DRAFT" | "SCHEDULED" | "RUNNING" | "PAUSED" | "COMPLETED" | "CANCELLED";
    scheduledAt: string | null;
    startedAt: string | null;
    completedAt: string | null;
    totalRecipients: number;
    sentCount: number;
    deliveredCount: number;
    readCount: number;
    repliedCount: number;
    failedCount: number;
    createdAt: string;
    deliveryRate?: number;
    readRate?: number;
    replyRate?: number;
}

interface Template {
    id: string;
    name: string;
    content: string;
    category: string;
}

interface NewCampaign {
    name: string;
    originalMessage: string;
    targetSegments: string[];
    scheduledAt: string;
}

interface SegmentContact {
    phone: string;
    name: string | null;
    lastMessageAt: string | null;
    messageCount: number;
    segment: string;
}

const SEGMENTS = [
    { id: "HOT", label: "🔥 Quentes", desc: "Compraram nos últimos 30 dias" },
    { id: "WARM", label: "⏳ Mornos", desc: "Conversaram recentemente" },
    { id: "INACTIVE", label: "😴 Inativos", desc: "Sem interação há 30-60 dias" },
    { id: "COLD", label: "❄️ Frios", desc: "Sem interação há 60-120 dias" },
    { id: "VIP", label: "⭐ VIPs", desc: "Clientes especiais" },
];

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
    DRAFT: { label: "Rascunho", color: "#94a3b8", bg: "rgba(148, 163, 184, 0.1)" },
    SCHEDULED: { label: "Agendada", color: "#a78bfa", bg: "rgba(167, 139, 250, 0.1)" },
    RUNNING: { label: "Em Execução", color: "#22c55e", bg: "rgba(34, 197, 94, 0.1)" },
    PAUSED: { label: "Pausada", color: "#eab308", bg: "rgba(234, 179, 8, 0.1)" },
    COMPLETED: { label: "Concluída", color: "#3b82f6", bg: "rgba(59, 130, 246, 0.1)" },
    CANCELLED: { label: "Cancelada", color: "#f87171", bg: "rgba(248, 113, 113, 0.1)" },
};

export default function CampaignsPage() {
    const [campaigns, setCampaigns] = useState<Campaign[]>([]);
    const [templates, setTemplates] = useState<Template[]>([]);
    const [loading, setLoading] = useState(true);
    const [showForm, setShowForm] = useState(false);
    const [creating, setCreating] = useState(false);
    const [selectedTemplate, setSelectedTemplate] = useState<string>("");
    const [newCampaign, setNewCampaign] = useState<NewCampaign>({
        name: "",
        originalMessage: "",
        targetSegments: ["HOT", "WARM"],
        scheduledAt: "",
    });

    // Contact selection states
    const [previewContacts, setPreviewContacts] = useState<SegmentContact[]>([]);
    const [selectedPhones, setSelectedPhones] = useState<string[]>([]);
    const [loadingContacts, setLoadingContacts] = useState(false);
    const [showContactsStep, setShowContactsStep] = useState(false);

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        try {
            const [campaignsRes, templatesRes] = await Promise.all([
                fetch("/api/campaigns"),
                fetch("/api/templates"),
            ]);

            const campaignsData = await campaignsRes.json();
            const templatesData = await templatesRes.json();

            if (campaignsData.success) setCampaigns(campaignsData.data);
            if (templatesData.success) setTemplates(templatesData.data);
        } catch (error) {
            console.error("Erro ao buscar dados:", error);
        } finally {
            setLoading(false);
        }
    };

    const handleTemplateSelect = (templateId: string) => {
        setSelectedTemplate(templateId);
        if (templateId) {
            const template = templates.find(t => t.id === templateId);
            if (template) {
                setNewCampaign({
                    ...newCampaign,
                    originalMessage: template.content,
                    name: newCampaign.name || `Campanha - ${template.name}`,
                });
            }
        }
    };

    // Fetch contacts for selected segments
    const fetchPreviewContacts = async () => {
        if (newCampaign.targetSegments.length === 0) return;

        setLoadingContacts(true);
        try {
            const segments = newCampaign.targetSegments.join(",");
            const res = await fetch(`/api/campaigns/preview-contacts?segments=${segments}`);
            const data = await res.json();

            if (data.success) {
                setPreviewContacts(data.data.contacts || []);
                // Auto-select all by default
                setSelectedPhones((data.data.contacts || []).map((c: SegmentContact) => c.phone));
                setShowContactsStep(true);
            }
        } catch (error) {
            console.error("Erro ao buscar contatos:", error);
        } finally {
            setLoadingContacts(false);
        }
    };

    // Toggle phone selection
    const togglePhone = (phone: string) => {
        setSelectedPhones(prev =>
            prev.includes(phone)
                ? prev.filter(p => p !== phone)
                : [...prev, phone]
        );
    };

    // Select/deselect all
    const toggleAllPhones = () => {
        if (selectedPhones.length === previewContacts.length) {
            setSelectedPhones([]);
        } else {
            setSelectedPhones(previewContacts.map(c => c.phone));
        }
    };

    const handleCreateCampaign = async () => {
        if (!newCampaign.name.trim() || !newCampaign.originalMessage.trim()) return;
        if (selectedPhones.length === 0) {
            alert("Selecione pelo menos 1 contato");
            return;
        }

        setCreating(true);
        try {
            const response = await fetch("/api/campaigns", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    ...newCampaign,
                    selectedPhones, // Send selected phones
                }),
            });

            const data = await response.json();
            if (data.success) {
                setNewCampaign({ name: "", originalMessage: "", targetSegments: ["HOT", "WARM"], scheduledAt: "" });
                setSelectedTemplate("");
                setSelectedPhones([]);
                setPreviewContacts([]);
                setShowContactsStep(false);
                setShowForm(false);
                fetchData();
            } else {
                alert(data.error || "Erro ao criar campanha");
            }
        } catch (error) {
            console.error("Erro ao criar campanha:", error);
        } finally {
            setCreating(false);
        }
    };

    const handleStartCampaign = async (id: string) => {
        if (!confirm("Iniciar disparo desta campanha?")) return;

        try {
            const response = await fetch(`/api/campaigns/${id}/start`, { method: "POST" });
            const data = await response.json();
            if (data.success) {
                fetchData();
            } else {
                alert(data.error || "Erro ao iniciar");
            }
        } catch (error) {
            console.error("Erro:", error);
        }
    };

    const handlePauseCampaign = async (id: string) => {
        try {
            await fetch(`/api/campaigns/${id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ status: "PAUSED" }),
            });
            fetchData();
        } catch (error) {
            console.error("Erro:", error);
        }
    };

    const handleDeleteCampaign = async (id: string) => {
        if (!confirm("Excluir esta campanha?")) return;

        try {
            await fetch(`/api/campaigns/${id}`, { method: "DELETE" });
            fetchData();
        } catch (error) {
            console.error("Erro:", error);
        }
    };

    const toggleSegment = (segmentId: string) => {
        if (newCampaign.targetSegments.includes(segmentId)) {
            setNewCampaign({
                ...newCampaign,
                targetSegments: newCampaign.targetSegments.filter(s => s !== segmentId),
            });
        } else {
            setNewCampaign({
                ...newCampaign,
                targetSegments: [...newCampaign.targetSegments, segmentId],
            });
        }
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
                    <Send style={{ width: 28, height: 28, marginRight: 8, color: "#a78bfa" }} />
                    Campanhas de Disparo
                </h1>
                <p className="dash-page-subtitle">
                    Envie mensagens em massa com proteção anti-ban
                </p>
            </div>

            {/* Anti-ban Warning */}
            <div style={{
                padding: "1rem",
                background: "rgba(234, 179, 8, 0.1)",
                border: "1px solid rgba(234, 179, 8, 0.3)",
                borderRadius: "12px",
                marginBottom: "1.5rem",
            }}>
                <p style={{ color: "#eab308", margin: 0, fontSize: "0.875rem" }}>
                    🛡️ <strong>Proteção Anti-Ban Ativa:</strong> Delay inteligente, variações de mensagem por IA, e envio apenas para contatos seguros.
                </p>
            </div>

            {/* Create Button */}
            <div style={{ marginBottom: "1.5rem" }}>
                {!showForm ? (
                    <button onClick={() => setShowForm(true)} className="dash-btn primary">
                        <Plus style={{ width: 18, height: 18 }} />
                        Nova Campanha
                    </button>
                ) : (
                    <div className="dash-card" style={{ padding: "1.5rem" }}>
                        <h3 style={{ color: "white", marginBottom: "1rem" }}>Nova Campanha</h3>

                        <div style={{ marginBottom: "1rem" }}>
                            <label className="dash-label">Nome da Campanha *</label>
                            <input
                                type="text"
                                className="dash-input"
                                placeholder="Ex: Promoção de Natal"
                                value={newCampaign.name}
                                onChange={(e) => setNewCampaign({ ...newCampaign, name: e.target.value })}
                            />
                        </div>

                        {/* Template Selector - NEW */}
                        {templates.length > 0 && (
                            <div style={{ marginBottom: "1rem" }}>
                                <label className="dash-label">
                                    <FileText style={{ width: 14, height: 14, display: "inline", marginRight: 4 }} />
                                    Usar Template (opcional)
                                </label>
                                <select
                                    className="dash-input"
                                    value={selectedTemplate}
                                    onChange={(e) => handleTemplateSelect(e.target.value)}
                                >
                                    <option value="">-- Escrever do zero --</option>
                                    {templates.map(t => (
                                        <option key={t.id} value={t.id}>
                                            {t.name} ({t.category})
                                        </option>
                                    ))}
                                </select>
                                {selectedTemplate && (
                                    <p style={{ color: "#22c55e", fontSize: "0.75rem", marginTop: "0.5rem" }}>
                                        ✓ Template aplicado! Você pode editar a mensagem abaixo.
                                    </p>
                                )}
                            </div>
                        )}

                        <div style={{ marginBottom: "1rem" }}>
                            <label className="dash-label">Mensagem Principal *</label>
                            <textarea
                                className="dash-input"
                                placeholder="Digite sua mensagem... A IA vai criar variações automaticamente!"
                                rows={4}
                                value={newCampaign.originalMessage}
                                onChange={(e) => setNewCampaign({ ...newCampaign, originalMessage: e.target.value })}
                                style={{ resize: "vertical" }}
                            />
                            <div style={{ display: "flex", justifyContent: "space-between", marginTop: "0.5rem" }}>
                                <p style={{ color: "#64748b", fontSize: "0.75rem", margin: 0 }}>
                                    💡 A IA vai gerar 10+ variações para evitar detecção de spam
                                </p>
                                <p style={{ color: "#64748b", fontSize: "0.75rem", margin: 0 }}>
                                    Use: {"{nome}"}, {"{produto}"}, {"{valor}"}
                                </p>
                            </div>
                        </div>

                        <div style={{ marginBottom: "1.5rem" }}>
                            <label className="dash-label">Segmentos de Destinatários</label>
                            <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem", marginTop: "0.5rem" }}>
                                {SEGMENTS.map(seg => (
                                    <button
                                        key={seg.id}
                                        onClick={() => toggleSegment(seg.id)}
                                        style={{
                                            padding: "0.5rem 1rem",
                                            borderRadius: "999px",
                                            border: newCampaign.targetSegments.includes(seg.id)
                                                ? "2px solid #a78bfa"
                                                : "2px solid rgba(255,255,255,0.1)",
                                            background: newCampaign.targetSegments.includes(seg.id)
                                                ? "rgba(167, 139, 250, 0.1)"
                                                : "transparent",
                                            color: newCampaign.targetSegments.includes(seg.id) ? "#a78bfa" : "#94a3b8",
                                            cursor: "pointer",
                                            fontSize: "0.875rem",
                                        }}
                                        title={seg.desc}
                                    >
                                        {seg.label}
                                    </button>
                                ))}
                            </div>
                            <button
                                type="button"
                                onClick={fetchPreviewContacts}
                                disabled={loadingContacts || newCampaign.targetSegments.length === 0}
                                style={{
                                    marginTop: "0.75rem",
                                    padding: "0.5rem 1rem",
                                    background: "rgba(59, 130, 246, 0.1)",
                                    border: "1px solid rgba(59, 130, 246, 0.3)",
                                    borderRadius: 6,
                                    color: "#3b82f6",
                                    cursor: "pointer",
                                    fontSize: "0.85rem",
                                    display: "flex",
                                    alignItems: "center",
                                    gap: "0.5rem",
                                }}
                            >
                                {loadingContacts ? <Loader2 size={14} className="animate-spin" /> : <Users size={14} />}
                                {loadingContacts ? "Carregando..." : "Ver Contatos dos Segmentos"}
                            </button>
                        </div>

                        {/* Contact Selection */}
                        {showContactsStep && (
                            <div style={{
                                marginBottom: "1.5rem",
                                padding: "1rem",
                                background: "rgba(34, 197, 94, 0.05)",
                                border: "1px solid rgba(34, 197, 94, 0.2)",
                                borderRadius: 8,
                            }}>
                                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.75rem" }}>
                                    <label className="dash-label" style={{ margin: 0, display: "flex", alignItems: "center", gap: "0.5rem" }}>
                                        <CheckCircle2 size={14} style={{ color: "#22c55e" }} />
                                        Selecionar Contatos ({selectedPhones.length}/{previewContacts.length})
                                    </label>
                                    <button
                                        type="button"
                                        onClick={toggleAllPhones}
                                        style={{
                                            padding: "0.25rem 0.75rem",
                                            background: "rgba(255,255,255,0.05)",
                                            border: "1px solid rgba(255,255,255,0.1)",
                                            borderRadius: 4,
                                            color: "#94a3b8",
                                            cursor: "pointer",
                                            fontSize: "0.75rem",
                                        }}
                                    >
                                        {selectedPhones.length === previewContacts.length ? "Desmarcar Todos" : "Selecionar Todos"}
                                    </button>
                                </div>
                                <div style={{
                                    maxHeight: 200,
                                    overflowY: "auto",
                                    display: "flex",
                                    flexDirection: "column",
                                    gap: "0.25rem",
                                }}>
                                    {previewContacts.map(contact => (
                                        <label
                                            key={contact.phone}
                                            style={{
                                                display: "flex",
                                                alignItems: "center",
                                                gap: "0.5rem",
                                                padding: "0.5rem",
                                                background: selectedPhones.includes(contact.phone) ? "rgba(34, 197, 94, 0.1)" : "transparent",
                                                borderRadius: 4,
                                                cursor: "pointer",
                                            }}
                                        >
                                            <input
                                                type="checkbox"
                                                checked={selectedPhones.includes(contact.phone)}
                                                onChange={() => togglePhone(contact.phone)}
                                            />
                                            <User size={14} style={{ color: "#64748b" }} />
                                            <span style={{ color: "#e2e8f0", fontSize: "0.85rem" }}>
                                                {contact.name || contact.phone}
                                            </span>
                                            <span style={{
                                                marginLeft: "auto",
                                                fontSize: "0.7rem",
                                                padding: "2px 6px",
                                                borderRadius: 4,
                                                background: contact.segment === "HOT" ? "rgba(239, 68, 68, 0.2)" :
                                                    contact.segment === "WARM" ? "rgba(234, 179, 8, 0.2)" :
                                                        "rgba(148, 163, 184, 0.2)",
                                                color: contact.segment === "HOT" ? "#fca5a5" :
                                                    contact.segment === "WARM" ? "#fde047" : "#94a3b8",
                                            }}>
                                                {contact.segment}
                                            </span>
                                        </label>
                                    ))}
                                    {previewContacts.length === 0 && (
                                        <p style={{ color: "#64748b", fontSize: "0.85rem", textAlign: "center", padding: "1rem" }}>
                                            Nenhum contato encontrado nos segmentos selecionados
                                        </p>
                                    )}
                                </div>
                                {selectedPhones.length > 100 && (
                                    <p style={{ color: "#f87171", fontSize: "0.75rem", marginTop: "0.5rem" }}>
                                        ⚠️ Máximo 100 contatos por campanha (anti-ban)
                                    </p>
                                )}
                            </div>
                        )}

                        {/* Agendamento */}
                        <div style={{ marginBottom: "1.5rem" }}>
                            <label className="dash-label" style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                                <Calendar size={14} />
                                Agendamento
                            </label>
                            <div style={{ display: "flex", gap: "1rem", alignItems: "center", marginTop: "0.5rem" }}>
                                <label style={{ display: "flex", alignItems: "center", gap: "0.5rem", cursor: "pointer" }}>
                                    <input
                                        type="radio"
                                        name="schedule"
                                        checked={!newCampaign.scheduledAt}
                                        onChange={() => setNewCampaign({ ...newCampaign, scheduledAt: "" })}
                                    />
                                    <span style={{ color: "#94a3b8" }}>Enviar agora</span>
                                </label>
                                <label style={{ display: "flex", alignItems: "center", gap: "0.5rem", cursor: "pointer" }}>
                                    <input
                                        type="radio"
                                        name="schedule"
                                        checked={!!newCampaign.scheduledAt}
                                        onChange={() => setNewCampaign({ ...newCampaign, scheduledAt: new Date().toISOString().slice(0, 16) })}
                                    />
                                    <span style={{ color: "#94a3b8" }}>Agendar para</span>
                                </label>
                                {newCampaign.scheduledAt && (
                                    <input
                                        type="datetime-local"
                                        className="dash-input"
                                        value={newCampaign.scheduledAt}
                                        onChange={(e) => setNewCampaign({ ...newCampaign, scheduledAt: e.target.value })}
                                        style={{ width: "auto" }}
                                    />
                                )}
                            </div>
                        </div>

                        <div style={{ display: "flex", gap: "0.75rem" }}>
                            <button
                                onClick={handleCreateCampaign}
                                className="dash-btn primary"
                                disabled={creating || !newCampaign.name.trim() || !newCampaign.originalMessage.trim()}
                            >
                                {creating ? <Loader2 className="animate-spin" style={{ width: 16, height: 16 }} /> : <Plus style={{ width: 16, height: 16 }} />}
                                Criar Campanha
                            </button>
                            <button onClick={() => { setShowForm(false); setSelectedTemplate(""); }} className="dash-btn secondary">
                                Cancelar
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {/* Campaigns List */}
            {campaigns.length === 0 ? (
                <div className="dash-card" style={{ textAlign: "center", padding: "3rem" }}>
                    <Send style={{ width: 48, height: 48, color: "#475569", margin: "0 auto 1rem" }} />
                    <h3 style={{ color: "white", marginBottom: "0.5rem" }}>Nenhuma campanha</h3>
                    <p style={{ color: "#94a3b8" }}>Crie sua primeira campanha de disparo</p>
                </div>
            ) : (
                <div style={{ display: "grid", gap: "1rem" }}>
                    {campaigns.map(campaign => {
                        const statusConfig = STATUS_CONFIG[campaign.status];
                        return (
                            <div
                                key={campaign.id}
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
                                            <h3 style={{ color: "white", margin: 0 }}>{campaign.name}</h3>
                                            <span style={{
                                                padding: "0.25rem 0.75rem",
                                                borderRadius: "999px",
                                                fontSize: "0.75rem",
                                                fontWeight: 500,
                                                background: statusConfig.bg,
                                                color: statusConfig.color,
                                            }}>
                                                {statusConfig.label}
                                            </span>
                                        </div>

                                        <p style={{ color: "#94a3b8", fontSize: "0.875rem", marginBottom: "1rem" }}>
                                            {campaign.originalMessage.substring(0, 100)}{campaign.originalMessage.length > 100 ? "..." : ""}
                                        </p>

                                        {/* Stats */}
                                        <div style={{ display: "flex", gap: "1.5rem", flexWrap: "wrap" }}>
                                            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                                                <Users style={{ width: 16, height: 16, color: "#64748b" }} />
                                                <span style={{ color: "#94a3b8", fontSize: "0.875rem" }}>
                                                    {campaign.totalRecipients} destinatários
                                                </span>
                                            </div>
                                            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                                                <CheckCircle style={{ width: 16, height: 16, color: "#22c55e" }} />
                                                <span style={{ color: "#94a3b8", fontSize: "0.875rem" }}>
                                                    {campaign.sentCount} enviadas
                                                </span>
                                            </div>
                                            {campaign.deliveryRate !== undefined && campaign.deliveryRate > 0 && (
                                                <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                                                    <BarChart3 style={{ width: 16, height: 16, color: "#3b82f6" }} />
                                                    <span style={{ color: "#94a3b8", fontSize: "0.875rem" }}>
                                                        {campaign.deliveryRate}% entregue
                                                    </span>
                                                </div>
                                            )}
                                            {campaign.replyRate !== undefined && campaign.replyRate > 0 && (
                                                <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                                                    <MessageSquare style={{ width: 16, height: 16, color: "#a78bfa" }} />
                                                    <span style={{ color: "#94a3b8", fontSize: "0.875rem" }}>
                                                        {campaign.replyRate}% responderam
                                                    </span>
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    {/* Actions */}
                                    <div style={{ display: "flex", gap: "0.5rem" }}>
                                        {campaign.status === "DRAFT" && (
                                            <button
                                                onClick={() => handleStartCampaign(campaign.id)}
                                                className="dash-btn primary"
                                                style={{ padding: "0.5rem" }}
                                                title="Iniciar"
                                            >
                                                <Play style={{ width: 16, height: 16 }} />
                                            </button>
                                        )}
                                        {campaign.status === "RUNNING" && (
                                            <button
                                                onClick={() => handlePauseCampaign(campaign.id)}
                                                className="dash-btn secondary"
                                                style={{ padding: "0.5rem", color: "#eab308" }}
                                                title="Pausar"
                                            >
                                                <Pause style={{ width: 16, height: 16 }} />
                                            </button>
                                        )}
                                        {campaign.status === "PAUSED" && (
                                            <button
                                                onClick={() => handleStartCampaign(campaign.id)}
                                                className="dash-btn primary"
                                                style={{ padding: "0.5rem" }}
                                                title="Retomar"
                                            >
                                                <Play style={{ width: 16, height: 16 }} />
                                            </button>
                                        )}
                                        {campaign.status !== "RUNNING" && (
                                            <button
                                                onClick={() => handleDeleteCampaign(campaign.id)}
                                                className="dash-btn secondary"
                                                style={{ padding: "0.5rem", color: "#f87171" }}
                                                title="Excluir"
                                            >
                                                <Trash2 style={{ width: 16, height: 16 }} />
                                            </button>
                                        )}
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}

