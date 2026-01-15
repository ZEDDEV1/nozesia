"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Lock, ArrowLeft, Loader2, CheckCircle, XCircle, Eye, EyeOff } from "lucide-react";

const styles = {
    page: {
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'linear-gradient(135deg, #0a0a0b 0%, #1a1a2e 100%)',
        padding: '20px',
    } as React.CSSProperties,
    card: {
        background: 'rgba(255, 255, 255, 0.03)',
        border: '1px solid rgba(255, 255, 255, 0.1)',
        borderRadius: '16px',
        padding: '48px',
        maxWidth: '420px',
        width: '100%',
        backdropFilter: 'blur(10px)',
    } as React.CSSProperties,
    logo: {
        textAlign: 'center' as const,
        marginBottom: '32px',
    },
    logoText: {
        color: '#8b5cf6',
        fontSize: '28px',
        fontWeight: 700,
    } as React.CSSProperties,
    title: {
        color: '#f1f5f9',
        fontSize: '24px',
        fontWeight: 600,
        marginBottom: '8px',
        textAlign: 'center' as const,
    } as React.CSSProperties,
    subtitle: {
        color: '#94a3b8',
        fontSize: '14px',
        textAlign: 'center' as const,
        marginBottom: '32px',
    } as React.CSSProperties,
    form: {
        display: 'flex',
        flexDirection: 'column' as const,
        gap: '20px',
    } as React.CSSProperties,
    inputGroup: {
        display: 'flex',
        flexDirection: 'column' as const,
        gap: '8px',
    } as React.CSSProperties,
    label: {
        color: '#94a3b8',
        fontSize: '14px',
        fontWeight: 500,
    } as React.CSSProperties,
    inputWrapper: {
        position: 'relative' as const,
    },
    input: {
        width: '100%',
        background: 'rgba(255, 255, 255, 0.05)',
        border: '1px solid rgba(255, 255, 255, 0.1)',
        borderRadius: '8px',
        padding: '12px 40px 12px 16px',
        color: '#f1f5f9',
        fontSize: '15px',
        outline: 'none',
        boxSizing: 'border-box' as const,
    } as React.CSSProperties,
    eyeBtn: {
        position: 'absolute' as const,
        right: '12px',
        top: '50%',
        transform: 'translateY(-50%)',
        background: 'none',
        border: 'none',
        color: '#64748b',
        cursor: 'pointer',
        padding: '4px',
    } as React.CSSProperties,
    btn: {
        background: 'linear-gradient(135deg, #8b5cf6, #ec4899)',
        color: 'white',
        fontWeight: 600,
        fontSize: '15px',
        padding: '14px 24px',
        borderRadius: '8px',
        border: 'none',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '8px',
    } as React.CSSProperties,
    backLink: {
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        color: '#64748b',
        fontSize: '14px',
        textDecoration: 'none',
        marginTop: '24px',
        justifyContent: 'center',
    } as React.CSSProperties,
    error: {
        background: 'rgba(239, 68, 68, 0.1)',
        border: '1px solid rgba(239, 68, 68, 0.2)',
        borderRadius: '8px',
        padding: '12px',
        color: '#ef4444',
        fontSize: '14px',
    } as React.CSSProperties,
    successCard: {
        textAlign: 'center' as const,
    } as React.CSSProperties,
    icon: {
        width: '80px',
        height: '80px',
        borderRadius: '50%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        margin: '0 auto 24px',
    } as React.CSSProperties,
    successIcon: {
        background: 'rgba(16, 185, 129, 0.1)',
        color: '#10b981',
    },
    errorIcon: {
        background: 'rgba(239, 68, 68, 0.1)',
        color: '#ef4444',
    },
};

function ResetPasswordContent() {
    const searchParams = useSearchParams();
    const router = useRouter();
    const token = searchParams.get("token");

    const [password, setPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirm, setShowConfirm] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const [success, setSuccess] = useState(false);
    const [invalidToken, setInvalidToken] = useState(false);

    useEffect(() => {
        if (!token) {
            setInvalidToken(true);
        }
    }, [token]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError("");

        if (password !== confirmPassword) {
            setError("As senhas não coincidem");
            setLoading(false);
            return;
        }

        if (password.length < 6) {
            setError("A senha deve ter no mínimo 6 caracteres");
            setLoading(false);
            return;
        }

        try {
            const res = await fetch("/api/auth/reset-password", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ token, password, confirmPassword }),
            });

            const data = await res.json();

            if (data.success) {
                setSuccess(true);
                setTimeout(() => {
                    router.push("/auth/login");
                }, 3000);
            } else {
                setError(data.error || "Erro ao redefinir senha");
            }
        } catch {
            setError("Erro de conexão. Tente novamente.");
        } finally {
            setLoading(false);
        }
    };

    if (invalidToken) {
        return (
            <div style={styles.page}>
                <div style={{ ...styles.card, ...styles.successCard }}>
                    <div style={{ ...styles.icon, ...styles.errorIcon }}>
                        <XCircle size={40} />
                    </div>
                    <h1 style={styles.title}>Link inválido</h1>
                    <p style={styles.subtitle}>
                        Este link de recuperação é inválido ou expirou.
                    </p>
                    <Link href="/auth/forgot-password" style={{ ...styles.btn, textDecoration: 'none', display: 'inline-flex', marginTop: '16px' }}>
                        Solicitar novo link
                    </Link>
                </div>
            </div>
        );
    }

    if (success) {
        return (
            <div style={styles.page}>
                <div style={{ ...styles.card, ...styles.successCard }}>
                    <div style={{ ...styles.icon, ...styles.successIcon }}>
                        <CheckCircle size={40} />
                    </div>
                    <h1 style={styles.title}>Senha alterada! 🎉</h1>
                    <p style={styles.subtitle}>
                        Sua senha foi redefinida com sucesso. Redirecionando para o login...
                    </p>
                    <Link href="/auth/login" style={styles.backLink}>
                        <ArrowLeft size={16} />
                        Ir para o login
                    </Link>
                </div>
            </div>
        );
    }

    return (
        <div style={styles.page}>
            <div style={styles.card}>
                <div style={styles.logo}>
                    <span style={styles.logoText}>🔑 NozesIA</span>
                </div>

                <h1 style={styles.title}>Criar nova senha</h1>
                <p style={styles.subtitle}>
                    Digite sua nova senha abaixo.
                </p>

                <form onSubmit={handleSubmit} style={styles.form}>
                    {error && <div style={styles.error}>{error}</div>}

                    <div style={styles.inputGroup}>
                        <label style={styles.label}>Nova senha</label>
                        <div style={styles.inputWrapper}>
                            <input
                                type={showPassword ? "text" : "password"}
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                placeholder="Mínimo 6 caracteres"
                                required
                                style={styles.input}
                            />
                            <button
                                type="button"
                                onClick={() => setShowPassword(!showPassword)}
                                style={styles.eyeBtn}
                            >
                                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                            </button>
                        </div>
                    </div>

                    <div style={styles.inputGroup}>
                        <label style={styles.label}>Confirmar senha</label>
                        <div style={styles.inputWrapper}>
                            <input
                                type={showConfirm ? "text" : "password"}
                                value={confirmPassword}
                                onChange={(e) => setConfirmPassword(e.target.value)}
                                placeholder="Digite novamente"
                                required
                                style={styles.input}
                            />
                            <button
                                type="button"
                                onClick={() => setShowConfirm(!showConfirm)}
                                style={styles.eyeBtn}
                            >
                                {showConfirm ? <EyeOff size={18} /> : <Eye size={18} />}
                            </button>
                        </div>
                    </div>

                    <button
                        type="submit"
                        disabled={loading}
                        style={{ ...styles.btn, opacity: loading ? 0.7 : 1 }}
                    >
                        {loading ? (
                            <>
                                <Loader2 size={18} style={{ animation: 'spin 1s linear infinite' }} />
                                Salvando...
                            </>
                        ) : (
                            <>
                                <Lock size={18} />
                                Redefinir senha
                            </>
                        )}
                    </button>
                </form>

                <Link href="/auth/login" style={styles.backLink}>
                    <ArrowLeft size={16} />
                    Voltar para o login
                </Link>
            </div>
        </div>
    );
}

export default function ResetPasswordPage() {
    return (
        <Suspense fallback={
            <div style={styles.page}>
                <Loader2 size={48} style={{ color: '#8b5cf6', animation: 'spin 1s linear infinite' }} />
            </div>
        }>
            <ResetPasswordContent />
        </Suspense>
    );
}
