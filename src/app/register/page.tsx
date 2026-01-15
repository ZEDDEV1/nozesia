"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Bot, Mail, Lock, User, Building2, Phone, ArrowRight, Check, AlertCircle, Briefcase, FileText } from "lucide-react";
import "../(auth)/globals-auth.css";
import "../(auth)/auth-enhancements.css";

const NICHOS = [
    "Loja de Roupas",
];

export default function RegisterPage() {
    const router = useRouter();
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState("");
    const [formData, setFormData] = useState({
        name: "",
        email: "",
        password: "",
        companyName: "",
        companyNiche: "",
        companyDescription: "",
        phone: "",
    });

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        setError("");

        if (!formData.companyNiche) {
            setError("Por favor, selecione o segmento da sua empresa");
            setIsLoading(false);
            return;
        }

        try {
            const response = await fetch("/api/auth/register", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(formData),
            });

            const data = await response.json();

            if (!data.success) {
                setError(data.error || "Erro ao criar conta");
                return;
            }

            router.push("/dashboard");
        } catch {
            setError("Erro de conexão. Tente novamente.");
        } finally {
            setIsLoading(false);
        }
    };

    const features = [
        "Atendimento 24h com IA",
        "Dashboard estilo WhatsApp Web",
        "Treinamento personalizado",
        "Múltiplos agentes de IA",
    ];

    return (
        <div className="auth-page">
            {/* Background Effects */}
            <div className="auth-bg-effects">
                <div className="auth-bg-blob top-right" />
                <div className="auth-bg-blob bottom-left" />
                <div className="auth-bg-blob center" />
            </div>

            <div className="auth-container wide auth-animate-in">
                <div className="auth-grid">
                    {/* Left Side - Info */}
                    <div className="auth-info">
                        <div className="auth-logo">
                            <Bot />
                        </div>
                        <h1 className="auth-info-title">
                            Comece a atender com <span className="highlight">Inteligência Artificial</span>
                        </h1>
                        <p className="auth-info-subtitle">
                            Automatize seu atendimento via WhatsApp e nunca perca um cliente.
                        </p>

                        <div className="auth-features">
                            {features.map((feature, index) => (
                                <div key={index} className="auth-feature">
                                    <div className="auth-feature-icon">
                                        <Check />
                                    </div>
                                    <span className="auth-feature-text">{feature}</span>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Right Side - Form */}
                    <div>
                        {/* Mobile Header */}
                        <div className="auth-mobile-header">
                            <div className="auth-mobile-logo">
                                <Bot />
                            </div>
                            <h1 className="auth-mobile-title">NozesIA</h1>
                        </div>

                        <div className="auth-card">
                            <div className="auth-card-header">
                                <h2 className="auth-card-title">Criar sua conta</h2>
                                <p className="auth-card-subtitle">Comece grátis e faça upgrade quando quiser</p>
                            </div>

                            <form onSubmit={handleSubmit} className="auth-form">
                                {error && (
                                    <div className="auth-error">
                                        <AlertCircle />
                                        {error}
                                    </div>
                                )}

                                <div className="auth-form-row">
                                    <div className="auth-field">
                                        <label className="auth-label">Seu nome</label>
                                        <div className="auth-input-wrapper">
                                            <input
                                                type="text"
                                                placeholder="João Silva"
                                                value={formData.name}
                                                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                                className="auth-input"
                                                required
                                            />
                                            <span className="auth-input-icon">
                                                <User />
                                            </span>
                                        </div>
                                    </div>

                                    <div className="auth-field">
                                        <label className="auth-label">Nome da empresa</label>
                                        <div className="auth-input-wrapper">
                                            <input
                                                type="text"
                                                placeholder="Minha Empresa"
                                                value={formData.companyName}
                                                onChange={(e) => setFormData({ ...formData, companyName: e.target.value })}
                                                className="auth-input"
                                                required
                                            />
                                            <span className="auth-input-icon">
                                                <Building2 />
                                            </span>
                                        </div>
                                    </div>
                                </div>

                                <div className="auth-field">
                                    <label className="auth-label">Segmento/Nicho da empresa *</label>
                                    <div className="auth-input-wrapper">
                                        <select
                                            value={formData.companyNiche}
                                            onChange={(e) => setFormData({ ...formData, companyNiche: e.target.value })}
                                            className="auth-input"
                                            required
                                            style={{ appearance: 'none', cursor: 'pointer' }}
                                        >
                                            <option value="">Selecione o segmento...</option>
                                            {NICHOS.map((nicho) => (
                                                <option key={nicho} value={nicho}>{nicho}</option>
                                            ))}
                                        </select>
                                        <span className="auth-input-icon">
                                            <Briefcase />
                                        </span>
                                    </div>
                                </div>

                                <div className="auth-field">
                                    <label className="auth-label">Descreva sua empresa (opcional)</label>
                                    <div className="auth-input-wrapper">
                                        <textarea
                                            placeholder="Ex: Vendemos roupas femininas, atendemos em Belo Horizonte, entregamos para todo Brasil..."
                                            value={formData.companyDescription}
                                            onChange={(e) => setFormData({ ...formData, companyDescription: e.target.value })}
                                            className="auth-input"
                                            rows={2}
                                            style={{ minHeight: 70, resize: 'vertical' }}
                                        />
                                        <span className="auth-input-icon" style={{ alignSelf: 'flex-start', marginTop: 12 }}>
                                            <FileText />
                                        </span>
                                    </div>
                                    <p style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: 4 }}>
                                        Isso ajuda a IA a responder corretamente sobre seu negócio
                                    </p>
                                </div>

                                <div className="auth-field">
                                    <label className="auth-label">Email</label>
                                    <div className="auth-input-wrapper">
                                        <input
                                            type="email"
                                            placeholder="seu@email.com"
                                            value={formData.email}
                                            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                            className="auth-input"
                                            required
                                        />
                                        <span className="auth-input-icon">
                                            <Mail />
                                        </span>
                                    </div>
                                </div>

                                <div className="auth-field">
                                    <label className="auth-label">Telefone (opcional)</label>
                                    <div className="auth-input-wrapper">
                                        <input
                                            type="tel"
                                            placeholder="(11) 99999-9999"
                                            value={formData.phone}
                                            onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                                            className="auth-input"
                                        />
                                        <span className="auth-input-icon">
                                            <Phone />
                                        </span>
                                    </div>
                                </div>

                                <div className="auth-field">
                                    <label className="auth-label">Senha</label>
                                    <div className="auth-input-wrapper">
                                        <input
                                            type="password"
                                            placeholder="Mínimo 6 caracteres"
                                            value={formData.password}
                                            onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                                            className="auth-input"
                                            required
                                            minLength={6}
                                        />
                                        <span className="auth-input-icon">
                                            <Lock />
                                        </span>
                                    </div>
                                </div>

                                <button type="submit" className="auth-submit" disabled={isLoading}>
                                    {isLoading ? (
                                        <span className="auth-spinner" />
                                    ) : (
                                        <>
                                            Criar conta grátis
                                            <ArrowRight />
                                        </>
                                    )}
                                </button>
                            </form>

                            <div className="auth-footer">
                                <p className="auth-footer-text">
                                    Já tem uma conta?{" "}
                                    <Link href="/login" className="auth-footer-link">
                                        Fazer login
                                    </Link>
                                </p>
                            </div>
                        </div>
                    </div>
                </div>

                <p className="auth-terms">
                    Ao criar uma conta, você concorda com nossos Termos de Uso e Política de Privacidade.
                </p>
            </div>
        </div>
    );
}
