"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Shirt, Mail, Lock, ArrowRight, AlertCircle, Sparkles, MessageSquare, Zap } from "lucide-react";

export default function LoginPage() {
    const router = useRouter();
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState("");
    const [formData, setFormData] = useState({
        email: "",
        password: "",
    });

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        setError("");

        try {
            const response = await fetch("/api/auth/login", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(formData),
            });

            const data = await response.json();

            if (!data.success) {
                setError(data.error || "Erro ao fazer login");
                return;
            }

            if (data.data.requiresTwoFactor) {
                router.push(`/2fa?userId=${data.data.userId}`);
                return;
            }

            if (data.data.user.role === "SUPER_ADMIN") {
                router.push("/admin");
            } else {
                router.push("/dashboard");
            }
        } catch {
            setError("Erro de conexão. Tente novamente.");
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div style={{
            minHeight: "100vh",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "1.5rem",
            background: "#000",
            position: "relative",
            overflow: "hidden",
        }}>
            {/* Background Effects */}
            <div style={{ position: "absolute", inset: 0, pointerEvents: "none", overflow: "hidden" }}>
                <div style={{
                    position: "absolute", top: "-15%", right: "-5%",
                    width: 500, height: 500, borderRadius: "50%",
                    background: "radial-gradient(circle, rgba(255,255,255,0.06) 0%, transparent 70%)",
                    filter: "blur(60px)",
                }} />
                <div style={{
                    position: "absolute", bottom: "-15%", left: "-5%",
                    width: 600, height: 600, borderRadius: "50%",
                    background: "radial-gradient(circle, rgba(255,255,255,0.04) 0%, transparent 70%)",
                    filter: "blur(80px)",
                }} />
            </div>

            <div style={{ width: "100%", maxWidth: 1000, position: "relative", zIndex: 1 }}>
                <div style={{
                    display: "grid",
                    gap: "3rem",
                    alignItems: "center",
                    gridTemplateColumns: "1fr",
                }}>
                    {/* Desktop: Two Column Layout */}
                    <style>{`
                        @media (min-width: 1024px) {
                            .login-grid { grid-template-columns: 1fr 1fr !important; gap: 4rem !important; }
                            .login-info { display: block !important; }
                            .login-mobile-header { display: none !important; }
                        }
                    `}</style>

                    <div className="login-grid" style={{ display: "grid", gap: "3rem", alignItems: "center" }}>
                        {/* Left Side - Info Panel (Desktop Only) */}
                        <div className="login-info" style={{ display: "none" }}>
                            <div style={{
                                display: "inline-flex", alignItems: "center", justifyContent: "center",
                                width: 72, height: 72, borderRadius: 20,
                                background: "#fff", boxShadow: "0 20px 50px rgba(255,255,255,0.15)",
                                marginBottom: "2rem",
                            }}>
                                <Shirt style={{ width: 36, height: 36, color: "#000" }} />
                            </div>
                            <h1 style={{
                                fontSize: "2.75rem", fontWeight: 700, lineHeight: 1.15,
                                color: "#fff", margin: "0 0 1.5rem",
                            }}>
                                Automatize suas vendas com{" "}
                                <span style={{ color: "rgba(255,255,255,0.6)" }}>NozesIA</span>
                            </h1>
                            <p style={{
                                fontSize: "1.125rem", color: "rgba(255,255,255,0.5)",
                                lineHeight: 1.6, margin: "0 0 2.5rem",
                            }}>
                                Atendimento inteligente via WhatsApp para sua loja de roupas.
                                Capture leads, responda automaticamente e aumente suas vendas.
                            </p>
                            <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
                                {[
                                    { icon: MessageSquare, text: "Atendente virtual 24/7 no WhatsApp" },
                                    { icon: Sparkles, text: "IA treinada para seu negócio" },
                                    { icon: Zap, text: "Integração fácil, resultados rápidos" },
                                ].map((feature, i) => (
                                    <div key={i} style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
                                        <div style={{
                                            width: 32, height: 32, borderRadius: 10,
                                            background: "rgba(255,255,255,0.1)",
                                            display: "flex", alignItems: "center", justifyContent: "center",
                                        }}>
                                            <feature.icon style={{ width: 16, height: 16, color: "#fff" }} />
                                        </div>
                                        <span style={{ fontSize: "1rem", color: "rgba(255,255,255,0.7)" }}>
                                            {feature.text}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Right Side - Login Card */}
                        <div style={{
                            background: "rgba(255,255,255,0.03)",
                            backdropFilter: "blur(24px)",
                            border: "1px solid rgba(255,255,255,0.08)",
                            borderRadius: 24, padding: "2.5rem",
                            boxShadow: "0 25px 50px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.05)",
                        }}>
                            {/* Mobile Header */}
                            <div className="login-mobile-header" style={{ textAlign: "center", marginBottom: "2.5rem" }}>
                                <div style={{
                                    display: "inline-flex", alignItems: "center", justifyContent: "center",
                                    width: 64, height: 64, borderRadius: 18,
                                    background: "#fff", boxShadow: "0 15px 40px rgba(255,255,255,0.15)",
                                    marginBottom: "1.25rem",
                                }}>
                                    <Shirt style={{ width: 32, height: 32, color: "#000" }} />
                                </div>
                                <h1 style={{
                                    fontSize: "1.875rem", fontWeight: 700,
                                    color: "#fff", margin: 0,
                                }}>
                                    Nozes<span style={{ color: "rgba(255,255,255,0.5)" }}>IA</span>
                                </h1>
                            </div>

                            {/* Card Header */}
                            <div style={{ marginBottom: "2rem" }}>
                                <h2 style={{ fontSize: "1.5rem", fontWeight: 700, color: "#fff", margin: "0 0 0.625rem" }}>
                                    Bem-vindo de volta
                                </h2>
                                <p style={{ fontSize: "0.9rem", color: "rgba(255,255,255,0.5)", margin: 0, lineHeight: 1.5 }}>
                                    Digite suas credenciais para acessar
                                </p>
                            </div>

                            {/* Form */}
                            <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
                                {/* Error Alert */}
                                {error && (
                                    <div style={{
                                        display: "flex", alignItems: "center", gap: "0.75rem",
                                        padding: "1rem 1.25rem", background: "rgba(239,68,68,0.1)",
                                        border: "1px solid rgba(239,68,68,0.2)", borderRadius: 12,
                                        color: "#f87171", fontSize: "0.9rem",
                                    }}>
                                        <AlertCircle style={{ width: 20, height: 20, flexShrink: 0 }} />
                                        <span>{error}</span>
                                    </div>
                                )}

                                {/* Email Field */}
                                <div style={{ display: "flex", flexDirection: "column", gap: "0.625rem" }}>
                                    <label style={{ fontSize: "0.875rem", fontWeight: 500, color: "rgba(255,255,255,0.7)" }}>
                                        Email
                                    </label>
                                    <div style={{ position: "relative", display: "flex", alignItems: "center" }}>
                                        <span style={{ position: "absolute", left: "1.125rem", color: "rgba(255,255,255,0.4)", pointerEvents: "none" }}>
                                            <Mail style={{ width: 20, height: 20 }} />
                                        </span>
                                        <input
                                            type="email"
                                            placeholder="seu@email.com"
                                            value={formData.email}
                                            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                            required
                                            autoComplete="email"
                                            style={{
                                                width: "100%", padding: "1rem 1rem 1rem 3.25rem",
                                                background: "rgba(255,255,255,0.05)",
                                                border: "1px solid rgba(255,255,255,0.08)",
                                                borderRadius: 12, color: "#fff", fontSize: "0.95rem",
                                                outline: "none", transition: "all 0.2s",
                                            }}
                                            onFocus={(e) => e.target.style.borderColor = "rgba(255,255,255,0.3)"}
                                            onBlur={(e) => e.target.style.borderColor = "rgba(255,255,255,0.08)"}
                                        />
                                    </div>
                                </div>

                                {/* Password Field */}
                                <div style={{ display: "flex", flexDirection: "column", gap: "0.625rem" }}>
                                    <label style={{ fontSize: "0.875rem", fontWeight: 500, color: "rgba(255,255,255,0.7)" }}>
                                        Senha
                                    </label>
                                    <div style={{ position: "relative", display: "flex", alignItems: "center" }}>
                                        <span style={{ position: "absolute", left: "1.125rem", color: "rgba(255,255,255,0.4)", pointerEvents: "none" }}>
                                            <Lock style={{ width: 20, height: 20 }} />
                                        </span>
                                        <input
                                            type="password"
                                            placeholder="••••••••"
                                            value={formData.password}
                                            onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                                            required
                                            autoComplete="current-password"
                                            style={{
                                                width: "100%", padding: "1rem 1rem 1rem 3.25rem",
                                                background: "rgba(255,255,255,0.05)",
                                                border: "1px solid rgba(255,255,255,0.08)",
                                                borderRadius: 12, color: "#fff", fontSize: "0.95rem",
                                                outline: "none", transition: "all 0.2s",
                                            }}
                                            onFocus={(e) => e.target.style.borderColor = "rgba(255,255,255,0.3)"}
                                            onBlur={(e) => e.target.style.borderColor = "rgba(255,255,255,0.08)"}
                                        />
                                    </div>
                                </div>

                                {/* Submit Button */}
                                <button
                                    type="submit"
                                    disabled={isLoading}
                                    style={{
                                        display: "flex", alignItems: "center", justifyContent: "center", gap: "0.75rem",
                                        width: "100%", padding: "1.125rem 2rem",
                                        background: "#fff", border: "none", borderRadius: 12,
                                        color: "#000", fontSize: "1rem", fontWeight: 600, cursor: "pointer",
                                        transition: "all 0.25s", marginTop: "0.5rem",
                                        opacity: isLoading ? 0.7 : 1,
                                    }}
                                    onMouseEnter={(e) => !isLoading && (e.currentTarget.style.transform = "translateY(-2px)", e.currentTarget.style.boxShadow = "0 15px 40px rgba(255,255,255,0.2)")}
                                    onMouseLeave={(e) => (e.currentTarget.style.transform = "translateY(0)", e.currentTarget.style.boxShadow = "none")}
                                >
                                    {isLoading ? (
                                        <div style={{
                                            width: 20, height: 20,
                                            border: "2px solid rgba(0,0,0,0.2)",
                                            borderTopColor: "#000", borderRadius: "50%",
                                            animation: "spin 0.6s linear infinite",
                                        }} />
                                    ) : (
                                        <>
                                            Entrar
                                            <ArrowRight style={{ width: 20, height: 20 }} />
                                        </>
                                    )}
                                </button>
                            </form>

                            {/* Copyright */}
                            <p style={{
                                textAlign: "center", fontSize: "0.8rem",
                                color: "rgba(255,255,255,0.3)", marginTop: "2rem",
                            }}>
                                © {new Date().getFullYear()} NozesIA. Todos os direitos reservados.
                            </p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Keyframes for spinner */}
            <style>{`
                @keyframes spin { to { transform: rotate(360deg); } }
                input::placeholder { color: rgba(255,255,255,0.3) !important; }
            `}</style>
        </div>
    );
}
