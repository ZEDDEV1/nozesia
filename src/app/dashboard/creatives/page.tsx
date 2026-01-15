"use client";

import { useState } from "react";
import Link from "next/link";
import {
    ArrowLeft,
    Image as ImageIcon,
    Sparkles,
    Download,
    RefreshCw,
    Palette,
} from "lucide-react";

const nicheOptions = [
    { value: "restaurante", label: "🍕 Restaurante/Delivery", color: "#f97316" },
    { value: "loja", label: "🛍️ Loja/E-commerce", color: "#ec4899" },
    { value: "clinica", label: "🏥 Clínica/Saúde", color: "#3b82f6" },
    { value: "servicos", label: "🔧 Serviços", color: "#eab308" },
    { value: "beleza", label: "💅 Beleza/Estética", color: "#a855f7" },
    { value: "geral", label: "🎨 Marketing Geral", color: "#22c55e" },
];

export default function CreativesPage() {
    const [selectedNiche, setSelectedNiche] = useState<string>("geral");
    const [customPrompt, setCustomPrompt] = useState("");
    const [useTemplate, setUseTemplate] = useState(true);
    const [generating, setGenerating] = useState(false);
    const [generatedImage, setGeneratedImage] = useState<string | null>(null);
    const [revisedPrompt, setRevisedPrompt] = useState<string>("");
    const [error, setError] = useState("");

    const handleGenerate = async () => {
        setGenerating(true);
        setError("");
        setGeneratedImage(null);

        try {
            const response = await fetch("/api/creatives/generate", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    prompt: useTemplate ? null : customPrompt,
                    niche: selectedNiche,
                    useTemplate,
                }),
            });

            const data = await response.json();

            if (data.success) {
                setGeneratedImage(data.data.imageUrl);
                setRevisedPrompt(data.data.revisedPrompt || data.data.prompt);
            } else {
                setError(data.error || "Erro ao gerar imagem");
            }
        } catch {
            setError("Erro ao conectar com o servidor");
        } finally {
            setGenerating(false);
        }
    };

    const handleDownload = async () => {
        if (!generatedImage) return;

        try {
            const response = await fetch(generatedImage);
            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = `criativo-${selectedNiche}-${Date.now()}.png`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            window.URL.revokeObjectURL(url);
        } catch {
            setError("Erro ao baixar imagem");
        }
    };

    return (
        <div className="dash-fade-in">
            {/* Header */}
            <div className="dash-page-header" style={{ display: "flex", alignItems: "center", gap: "1rem", flexWrap: "wrap" }}>
                <Link href="/dashboard" className="dash-btn secondary sm">
                    <ArrowLeft />
                </Link>
                <div>
                    <h1 className="dash-page-title" style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                        <Palette style={{ color: "#a855f7" }} />
                        Geração de Criativos
                    </h1>
                    <p className="dash-page-subtitle">Crie imagens profissionais com IA para suas campanhas</p>
                </div>
            </div>

            {/* Error */}
            {error && (
                <div style={{
                    padding: "1rem",
                    background: "rgba(239, 68, 68, 0.1)",
                    border: "1px solid rgba(239, 68, 68, 0.2)",
                    borderRadius: "12px",
                    color: "#f87171",
                    marginBottom: "1.5rem",
                }}>
                    {error}
                </div>
            )}

            <div className="dash-grid-2-responsive">
                {/* Panel de Configuração */}
                <div className="dash-card">
                    <div className="dash-card-header">
                        <h3 className="dash-card-title">
                            <Sparkles style={{ color: "#fbbf24" }} />
                            Configurar Criativo
                        </h3>
                    </div>
                    <div className="dash-card-content">
                        {/* Seleção de Nicho */}
                        <div className="dash-field" style={{ marginBottom: "1.5rem" }}>
                            <label className="dash-label">Nicho do Negócio</label>
                            <div className="dash-niche-grid">
                                {nicheOptions.map((niche) => (
                                    <button
                                        key={niche.value}
                                        onClick={() => setSelectedNiche(niche.value)}
                                        style={{
                                            padding: "0.75rem",
                                            background: selectedNiche === niche.value
                                                ? `rgba(${niche.value === "geral" ? "34, 197, 94" : "168, 85, 247"}, 0.2)`
                                                : "rgba(255,255,255,0.05)",
                                            border: selectedNiche === niche.value
                                                ? `2px solid ${niche.color}`
                                                : "1px solid rgba(255,255,255,0.1)",
                                            borderRadius: "8px",
                                            color: selectedNiche === niche.value ? niche.color : "#94a3b8",
                                            cursor: "pointer",
                                            textAlign: "left",
                                            fontWeight: selectedNiche === niche.value ? 600 : 400,
                                        }}
                                    >
                                        {niche.label}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Tipo de Prompt */}
                        <div className="dash-field" style={{ marginBottom: "1.5rem" }}>
                            <label className="dash-label">Tipo de Prompt</label>
                            <div style={{ display: "flex", gap: "0.5rem" }}>
                                <button
                                    onClick={() => setUseTemplate(true)}
                                    style={{
                                        flex: 1,
                                        padding: "0.75rem",
                                        background: useTemplate ? "rgba(168, 85, 247, 0.2)" : "rgba(255,255,255,0.05)",
                                        border: useTemplate ? "2px solid #a855f7" : "1px solid rgba(255,255,255,0.1)",
                                        borderRadius: "8px",
                                        color: useTemplate ? "#a855f7" : "#94a3b8",
                                        cursor: "pointer",
                                    }}
                                >
                                    🎲 Template Automático
                                </button>
                                <button
                                    onClick={() => setUseTemplate(false)}
                                    style={{
                                        flex: 1,
                                        padding: "0.75rem",
                                        background: !useTemplate ? "rgba(168, 85, 247, 0.2)" : "rgba(255,255,255,0.05)",
                                        border: !useTemplate ? "2px solid #a855f7" : "1px solid rgba(255,255,255,0.1)",
                                        borderRadius: "8px",
                                        color: !useTemplate ? "#a855f7" : "#94a3b8",
                                        cursor: "pointer",
                                    }}
                                >
                                    ✏️ Prompt Personalizado
                                </button>
                            </div>
                        </div>

                        {/* Custom Prompt */}
                        {!useTemplate && (
                            <div className="dash-field" style={{ marginBottom: "1.5rem" }}>
                                <label className="dash-label">Descreva a imagem que deseja</label>
                                <textarea
                                    value={customPrompt}
                                    onChange={(e) => setCustomPrompt(e.target.value)}
                                    placeholder="Ex: Foto profissional de pizza margherita em mesa de madeira rústica, iluminação quente, estilo food photography..."
                                    className="dash-input dash-textarea"
                                    rows={4}
                                />
                            </div>
                        )}

                        {/* Botão Gerar */}
                        <button
                            className="dash-btn primary"
                            onClick={handleGenerate}
                            disabled={generating || (!useTemplate && !customPrompt.trim())}
                            style={{ width: "100%" }}
                        >
                            {generating ? (
                                <>
                                    <RefreshCw className="dash-spinner-icon" />
                                    Gerando com DALL-E 3...
                                </>
                            ) : (
                                <>
                                    <Sparkles />
                                    Gerar Criativo
                                </>
                            )}
                        </button>

                        {generating && (
                            <p style={{ color: "#64748b", fontSize: "0.875rem", marginTop: "1rem", textAlign: "center" }}>
                                ⏳ A geração pode levar até 30 segundos...
                            </p>
                        )}
                    </div>
                </div>

                {/* Panel de Resultado */}
                <div className="dash-card">
                    <div className="dash-card-header">
                        <h3 className="dash-card-title">
                            <ImageIcon style={{ color: "#22c55e" }} />
                            Resultado
                        </h3>
                    </div>
                    <div className="dash-card-content">
                        {generatedImage ? (
                            <div>
                                <div style={{
                                    borderRadius: "12px",
                                    overflow: "hidden",
                                    marginBottom: "1rem",
                                    border: "1px solid rgba(255,255,255,0.1)",
                                }}>
                                    <img
                                        src={generatedImage}
                                        alt="Criativo gerado"
                                        style={{ width: "100%", display: "block" }}
                                    />
                                </div>

                                {revisedPrompt && (
                                    <div style={{
                                        padding: "0.75rem",
                                        background: "rgba(255,255,255,0.03)",
                                        borderRadius: "8px",
                                        marginBottom: "1rem",
                                    }}>
                                        <p style={{ fontSize: "0.75rem", color: "#64748b", marginBottom: "0.25rem" }}>
                                            Prompt utilizado:
                                        </p>
                                        <p style={{ fontSize: "0.875rem", color: "#94a3b8" }}>
                                            {revisedPrompt}
                                        </p>
                                    </div>
                                )}

                                <div style={{ display: "flex", gap: "0.5rem" }}>
                                    <button className="dash-btn primary" onClick={handleDownload} style={{ flex: 1 }}>
                                        <Download />
                                        Baixar Imagem
                                    </button>
                                    <button className="dash-btn secondary" onClick={handleGenerate} disabled={generating}>
                                        <RefreshCw />
                                        Gerar Outro
                                    </button>
                                </div>
                            </div>
                        ) : (
                            <div className="dash-empty" style={{ padding: "3rem" }}>
                                <ImageIcon className="dash-empty-icon" style={{ color: "#475569" }} />
                                <h4 className="dash-empty-title">Nenhuma imagem gerada</h4>
                                <p className="dash-empty-text">
                                    Selecione um nicho e clique em &quot;Gerar Criativo&quot;
                                </p>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
