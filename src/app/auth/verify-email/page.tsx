"use client";

import { useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Suspense } from "react";
import { CheckCircle, XCircle, Loader2 } from "lucide-react";

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
        textAlign: 'center' as const,
        backdropFilter: 'blur(10px)',
    } as React.CSSProperties,
    iconBase: {
        width: '80px',
        height: '80px',
        borderRadius: '50%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        margin: '0 auto 24px',
    } as React.CSSProperties,
    iconLoading: {
        background: 'rgba(59, 130, 246, 0.1)',
        color: '#3b82f6',
    },
    iconSuccess: {
        background: 'rgba(16, 185, 129, 0.1)',
        color: '#10b981',
    },
    iconError: {
        background: 'rgba(239, 68, 68, 0.1)',
        color: '#ef4444',
    },
    h1: {
        color: '#f1f5f9',
        fontSize: '24px',
        fontWeight: 600,
        marginBottom: '12px',
    } as React.CSSProperties,
    p: {
        color: '#94a3b8',
        fontSize: '15px',
        lineHeight: 1.6,
        marginBottom: '8px',
    } as React.CSSProperties,
    redirectMsg: {
        fontSize: '13px',
        color: '#64748b',
        marginTop: '16px',
    } as React.CSSProperties,
    actions: {
        display: 'flex',
        gap: '12px',
        marginTop: '24px',
        justifyContent: 'center',
    } as React.CSSProperties,
    btn: {
        display: 'inline-block',
        background: 'linear-gradient(135deg, #10b981, #06b6d4)',
        color: 'white',
        fontWeight: 500,
        fontSize: '14px',
        padding: '12px 24px',
        borderRadius: '8px',
        textDecoration: 'none',
        marginTop: '24px',
    } as React.CSSProperties,
    btnSecondary: {
        display: 'inline-block',
        background: 'rgba(255, 255, 255, 0.05)',
        border: '1px solid rgba(255, 255, 255, 0.1)',
        color: 'white',
        fontWeight: 500,
        fontSize: '14px',
        padding: '12px 24px',
        borderRadius: '8px',
        textDecoration: 'none',
        marginTop: '24px',
    } as React.CSSProperties,
};

function VerifyEmailContent() {
    const searchParams = useSearchParams();
    const router = useRouter();
    const token = searchParams.get("token");

    // Initialize with proper state based on token presence
    const [status, setStatus] = useState<"loading" | "success" | "error">(() => {
        return token ? "loading" : "error";
    });
    const [message, setMessage] = useState(() => {
        return token ? "" : "Token de verificação não encontrado.";
    });

    useEffect(() => {
        // Skip if no token (already set error state in initialization)
        if (!token) return;

        const verifyEmail = async () => {
            try {
                const res = await fetch("/api/auth/verify-email", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ token }),
                });

                const data = await res.json();

                if (data.success) {
                    setStatus("success");
                    setMessage(data.message || "Email verificado com sucesso!");

                    setTimeout(() => {
                        router.push("/dashboard");
                    }, 3000);
                } else {
                    setStatus("error");
                    setMessage(data.error || "Erro ao verificar email.");
                }
            } catch {
                setStatus("error");
                setMessage("Erro de conexão. Tente novamente.");
            }
        };

        verifyEmail();
    }, [token, router]);

    return (
        <div style={styles.page}>
            <div style={styles.card}>
                {status === "loading" && (
                    <>
                        <div style={{ ...styles.iconBase, ...styles.iconLoading }}>
                            <Loader2 size={48} style={{ animation: 'spin 1s linear infinite' }} />
                        </div>
                        <h1 style={styles.h1}>Verificando seu email...</h1>
                        <p style={styles.p}>Aguarde enquanto confirmamos seu cadastro.</p>
                    </>
                )}

                {status === "success" && (
                    <>
                        <div style={{ ...styles.iconBase, ...styles.iconSuccess }}>
                            <CheckCircle size={48} />
                        </div>
                        <h1 style={styles.h1}>Email Verificado! 🎉</h1>
                        <p style={styles.p}>{message}</p>
                        <p style={styles.redirectMsg}>Redirecionando para o dashboard...</p>
                        <Link href="/dashboard" style={styles.btn}>
                            Ir para o Dashboard
                        </Link>
                    </>
                )}

                {status === "error" && (
                    <>
                        <div style={{ ...styles.iconBase, ...styles.iconError }}>
                            <XCircle size={48} />
                        </div>
                        <h1 style={styles.h1}>Erro na Verificação</h1>
                        <p style={styles.p}>{message}</p>
                        <div style={styles.actions}>
                            <Link href="/auth/login" style={styles.btnSecondary}>
                                Fazer Login
                            </Link>
                            <Link href="/auth/register" style={styles.btn}>
                                Criar Nova Conta
                            </Link>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}

export default function VerifyEmailPage() {
    return (
        <Suspense fallback={
            <div style={styles.page}>
                <Loader2 size={48} style={{ color: '#3b82f6', animation: 'spin 1s linear infinite' }} />
            </div>
        }>
            <VerifyEmailContent />
        </Suspense>
    );
}
