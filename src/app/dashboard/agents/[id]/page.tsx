"use client";

import { useState, useEffect, use, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
    Bot,
    ArrowLeft,
    Plus,
    Trash2,
    FileText,
    HelpCircle,
    Package,
    BookOpen,
    MessageSquare,
    FileCode,
    Save,
    RefreshCw,
    Mic,
    Upload,
    Play,
    Copy,
} from "lucide-react";
import { AgentPlayground } from "@/components/agent-playground";

interface Agent {
    id: string;
    name: string;
    description: string | null;
    personality: string;
    tone: string | null;
    isActive: boolean;
    isDefault: boolean;
    canSell: boolean;
    canNegotiate: boolean;
    canSchedule: boolean;
    transferToHuman: boolean;
    voiceEnabled: boolean;
    voiceId: string;
    // Multi-agent routing
    triggerKeywords: string[];
    priority: number;
    trainingData: TrainingData[];
    // Company info for niche detection
    company?: {
        niche: string | null;
        name: string;
    };
    _count: {
        conversations: number;
    };
}

interface TrainingData {
    id: string;
    type: string;
    title: string;
    content: string;
    createdAt: string;
}

const trainingTypes = [
    { value: "QA", label: "Pergunta e Resposta", icon: HelpCircle, color: "#22d3ee" },
    { value: "FAQ", label: "FAQ", icon: BookOpen, color: "#a855f7" },
    { value: "PRODUCT", label: "Produto", icon: Package, color: "#34d399" },
    { value: "DOCUMENT", label: "Documento", icon: FileText, color: "#fbbf24" },
    { value: "SCRIPT", label: "Script", icon: MessageSquare, color: "#ec4899" },
    { value: "POLICY", label: "Política", icon: FileCode, color: "#f97316" },
];

// Templates FAQ para Loja de Roupas - NozesIA
const faqTemplates = [
    { title: "Horário de Funcionamento", content: "Loja física: Segunda a Sexta das 9h às 19h, Sábados das 9h às 14h. Loja online: 24 horas! Pedidos feitos após as 17h serão processados no próximo dia útil.", category: "Informações" },
    { title: "Prazo de Entrega", content: "Enviamos para todo o Brasil! Prazo estimado: Capitais 3-5 dias úteis | Interior 5-8 dias úteis | Regiões remotas 8-12 dias úteis. Após postagem, você receberá o código de rastreio.", category: "Envio" },
    { title: "Frete e Entrega", content: "Calculamos o frete pelo CEP. FRETE GRÁTIS para compras acima de R$199! Opções de envio: PAC (mais econômico), SEDEX (mais rápido).", category: "Envio" },
    { title: "Política de Troca e Devolução", content: "Você tem até 7 dias para desistir da compra (direito de arrependimento) e 30 dias para trocar por defeito ou tamanho. O produto deve estar com etiqueta, sem uso e na embalagem original. Troca grátis na primeira vez!", category: "Políticas" },
    { title: "Tabela de Medidas", content: "Consulte nossa tabela de medidas antes de comprar! Está disponível na página de cada produto. Em caso de dúvida, envie suas medidas que ajudamos a escolher o tamanho ideal.", category: "Produtos" },
    { title: "Formas de Pagamento", content: "Aceitamos: PIX (5% desconto), cartão de crédito (até 12x sem juros), cartão de débito e boleto. Para retirada na loja, também aceitamos dinheiro.", category: "Pagamento" },
    { title: "Rastreamento do Pedido", content: "Após a postagem, enviamos o código de rastreio por WhatsApp e e-mail. Você pode consultar o status diretamente no site dos Correios ou me enviar o número do pedido que verifico para você!", category: "Envio" },
    { title: "Retirada na Loja", content: "Você pode optar por retirar seu pedido na loja sem pagar frete! Após a confirmação do pagamento, seu pedido estará disponível em até 24h. Traga um documento com foto para retirar.", category: "Envio" },
    { title: "Tamanhos Disponíveis", content: "Trabalhamos com tamanhos P, M, G e GG na maioria das peças. Algumas peças têm numeração (36 a 46). Confira a disponibilidade na página do produto ou pergunte diretamente!", category: "Produtos" },
    { title: "Cuidados com as Peças", content: "Para manter suas roupas sempre bonitas: lave do avesso, não use alvejante, seque à sombra. Peças delicadas devem ser lavadas à mão. Siga as instruções na etiqueta de cada peça.", category: "Produtos" },
    // Novos templates adicionados
    { title: "Como Medir seu Tamanho", content: "Para não errar no tamanho: 1) Busto - meça a parte mais larga do peito. 2) Cintura - meça a parte mais fina. 3) Quadril - meça a parte mais larga. Use uma fita métrica sem apertar. Compare com nossa tabela de medidas!", category: "Produtos" },
    { title: "Materiais e Tecidos", content: "Trabalhamos com diversos materiais: Algodão (confortável e respirável), Viscose (leve e fluído), Jeans (resistente), Malha (elástico), Linho (fresco). Cada peça tem a composição descrita na etiqueta.", category: "Produtos" },
    { title: "Promoções e Descontos", content: "Fique de olho nas nossas promoções! PIX tem 5% de desconto. Primeira compra pode ter desconto especial. Siga nosso Instagram para promoções exclusivas. Pergunte se tem cupom disponível!", category: "Pagamento" },
    { title: "Novidades e Lançamentos", content: "Recebemos novidades toda semana! Para saber primeiro sobre lançamentos, siga nosso Instagram e WhatsApp. Posso te avisar quando chegar algo do seu estilo!", category: "Informações" },
    { title: "Atendimento por WhatsApp", content: "Nosso atendimento por WhatsApp funciona de Segunda a Sexta das 9h às 18h. Fora desse horário, deixe sua mensagem que respondo assim que possível! Para urgências, ligue para a loja.", category: "Informações" },
];


export default function AgentDetailsPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = use(params);
    const router = useRouter();
    const [agent, setAgent] = useState<Agent | null>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState("");
    const [successMsg, setSuccessMsg] = useState("");

    const [showTrainingForm, setShowTrainingForm] = useState(false);
    const [showFaqTemplates, setShowFaqTemplates] = useState(false);
    const [editingTemplate, setEditingTemplate] = useState<{ title: string; content: string } | null>(null);
    const [trainingForm, setTrainingForm] = useState({
        type: "QA",
        title: "",
        content: "",
    });
    const [addingTraining, setAddingTraining] = useState(false);
    const [uploadingFile, setUploadingFile] = useState(false);
    const [generatingFaqs, setGeneratingFaqs] = useState(false);
    const [showPlayground, setShowPlayground] = useState(false);
    const [cloning, setCloning] = useState(false);
    const [showImportGuide, setShowImportGuide] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        fetchAgent();
    }, [id]);

    const fetchAgent = async () => {
        try {
            const response = await fetch(`/api/agents/${id}`);
            const data = await response.json();

            if (data.success) {
                setAgent(data.data);
            } else {
                setError("Agente não encontrado");
            }
        } catch {
            setError("Erro ao carregar agente");
        } finally {
            setLoading(false);
        }
    };

    const handleToggleActive = async () => {
        if (!agent) return;

        setSaving(true);
        try {
            const response = await fetch(`/api/agents/${id}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ isActive: !agent.isActive }),
            });

            const data = await response.json();
            if (data.success) {
                setAgent({ ...agent, isActive: !agent.isActive });
            }
        } catch {
            setError("Erro ao atualizar agente");
        } finally {
            setSaving(false);
        }
    };

    const handleAddTraining = async (e: React.FormEvent) => {
        e.preventDefault();
        setAddingTraining(true);

        try {
            const response = await fetch(`/api/agents/${id}/training`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(trainingForm),
            });

            const data = await response.json();
            if (data.success) {
                setAgent({
                    ...agent!,
                    trainingData: [data.data, ...agent!.trainingData],
                });
                setTrainingForm({ type: "QA", title: "", content: "" });
                setShowTrainingForm(false);
            } else {
                setError(data.error);
            }
        } catch {
            setError("Erro ao adicionar treinamento");
        } finally {
            setAddingTraining(false);
        }
    };

    const handleDeleteTraining = async (trainingId: string) => {
        if (!confirm("Tem certeza que deseja excluir este treinamento?")) return;

        try {
            const response = await fetch(`/api/agents/${id}/training/${trainingId}`, {
                method: "DELETE",
            });

            const data = await response.json();
            if (data.success) {
                setAgent({
                    ...agent!,
                    trainingData: agent!.trainingData.filter((t) => t.id !== trainingId),
                });
            }
        } catch {
            setError("Erro ao excluir treinamento");
        }
    };

    // Upload de documento (PDF, DOCX, TXT)
    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        // Validar extensão
        const validExtensions = [".pdf", ".docx", ".txt", ".md"];
        const ext = file.name.toLowerCase().substring(file.name.lastIndexOf("."));
        if (!validExtensions.includes(ext)) {
            setError("Formato não suportado. Use PDF, DOCX ou TXT.");
            return;
        }

        // Validar tamanho (8MB)
        if (file.size > 8 * 1024 * 1024) {
            setError("Arquivo muito grande. Máximo 8MB.");
            return;
        }

        setUploadingFile(true);
        setError("");

        try {
            const formData = new FormData();
            formData.append("file", file);
            formData.append("extractProducts", "true"); // Auto-create products from PDF

            const response = await fetch(`/api/agents/${id}/training/upload`, {
                method: "POST",
                body: formData,
            });

            const data = await response.json();

            if (data.success) {
                // Recarregar agente para atualizar lista de treinamentos
                await fetchAgent();
                setError("");
                setSuccessMsg("Documento importado com sucesso!");
                setTimeout(() => setSuccessMsg(""), 3000);
            } else {
                setError(data.error || "Erro ao importar documento");
            }
        } catch {
            setError("Erro ao fazer upload do arquivo");
        } finally {
            setUploadingFile(false);
            // Limpar input para permitir upload do mesmo arquivo
            if (e.target) e.target.value = "";
        }
    };

    // Gerar FAQs automáticos a partir dos templates
    const handleGenerateFaqs = async (selectedTemplates: { title: string; content: string }[]) => {
        if (selectedTemplates.length === 0) return;

        setGeneratingFaqs(true);
        setError("");

        try {
            let addedCount = 0;
            for (const template of selectedTemplates) {
                const response = await fetch(`/api/agents/${id}/training`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        type: "FAQ",
                        title: template.title,
                        content: template.content,
                    }),
                });
                const data = await response.json();
                if (data.success) addedCount++;
            }

            await fetchAgent();
            setShowFaqTemplates(false);
            setSuccessMsg(`${addedCount} FAQs adicionados com sucesso!`);
            setTimeout(() => setSuccessMsg(""), 3000);
        } catch {
            setError("Erro ao gerar FAQs");
        } finally {
            setGeneratingFaqs(false);
        }
    };

    if (loading) {
        return (
            <div className="dash-loading">
                <div className="dash-spinner" />
            </div>
        );
    }

    if (!agent) {
        return (
            <div className="dash-empty">
                <p style={{ color: '#94a3b8' }}>{error || "Agente não encontrado"}</p>
                <Link href="/dashboard/agents" className="dash-btn secondary" style={{ marginTop: '1rem' }}>
                    Voltar
                </Link>
            </div>
        );
    }

    return (
        <div className="dash-fade-in">
            {/* Header */}
            <div className="dash-page-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    <Link href="/dashboard/agents" className="dash-btn secondary sm">
                        <ArrowLeft />
                    </Link>
                    <div style={{
                        width: 48,
                        height: 48,
                        borderRadius: 12,
                        background: agent.isActive
                            ? 'linear-gradient(135deg, #10b981, #059669)'
                            : '#475569',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                    }}>
                        <Bot style={{ width: 24, height: 24, color: 'white' }} />
                    </div>
                    <div>
                        <h1 className="dash-page-title">{agent.name}</h1>
                        <p className="dash-page-subtitle">{agent.description || "Sem descrição"}</p>
                    </div>
                </div>

                <button
                    className="dash-btn secondary"
                    onClick={() => setShowPlayground(true)}
                    style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}
                >
                    <Play size={16} />
                    Testar
                </button>
                <button
                    className="dash-btn secondary"
                    onClick={async () => {
                        if (cloning) return;
                        setCloning(true);
                        try {
                            const res = await fetch(`/api/agents/${agent.id}/clone`, { method: "POST" });
                            const data = await res.json();
                            if (data.success) {
                                setSuccessMsg(data.message || "Agente clonado!");
                                router.push(`/dashboard/agents/${data.data.id}`);
                            } else {
                                setError(data.error || "Erro ao clonar");
                            }
                        } catch {
                            setError("Erro ao clonar agente");
                        } finally {
                            setCloning(false);
                        }
                    }}
                    disabled={cloning}
                    style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}
                >
                    <Copy size={16} />
                    {cloning ? "Clonando..." : "Clonar"}
                </button>
                <button
                    className={`dash-btn ${agent.isActive ? 'secondary' : 'primary'}`}
                    onClick={handleToggleActive}
                    disabled={saving}
                >
                    {agent.isActive ? "Desativar" : "Ativar"}
                </button>
            </div>

            {/* Playground Modal */}
            {showPlayground && (
                <AgentPlayground
                    agentId={agent.id}
                    agentName={agent.name}
                    onClose={() => setShowPlayground(false)}
                />
            )}

            {/* PDF Import Guide Modal */}
            {showImportGuide && (
                <div style={{
                    position: 'fixed',
                    inset: 0,
                    background: 'rgba(0, 0, 0, 0.8)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    zIndex: 1000,
                    padding: '1rem',
                }}>
                    <div style={{
                        background: '#1e293b',
                        borderRadius: '16px',
                        width: '100%',
                        maxWidth: '700px',
                        maxHeight: '80vh',
                        overflow: 'auto',
                        border: '1px solid rgba(255,255,255,0.1)',
                    }}>
                        <div style={{
                            padding: '1.5rem',
                            borderBottom: '1px solid rgba(255,255,255,0.1)',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                        }}>
                            <h2 style={{ color: 'white', margin: 0, fontSize: '1.25rem' }}>
                                📚 Guia de Importação de PDF
                            </h2>
                            <button
                                onClick={() => setShowImportGuide(false)}
                                style={{
                                    background: 'rgba(255,255,255,0.1)',
                                    border: 'none',
                                    borderRadius: '8px',
                                    padding: '0.5rem 1rem',
                                    color: 'white',
                                    cursor: 'pointer',
                                }}
                            >
                                ✕ Fechar
                            </button>
                        </div>
                        <div style={{ padding: '1.5rem', color: '#cbd5e1' }}>
                            <h3 style={{ color: 'white', marginTop: 0 }}>✅ Formatos Aceitos</h3>
                            <p>PDF, DOCX, TXT • Tamanho máximo: 8MB</p>

                            <h3 style={{ color: 'white' }}>📝 Como Preparar seu PDF</h3>
                            <ul style={{ lineHeight: 1.8 }}>
                                <li>Use texto simples e organizado (evite PDFs escaneados)</li>
                                <li>Liste seus produtos com preços, tamanhos e cores</li>
                                <li>Inclua políticas de troca e frete</li>
                            </ul>

                            <h3 style={{ color: 'white' }}>👗 Exemplo para Loja de Roupas</h3>
                            <pre style={{
                                background: 'rgba(255,255,255,0.05)',
                                padding: '1rem',
                                borderRadius: '8px',
                                fontSize: '0.8rem',
                                overflow: 'auto',
                                whiteSpace: 'pre-wrap',
                                color: '#e5e5e5',
                                border: '1px solid rgba(255,255,255,0.1)'
                            }}>{`COLEÇÃO VERÃO 2025

• Camiseta Básica Algodão
  Cores: Preta, Branca, Cinza
  Tamanhos: P, M, G, GG
  Preço: R$ 49,90

• Calça Jeans Skinny
  Tamanhos: 36 ao 44
  Preço: R$ 129,90

• Vestido Floral Midi
  Tamanhos: P, M, G
  Preço: R$ 159,90

POLÍTICAS DA LOJA
• Frete Grátis: Compras acima de R$ 299
• Trocas: Até 30 dias com etiqueta
• Pagamento: PIX (5% off) ou Cartão em até 6x`}</pre>

                            <div style={{
                                background: 'rgba(255, 255, 255, 0.05)',
                                border: '1px solid rgba(255, 255, 255, 0.2)',
                                borderRadius: '8px',
                                padding: '1rem',
                                marginTop: '1rem',
                            }}>
                                <strong style={{ color: 'white' }}>⚠️ Importante:</strong>
                                <p style={{ margin: '0.5rem 0 0 0', color: '#a3a3a3' }}>
                                    A IA só responde informações que estão no treinamento.
                                    Se faltar dados, ela transfere para um humano!
                                </p>
                            </div>
                        </div>
                    </div>
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

            {/* Stats */}
            <div className="dash-stats-grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)', marginBottom: '1.5rem' }}>
                <div className="dash-stat-card">
                    <div className="dash-stat-label">Conversas</div>
                    <div className="dash-stat-value">{agent._count.conversations}</div>
                </div>
                <div className="dash-stat-card">
                    <div className="dash-stat-label">Treinamentos</div>
                    <div className="dash-stat-value">{agent.trainingData.length}</div>
                </div>
                <div className="dash-stat-card">
                    <div className="dash-stat-label">Status</div>
                    <div className="dash-stat-value" style={{ color: agent.isActive ? '#34d399' : '#94a3b8' }}>
                        {agent.isActive ? "Ativo" : "Inativo"}
                    </div>
                </div>
            </div>

            {/* Voice Synthesis Settings */}
            <div className="dash-card" style={{ marginBottom: '1.5rem' }}>
                <div className="dash-card-header">
                    <h3 className="dash-card-title">
                        <Mic style={{ color: '#ec4899' }} />
                        Síntese de Voz (TTS)
                    </h3>
                </div>
                <div className="dash-card-content">
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', alignItems: 'center' }}>
                        <div>
                            <div style={{ fontWeight: 500, color: 'white', marginBottom: '0.5rem' }}>
                                Respostas por Áudio
                            </div>
                            <p style={{ fontSize: '0.875rem', color: '#94a3b8', margin: 0 }}>
                                Quando ativado, a IA envia respostas como mensagens de voz em vez de texto
                            </p>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '1rem' }}>
                            <select
                                value={agent.voiceId || 'nova'}
                                onChange={async (e) => {
                                    const newVoiceId = e.target.value;
                                    setAgent({ ...agent, voiceId: newVoiceId });
                                    await fetch(`/api/agents/${id}`, {
                                        method: 'PUT',
                                        headers: { 'Content-Type': 'application/json' },
                                        body: JSON.stringify({ voiceId: newVoiceId }),
                                    });
                                }}
                                className="dash-input dash-select"
                                style={{ width: '140px' }}
                                disabled={!agent.voiceEnabled}
                            >
                                <option value="alloy">Alloy</option>
                                <option value="echo">Echo</option>
                                <option value="fable">Fable</option>
                                <option value="onyx">Onyx</option>
                                <option value="nova">Nova ⭐</option>
                                <option value="shimmer">Shimmer</option>
                            </select>
                            <button
                                onClick={async () => {
                                    const newValue = !agent.voiceEnabled;
                                    setAgent({ ...agent, voiceEnabled: newValue });
                                    await fetch(`/api/agents/${id}`, {
                                        method: 'PUT',
                                        headers: { 'Content-Type': 'application/json' },
                                        body: JSON.stringify({ voiceEnabled: newValue }),
                                    });
                                }}
                                style={{
                                    width: '60px',
                                    height: '32px',
                                    borderRadius: '16px',
                                    border: 'none',
                                    cursor: 'pointer',
                                    background: agent.voiceEnabled
                                        ? 'linear-gradient(135deg, #ec4899, #be185d)'
                                        : '#475569',
                                    position: 'relative',
                                    transition: 'all 0.3s ease',
                                }}
                            >
                                <div style={{
                                    width: '24px',
                                    height: '24px',
                                    borderRadius: '50%',
                                    background: 'white',
                                    position: 'absolute',
                                    top: '4px',
                                    left: agent.voiceEnabled ? '32px' : '4px',
                                    transition: 'all 0.3s ease',
                                    boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
                                }} />
                            </button>
                        </div>
                    </div>
                    {agent.voiceEnabled && (
                        <div style={{
                            marginTop: '1rem',
                            padding: '0.75rem 1rem',
                            background: 'rgba(236, 72, 153, 0.1)',
                            borderRadius: '8px',
                            border: '1px solid rgba(236, 72, 153, 0.2)',
                            color: '#f472b6',
                            fontSize: '0.875rem',
                        }}>
                            🎤 A IA vai responder com mensagens de voz usando a voz &quot;{agent.voiceId || 'Nova'}&quot;
                        </div>
                    )}
                </div>
            </div>

            {/* Training Data */}
            <div className="dash-card">
                <div className="dash-card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <h3 className="dash-card-title">
                        <BookOpen style={{ color: '#a855f7' }} />
                        Base de Conhecimento
                    </h3>
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                        {/* FAQ Templates */}
                        <button
                            className="dash-btn secondary sm"
                            onClick={() => setShowFaqTemplates(!showFaqTemplates)}
                            title="Adicionar FAQs prontos"
                        >
                            <HelpCircle />
                            FAQ Prontos
                        </button>
                        {/* Upload de Documento */}
                        <input
                            type="file"
                            ref={(el) => { fileInputRef.current = el; }}
                            onChange={handleFileUpload}
                            accept=".pdf,.docx,.txt,.md"
                            style={{ display: 'none' }}
                        />
                        <button
                            className="dash-btn secondary sm"
                            onClick={() => setShowImportGuide(true)}
                            title="Como preparar seu PDF para importação"
                            style={{ padding: '0.5rem 0.75rem' }}
                        >
                            📖
                        </button>
                        <button
                            className="dash-btn secondary sm"
                            onClick={() => fileInputRef.current?.click()}
                            disabled={uploadingFile}
                            title="Importar PDF, DOCX ou TXT (máx 8MB)"
                        >
                            {uploadingFile ? <RefreshCw className="dash-spinner-icon" /> : <Upload />}
                            {uploadingFile ? 'Importando...' : 'Importar'}
                        </button>
                        <button className="dash-btn primary sm" onClick={() => setShowTrainingForm(true)}>
                            <Plus />
                            Adicionar
                        </button>
                    </div>
                </div>
                <div className="dash-card-content">
                    {/* Success Message */}
                    {successMsg && (
                        <div style={{
                            padding: '0.75rem 1rem',
                            background: 'rgba(34, 197, 94, 0.1)',
                            border: '1px solid rgba(34, 197, 94, 0.2)',
                            borderRadius: '8px',
                            color: '#22c55e',
                            marginBottom: '1rem',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.5rem',
                        }}>
                            ✅ {successMsg}
                        </div>
                    )}

                    {/* FAQ Templates Panel */}
                    {showFaqTemplates && (
                        <div style={{
                            marginBottom: '1.5rem',
                            padding: '1rem',
                            background: 'rgba(168, 85, 247, 0.05)',
                            borderRadius: '12px',
                            border: '1px solid rgba(168, 85, 247, 0.2)',
                        }}>
                            <h4 style={{ color: 'white', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                <BookOpen style={{ width: 18, height: 18, color: '#a855f7' }} />
                                🛍️ Templates de FAQ para Loja de Roupas
                            </h4>

                            {/* Modal de Edição */}
                            {editingTemplate && (
                                <div style={{
                                    marginBottom: '1rem',
                                    padding: '1rem',
                                    background: 'rgba(34, 197, 94, 0.05)',
                                    borderRadius: '8px',
                                    border: '1px solid rgba(34, 197, 94, 0.2)',
                                }}>
                                    <h5 style={{ color: '#22c55e', marginBottom: '0.75rem' }}>✏️ Editar antes de adicionar</h5>
                                    <div className="dash-field" style={{ marginBottom: '0.75rem' }}>
                                        <label className="dash-label" style={{ fontSize: '0.75rem' }}>Título</label>
                                        <input
                                            type="text"
                                            value={editingTemplate.title}
                                            onChange={(e) => setEditingTemplate({ ...editingTemplate, title: e.target.value })}
                                            className="dash-input"
                                        />
                                    </div>
                                    <div className="dash-field" style={{ marginBottom: '0.75rem' }}>
                                        <label className="dash-label" style={{ fontSize: '0.75rem' }}>Conteúdo</label>
                                        <textarea
                                            value={editingTemplate.content}
                                            onChange={(e) => setEditingTemplate({ ...editingTemplate, content: e.target.value })}
                                            className="dash-input dash-textarea"
                                            rows={3}
                                        />
                                    </div>
                                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                                        <button
                                            className="dash-btn primary sm"
                                            onClick={() => {
                                                handleGenerateFaqs([editingTemplate]);
                                                setEditingTemplate(null);
                                            }}
                                            disabled={generatingFaqs}
                                        >
                                            {generatingFaqs ? <RefreshCw className="dash-spinner-icon" /> : <Plus />}
                                            Adicionar
                                        </button>
                                        <button
                                            className="dash-btn secondary sm"
                                            onClick={() => setEditingTemplate(null)}
                                        >
                                            Cancelar
                                        </button>
                                    </div>
                                </div>
                            )}

                            {/* Lista de Templates */}
                            <p style={{ color: '#64748b', fontSize: '0.75rem', marginBottom: '0.75rem' }}>
                                Clique para adicionar direto, ou clique em ✏️ para editar antes
                            </p>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                {faqTemplates.map((template, idx) => (
                                    <div
                                        key={idx}
                                        style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '0.75rem',
                                            padding: '0.75rem',
                                            background: 'rgba(255,255,255,0.03)',
                                            border: '1px solid rgba(255,255,255,0.08)',
                                            borderRadius: '8px',
                                        }}
                                    >
                                        <div style={{ flex: 1 }}>
                                            <div style={{ fontWeight: 500, color: 'white', marginBottom: '0.25rem' }}>{template.title}</div>
                                            <div style={{ fontSize: '0.75rem', color: '#64748b' }}>
                                                {template.content.length > 80 ? template.content.substring(0, 80) + '...' : template.content}
                                            </div>
                                        </div>
                                        <button
                                            onClick={() => setEditingTemplate({ ...template })}
                                            style={{
                                                padding: '0.5rem',
                                                background: 'rgba(251, 191, 36, 0.1)',
                                                border: '1px solid rgba(251, 191, 36, 0.3)',
                                                borderRadius: '6px',
                                                color: '#fbbf24',
                                                cursor: 'pointer',
                                            }}
                                            title="Editar antes de adicionar"
                                        >
                                            ✏️
                                        </button>
                                        <button
                                            onClick={() => handleGenerateFaqs([template])}
                                            disabled={generatingFaqs}
                                            style={{
                                                padding: '0.5rem 0.75rem',
                                                background: 'rgba(168, 85, 247, 0.1)',
                                                border: '1px solid rgba(168, 85, 247, 0.3)',
                                                borderRadius: '6px',
                                                color: '#a855f7',
                                                cursor: 'pointer',
                                            }}
                                            title="Adicionar direto"
                                        >
                                            <Plus style={{ width: 14, height: 14 }} />
                                        </button>
                                    </div>
                                ))}
                            </div>

                            <div style={{ marginTop: '1rem', display: 'flex', gap: '0.5rem' }}>
                                <button
                                    className="dash-btn primary sm"
                                    onClick={() => handleGenerateFaqs(faqTemplates)}
                                    disabled={generatingFaqs}
                                >
                                    {generatingFaqs ? <RefreshCw className="dash-spinner-icon" /> : <Plus />}
                                    Adicionar Todos ({faqTemplates.length})
                                </button>
                                <button
                                    className="dash-btn secondary sm"
                                    onClick={() => setShowFaqTemplates(false)}
                                >
                                    Fechar
                                </button>
                            </div>
                        </div>
                    )}
                    {/* Add Training Form */}
                    {showTrainingForm && (
                        <form onSubmit={handleAddTraining} style={{
                            marginBottom: '1.5rem',
                            padding: '1rem',
                            background: 'rgba(255,255,255,0.03)',
                            borderRadius: '12px',
                            border: '1px solid rgba(255,255,255,0.08)'
                        }}>
                            <h4 style={{ fontWeight: 500, color: 'white', marginBottom: '1rem' }}>Novo Treinamento</h4>

                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '1rem', marginBottom: '1rem' }}>
                                <div className="dash-field">
                                    <label className="dash-label">Tipo</label>
                                    <select
                                        value={trainingForm.type}
                                        onChange={(e) => setTrainingForm({ ...trainingForm, type: e.target.value })}
                                        className="dash-input dash-select"
                                    >
                                        {trainingTypes.map((type) => (
                                            <option key={type.value} value={type.value}>{type.label}</option>
                                        ))}
                                    </select>
                                </div>
                                <div className="dash-field">
                                    <label className="dash-label">Título *</label>
                                    <input
                                        type="text"
                                        value={trainingForm.title}
                                        onChange={(e) => setTrainingForm({ ...trainingForm, title: e.target.value })}
                                        placeholder="Ex: Horário de funcionamento"
                                        className="dash-input"
                                        required
                                    />
                                </div>
                            </div>

                            <div className="dash-field" style={{ marginBottom: '1rem' }}>
                                <label className="dash-label">Conteúdo *</label>
                                <textarea
                                    value={trainingForm.content}
                                    onChange={(e) => setTrainingForm({ ...trainingForm, content: e.target.value })}
                                    placeholder="Digite o conteúdo do treinamento..."
                                    className="dash-input dash-textarea"
                                    required
                                />
                            </div>

                            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
                                <button type="button" className="dash-btn secondary" onClick={() => setShowTrainingForm(false)}>
                                    Cancelar
                                </button>
                                <button type="submit" className="dash-btn primary" disabled={addingTraining}>
                                    {addingTraining ? (
                                        <RefreshCw style={{ animation: 'spin 1s linear infinite' }} />
                                    ) : (
                                        <Save />
                                    )}
                                    Salvar
                                </button>
                            </div>
                        </form>
                    )}

                    {/* Training List */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                        {agent.trainingData.length === 0 ? (
                            <div className="dash-empty">
                                <BookOpen className="dash-empty-icon" />
                                <h4 className="dash-empty-title">Nenhum treinamento adicionado</h4>
                                <p className="dash-empty-text">Adicione perguntas, FAQs e documentos para treinar o agente</p>
                            </div>
                        ) : (
                            agent.trainingData.map((training) => {
                                const typeInfo = trainingTypes.find((t) => t.value === training.type);
                                const Icon = typeInfo?.icon || FileText;

                                return (
                                    <div
                                        key={training.id}
                                        style={{
                                            display: 'flex',
                                            alignItems: 'flex-start',
                                            gap: '1rem',
                                            padding: '1rem',
                                            background: 'rgba(255,255,255,0.02)',
                                            borderRadius: '12px',
                                            border: '1px solid rgba(255,255,255,0.05)'
                                        }}
                                    >
                                        <div style={{
                                            padding: '0.5rem',
                                            borderRadius: '8px',
                                            background: 'rgba(255,255,255,0.05)',
                                            color: typeInfo?.color || '#94a3b8'
                                        }}>
                                            <Icon style={{ width: 20, height: 20 }} />
                                        </div>
                                        <div style={{ flex: 1, minWidth: 0 }}>
                                            <span style={{ fontSize: '0.7rem', color: '#64748b', textTransform: 'uppercase' }}>
                                                {typeInfo?.label}
                                            </span>
                                            <h4 style={{ fontWeight: 500, color: 'white', margin: '0.25rem 0' }}>{training.title}</h4>
                                            <p style={{
                                                fontSize: '0.875rem',
                                                color: '#94a3b8',
                                                margin: 0,
                                                display: '-webkit-box',
                                                WebkitLineClamp: 2,
                                                WebkitBoxOrient: 'vertical',
                                                overflow: 'hidden'
                                            }}>
                                                {training.content}
                                            </p>
                                        </div>
                                        <button
                                            onClick={() => handleDeleteTraining(training.id)}
                                            style={{
                                                padding: '0.5rem',
                                                background: 'none',
                                                border: 'none',
                                                borderRadius: '8px',
                                                cursor: 'pointer',
                                                color: '#94a3b8'
                                            }}
                                        >
                                            <Trash2 style={{ width: 16, height: 16 }} />
                                        </button>
                                    </div>
                                );
                            })
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
