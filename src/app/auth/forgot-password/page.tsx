"use client";

import { useState } from "react";
import Link from "next/link";
import { Mail, ArrowLeft, Loader2 } from "lucide-react";

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
        color: '#10b981',
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
    input: {
        background: 'rgba(255, 255, 255, 0.05)',
        border: '1px solid rgba(255, 255, 255, 0.1)',
        borderRadius: '8px',
        padding: '12px 16px',
        color: '#f1f5f9',
        fontSize: '15px',
        outline: 'none',
    } as React.CSSProperties,
    btn: {
        background: 'linear-gradient(135deg, #10b981, #06b6d4)',
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
    successIcon: {
        width: '80px',
        height: '80px',
        borderRadius: '50%',
        background: 'rgba(16, 185, 129, 0.1)',
        color: '#10b981',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        margin: '0 auto 24px',
    } as React.CSSProperties,
};

export default function ForgotPasswordPage() {
    const [email, setEmail] = useState("");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const [success, setSuccess] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError("");

        try {
            const res = await fetch("/api/auth/forgot-password", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email }),
            });

            const data = await res.json();

            if (data.success) {
                setSuccess(true);
            } else {
                setError(data.error || "Erro ao enviar email");
            }
        } catch {
            setError("Erro de conexão. Tente novamente.");
        } finally {
            setLoading(false);
        }
    };

    if (success) {
        return (
            <div style={styles.page}>
                <div style={{ ...styles.card, ...styles.successCard }}>
                    <div style={styles.successIcon}>
                        <Mail size={40} />
                    </div>
                    <h1 style={styles.title}>Verifique seu email</h1>
                    <p style={styles.subtitle}>
                        Se o email estiver cadastrado, você receberá um link para redefinir sua senha.
                    </p>
                    <p style={{ color: '#10b981', fontSize: '14px', marginBottom: '24px' }}>
                        {email}
                    </p>
                    <Link href="/auth/login" style={styles.backLink}>
                        <ArrowLeft size={16} />
                        Voltar para o login
                    </Link>
                </div>
            </div>
        );
    }

    return (
        <div style={styles.page}>
            <div style={styles.card}>
                <div style={styles.logo}>
                    <span style={styles.logoText}>🔐 NozesIA</span>
                </div>

                <h1 style={styles.title}>Esqueceu sua senha?</h1>
                <p style={styles.subtitle}>
                    Digite seu email e enviaremos um link para redefinir sua senha.
                </p>

                <form onSubmit={handleSubmit} style={styles.form}>
                    {error && <div style={styles.error}>{error}</div>}

                    <div style={styles.inputGroup}>
                        <label style={styles.label}>Email</label>
                        <input
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            placeholder="seu@email.com"
                            required
                            style={styles.input}
                        />
                    </div>

                    <button
                        type="submit"
                        disabled={loading}
                        style={{ ...styles.btn, opacity: loading ? 0.7 : 1 }}
                    >
                        {loading ? (
                            <>
                                <Loader2 size={18} style={{ animation: 'spin 1s linear infinite' }} />
                                Enviando...
                            </>
                        ) : (
                            <>
                                <Mail size={18} />
                                Enviar link de recuperação
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
