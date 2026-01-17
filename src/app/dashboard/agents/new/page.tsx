"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
    Bot,
    ArrowLeft,
    Save,
    Sparkles,
    MessageSquare,
    Users,
    ShoppingCart,
    RefreshCw,
    Lock,
    Crown,
    X,
    Plus,
    Lightbulb,
    CheckCircle2,
    Building2,
    Zap
} from "lucide-react";
import ExtraPurchaseModal from "@/components/ExtraPurchaseModal";

// Interfaces
interface CompanyInfo {
    niche: string | null;
    name: string;
}

// Templates de personalidade para Loja de Roupas - NozesIA
const personalityTemplates = [
    {
        name: "Vendedora Fashionista",
        icon: "👗",
        description: "Simpática, antenada em moda e estilo",
        value: "Você é uma vendedora simpática e fashionista de uma loja de roupas. Adora moda e ajuda os clientes a escolher peças que combinam com seu estilo. Use linguagem leve e acolhedora, sugira combinações de looks, e demonstre entusiasmo com as peças. Pergunte sobre o estilo do cliente, ocasião de uso e preferências de cores. Seja persuasiva sem ser insistente."
    },
    {
        name: "Consultora de Estilo",
        icon: "✨",
        description: "Personal stylist que entende de tendências",
        value: "Você é uma consultora de estilo pessoal. Seu objetivo é entender o cliente e sugerir peças que valorizem seu corpo e personalidade. Pergunte sobre tipo de corpo, cores preferidas, ocasião de uso. Faça recomendações sob medida, explique combinações, e ajude o cliente a montar looks completos. Seja sofisticada mas acessível."
    },
    {
        name: "Atendente Ágil",
        icon: "⚡",
        description: "Respostas rápidas sobre preços e tamanhos",
        value: "Você é uma atendente objetiva e eficiente. Responda rapidamente sobre: preços, tamanhos disponíveis, cores, prazos de entrega. Vá direto ao ponto, mas sempre de forma educada. Use a função buscarProduto() para verificar informações. Ajude o cliente a finalizar a compra rapidamente, confirmando tamanho, cor e forma de entrega."
    },
];


export default function NewAgentPage() {
    const router = useRouter();
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const [upgradeModal, setUpgradeModal] = useState<{ open: boolean; message: string }>({ open: false, message: "" });
    const [extraModal, setExtraModal] = useState(false);
    const [company, setCompany] = useState<CompanyInfo | null>(null);
    const [selectedTemplate, setSelectedTemplate] = useState<number | null>(null);

    const [formData, setFormData] = useState({
        name: "",
        description: "",
        personality: "",
        tone: "casual",
        canSell: true, // Loja de roupas sempre pode vender
        canNegotiate: false,
        transferToHuman: true,
        isDefault: false,
    });

    // Buscar informações da empresa
    useEffect(() => {
        fetchCompanyInfo();
    }, []);

    const fetchCompanyInfo = async () => {
        try {
            const res = await fetch("/api/company");
            const data = await res.json();
            if (data.success && data.data) {
                setCompany(data.data);
            }
        } catch (err) {
            console.error("Error fetching company info:", err);
        }
    };

    const handleSelectTemplate = (index: number) => {
        const template = personalityTemplates[index];
        if (template) {
            setSelectedTemplate(index);
            setFormData(prev => ({ ...prev, personality: template.value }));
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError("");

        try {
            const response = await fetch("/api/agents", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(formData),
            });

            const data = await response.json();

            if (data.success) {
                router.push(`/dashboard/agents/${data.data.id}`);
            } else if (response.status === 403) {
                setUpgradeModal({
                    open: true,
                    message: data.error || "Limite de agentes atingido"
                });
            } else {
                setError(data.error || "Erro ao criar agente");
            }
        } catch {
            setError("Erro de conexão");
        } finally {
            setLoading(false);
        }
    };


    return (
        <div className="dash-fade-in" style={{ maxWidth: 900 }}>
            {/* Header */}
            <div className="dash-page-header" style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
                <Link href="/dashboard/agents" className="dash-btn secondary sm">
                    <ArrowLeft />
                </Link>
                <div style={{ flex: 1 }}>
                    <h1 className="dash-page-title">Criar Agente de IA</h1>
                    <p className="dash-page-subtitle">Configure um assistente virtual para seu negócio</p>
                </div>
            </div>

            {/* Banner NozesIA - Loja de Roupas */}
            {company && (
                <div style={{
                    padding: '1rem 1.25rem',
                    background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.1), rgba(16, 185, 129, 0.05))',
                    border: '1px solid rgba(16, 185, 129, 0.2)',
                    borderRadius: '12px',
                    marginBottom: '1.5rem',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '1rem'
                }}>
                    <div style={{
                        width: 48,
                        height: 48,
                        borderRadius: '12px',
                        background: 'rgba(16, 185, 129, 0.2)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '1.5rem'
                    }}>
                        👗
                    </div>
                    <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
                            <Zap style={{ width: 16, height: 16, color: '#10b981' }} />
                            <span style={{ color: '#10b981', fontWeight: 600, fontSize: '0.875rem' }}>
                                NozesIA - Loja de Roupas
                            </span>
                        </div>
                        <p style={{ color: '#d1d5db', margin: 0, fontSize: '0.9rem' }}>
                            Templates otimizados para vendas de moda e roupas!
                        </p>
                    </div>
                    <CheckCircle2 style={{ width: 24, height: 24, color: '#10b981' }} />
                </div>
            )}

            {/* Error */}
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

            <form onSubmit={handleSubmit} className="dash-form">
                {/* Basic Info */}
                <div className="dash-card">
                    <div className="dash-card-header">
                        <h3 className="dash-card-title">
                            <Building2 style={{ color: '#22d3ee' }} />
                            Informações Básicas
                        </h3>
                    </div>
                    <div className="dash-card-content">
                        <div className="dash-field">
                            <label className="dash-label">Nome do Agente *</label>
                            <input
                                type="text"
                                className="dash-input"
                                placeholder="Ex: Vendedora Virtual, Consultora de Moda"
                                value={formData.name}
                                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                required
                            />
                            <p style={{ color: '#64748b', fontSize: '0.75rem', marginTop: '0.5rem' }}>
                                💡 Dica: Use um nome que represente a função do agente, como &quot;Atendente&quot; ou &quot;Consultor&quot;
                            </p>
                        </div>
                        <div className="dash-field" style={{ marginTop: '1rem' }}>
                            <label className="dash-label">Descrição (opcional)</label>
                            <input
                                type="text"
                                className="dash-input"
                                placeholder="Ex: Responsável pelo atendimento inicial e agendamentos"
                                value={formData.description}
                                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                            />
                        </div>
                        <div style={{ marginTop: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <input
                                type="checkbox"
                                id="isDefault"
                                checked={formData.isDefault}
                                onChange={(e) => setFormData({ ...formData, isDefault: e.target.checked })}
                                style={{ width: 18, height: 18, accentColor: '#10b981' }}
                            />
                            <label htmlFor="isDefault" style={{ color: '#d1d5db', cursor: 'pointer' }}>
                                Definir como agente padrão (receberá todas as conversas)
                            </label>
                        </div>
                    </div>
                </div>

                {/* Personality - IMPROVED with niche templates */}
                <div className="dash-card">
                    <div className="dash-card-header">
                        <h3 className="dash-card-title">
                            <Sparkles style={{ color: '#a855f7' }} />
                            Personalidade do Agente
                        </h3>
                    </div>
                    <div className="dash-card-content">
                        {/* Personality Templates */}
                        <div className="dash-field">
                            <label className="dash-label" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                <Lightbulb style={{ width: 16, height: 16, color: '#fbbf24' }} />
                                Templates para Loja de Roupas
                            </label>
                            <div className="dash-templates-grid" style={{ marginTop: '0.75rem' }}>
                                {personalityTemplates.map((template: { name: string; icon: string; description: string; value: string }, idx: number) => (
                                    <button
                                        key={idx}
                                        type="button"
                                        onClick={() => handleSelectTemplate(idx)}
                                        style={{
                                            display: 'flex',
                                            flexDirection: 'column',
                                            alignItems: 'flex-start',
                                            padding: '1rem',
                                            borderRadius: '12px',
                                            border: selectedTemplate === idx
                                                ? '2px solid #a855f7'
                                                : '1px solid rgba(255,255,255,0.08)',
                                            background: selectedTemplate === idx
                                                ? 'rgba(168, 85, 247, 0.15)'
                                                : 'rgba(255,255,255,0.03)',
                                            cursor: 'pointer',
                                            transition: 'all 0.2s',
                                            textAlign: 'left',
                                        }}
                                    >
                                        <div style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '0.5rem',
                                            marginBottom: '0.5rem',
                                            width: '100%'
                                        }}>
                                            <span style={{ fontSize: '1.5rem' }}>{template.icon}</span>
                                            <span style={{
                                                fontWeight: 600,
                                                color: selectedTemplate === idx ? '#a855f7' : 'white',
                                                fontSize: '0.9rem'
                                            }}>
                                                {template.name}
                                            </span>
                                            {selectedTemplate === idx && (
                                                <CheckCircle2 style={{
                                                    width: 16,
                                                    height: 16,
                                                    color: '#a855f7',
                                                    marginLeft: 'auto'
                                                }} />
                                            )}
                                        </div>
                                        <p style={{
                                            color: '#94a3b8',
                                            fontSize: '0.75rem',
                                            margin: 0,
                                            lineHeight: 1.4
                                        }}>
                                            {template.description}
                                        </p>
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div className="dash-field" style={{ marginTop: '1.5rem' }}>
                            <label className="dash-label">Prompt de Personalidade *</label>
                            <textarea
                                value={formData.personality}
                                onChange={(e) => {
                                    setFormData({ ...formData, personality: e.target.value });
                                    setSelectedTemplate(null);
                                }}
                                placeholder="Selecione um template acima ou escreva como o agente deve se comportar..."
                                className="dash-input dash-textarea"
                                rows={5}
                                required
                                style={{ minHeight: '120px' }}
                            />
                            <p style={{ color: '#64748b', fontSize: '0.75rem', marginTop: '0.5rem' }}>
                                Este texto define como a IA vai se comportar nas conversas. Seja específico sobre tom, estilo e abordagem.
                            </p>
                        </div>

                        <div className="dash-field" style={{ marginTop: '1rem' }}>
                            <label className="dash-label">Tom de Voz</label>
                            <select
                                value={formData.tone}
                                onChange={(e) => setFormData({ ...formData, tone: e.target.value })}
                                className="dash-input dash-select"
                            >
                                <option value="casual">Casual (Oi! Beleza!)</option>
                                <option value="street">Street (Fala mano! E aí!)</option>
                                <option value="friendly">Amigável (Oii, querida!)</option>
                                <option value="formal">Formal (Bom dia, como posso ajudar?)</option>
                            </select>
                        </div>
                    </div>
                </div>

                {/* Capabilities */}
                <div className="dash-card">
                    <div className="dash-card-header">
                        <h3 className="dash-card-title">
                            <MessageSquare style={{ color: '#22d3ee' }} />
                            Capacidades
                        </h3>
                        <span style={{ color: '#64748b', fontSize: '0.8rem' }}>
                            Configurado para Loja de Roupas
                        </span>
                    </div>
                    <div className="dash-card-content">
                        <div className="dash-capabilities-grid">
                            {[
                                { key: 'canSell', icon: ShoppingCart, color: '#34d399', title: 'Pode Vender', desc: 'Oferecer produtos e fechar vendas', hint: 'Essencial para loja de roupas' },
                                { key: 'canNegotiate', icon: Users, color: '#a855f7', title: 'Pode Negociar', desc: 'Oferecer descontos e condições', hint: 'Para flexibilidade comercial' },
                                { key: 'transferToHuman', icon: Users, color: '#fbbf24', title: 'Transferir para Humano', desc: 'Encaminhar quando necessário', hint: 'Recomendado para casos complexos' },
                            ].map((cap) => (
                                <label key={cap.key} style={{
                                    display: 'flex',
                                    alignItems: 'flex-start',
                                    gap: '0.75rem',
                                    padding: '1rem',
                                    borderRadius: '12px',
                                    border: formData[cap.key as keyof typeof formData]
                                        ? `1px solid ${cap.color}40`
                                        : '1px solid rgba(255,255,255,0.08)',
                                    background: formData[cap.key as keyof typeof formData]
                                        ? `${cap.color}10`
                                        : 'transparent',
                                    cursor: 'pointer',
                                    transition: 'all 0.2s'
                                }}>
                                    <input
                                        type="checkbox"
                                        checked={formData[cap.key as keyof typeof formData] as boolean}
                                        onChange={(e) => setFormData({ ...formData, [cap.key]: e.target.checked })}
                                        style={{ width: 20, height: 20, accentColor: cap.color, marginTop: 2 }}
                                    />
                                    <cap.icon style={{ width: 20, height: 20, color: cap.color, marginTop: 2 }} />
                                    <div>
                                        <p style={{ fontWeight: 500, color: 'white', margin: 0 }}>{cap.title}</p>
                                        <p style={{ fontSize: '0.75rem', color: '#94a3b8', margin: '0.25rem 0' }}>{cap.desc}</p>
                                        <p style={{ fontSize: '0.7rem', color: '#64748b', margin: 0, fontStyle: 'italic' }}>{cap.hint}</p>
                                    </div>
                                </label>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Next Steps Hint */}
                <div style={{
                    padding: '1rem',
                    background: 'rgba(168, 85, 247, 0.1)',
                    border: '1px solid rgba(168, 85, 247, 0.2)',
                    borderRadius: '12px',
                    marginBottom: '1.5rem'
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                        <Lightbulb style={{ width: 18, height: 18, color: '#a855f7' }} />
                        <span style={{ color: '#a855f7', fontWeight: 600 }}>Próximos Passos</span>
                    </div>
                    <p style={{ color: '#d1d5db', margin: 0, fontSize: '0.875rem' }}>
                        Após criar o agente, você será levado à página de <strong>Treinamento</strong> onde poderá adicionar
                        FAQs, informações sobre produtos e documentos para deixar seu agente ainda mais inteligente.
                    </p>
                </div>

                {/* Actions */}
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
                    <Link href="/dashboard/agents" className="dash-btn secondary">
                        Cancelar
                    </Link>
                    <button type="submit" className="dash-btn primary" disabled={loading}>
                        {loading ? (
                            <RefreshCw style={{ animation: 'spin 1s linear infinite' }} />
                        ) : (
                            <Save />
                        )}
                        Criar Agente
                    </button>
                </div>
            </form>

            {/* Upgrade Modal */}
            {upgradeModal.open && (
                <div
                    className="dash-modal-overlay"
                    onClick={() => setUpgradeModal({ open: false, message: "" })}
                >
                    <div
                        className="dash-modal"
                        style={{ maxWidth: 480 }}
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="dash-modal-header">
                            <h3 className="dash-modal-title" style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                <Lock style={{ width: 20, height: 20, color: "#f59e0b" }} />
                                Limite Atingido
                            </h3>
                            <button
                                className="dash-modal-close"
                                onClick={() => setUpgradeModal({ open: false, message: "" })}
                            >
                                <X />
                            </button>
                        </div>
                        <div className="dash-modal-body">
                            <div style={{ textAlign: "center", marginBottom: 24 }}>
                                <div style={{
                                    width: 64,
                                    height: 64,
                                    borderRadius: "50%",
                                    background: "rgba(245, 158, 11, 0.15)",
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    margin: "0 auto 16px"
                                }}>
                                    <Bot style={{ width: 28, height: 28, color: "#f59e0b" }} />
                                </div>
                                <p style={{ color: "#94a3b8", fontSize: 14, margin: 0 }}>
                                    {upgradeModal.message}
                                </p>
                            </div>

                            <div style={{
                                background: "rgba(16, 185, 129, 0.1)",
                                border: "1px solid rgba(16, 185, 129, 0.2)",
                                borderRadius: 12,
                                padding: 16,
                                marginBottom: 16
                            }}>
                                <p style={{ color: "#34d399", fontSize: 14, fontWeight: 600, margin: "0 0 8px" }}>
                                    💡 O que você pode fazer:
                                </p>
                                <ul style={{ color: "#94a3b8", fontSize: 13, margin: 0, paddingLeft: 20 }}>
                                    <li><strong>Fazer upgrade</strong> para um plano com mais agentes</li>
                                    <li><strong>Adicionar um agente extra</strong> por R$29,99/mês</li>
                                    <li>Excluir um agente existente para liberar espaço</li>
                                </ul>
                            </div>
                        </div>
                        <div className="dash-modal-footer" style={{ justifyContent: "center", gap: 8, flexWrap: "wrap" }}>
                            <button
                                className="dash-btn secondary"
                                onClick={() => setUpgradeModal({ open: false, message: "" })}
                            >
                                Entendi
                            </button>
                            <button
                                className="dash-btn primary"
                                style={{ background: "linear-gradient(135deg, #a855f7, #7c3aed)" }}
                                onClick={() => {
                                    setUpgradeModal({ open: false, message: "" });
                                    setExtraModal(true);
                                }}
                            >
                                <Plus style={{ width: 16, height: 16 }} />
                                Adicionar Extra
                            </button>
                            <button
                                className="dash-btn primary"
                                onClick={() => router.push("/dashboard/billing")}
                            >
                                <Crown style={{ width: 16, height: 16 }} />
                                Ver Planos
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Extra Purchase Modal */}
            <ExtraPurchaseModal
                isOpen={extraModal}
                type="agent"
                onClose={() => setExtraModal(false)}
            />
        </div>
    );
}
