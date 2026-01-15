"use client";

import { useState } from "react";
import { Mail, X, RefreshCw } from "lucide-react";

interface EmailVerificationBannerProps {
    userEmail: string;
    onResend?: () => Promise<boolean>;
}

export function EmailVerificationBanner({ userEmail }: EmailVerificationBannerProps) {
    const [dismissed, setDismissed] = useState(false);
    const [resending, setResending] = useState(false);
    const [resendSuccess, setResendSuccess] = useState(false);

    if (dismissed) return null;

    const handleResend = async () => {
        if (resending) return;
        setResending(true);

        try {
            const res = await fetch("/api/auth/resend-verification", {
                method: "POST",
            });
            const data = await res.json();

            if (data.success) {
                setResendSuccess(true);
                setTimeout(() => setResendSuccess(false), 5000);
            }
        } catch (error) {
            console.error("Error resending email:", error);
        } finally {
            setResending(false);
        }
    };

    return (
        <div style={styles.banner}>
            <div style={styles.content}>
                <Mail size={20} style={{ flexShrink: 0 }} />
                <div style={styles.text}>
                    <strong>Verifique seu email para ativar sua conta.</strong>
                    <span style={styles.email}>
                        Enviamos um link de verificação para <strong>{userEmail}</strong>
                    </span>
                </div>
            </div>
            <div style={styles.actions}>
                {resendSuccess ? (
                    <span style={styles.successMsg}>✓ Email reenviado!</span>
                ) : (
                    <button
                        onClick={handleResend}
                        disabled={resending}
                        style={styles.resendBtn}
                    >
                        {resending ? (
                            <RefreshCw size={14} style={{ animation: 'spin 1s linear infinite' }} />
                        ) : (
                            "Reenviar email"
                        )}
                    </button>
                )}
                <button
                    onClick={() => setDismissed(true)}
                    style={styles.closeBtn}
                    title="Fechar"
                >
                    <X size={18} />
                </button>
            </div>
        </div>
    );
}

const styles = {
    banner: {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '16px',
        padding: '12px 20px',
        background: 'linear-gradient(135deg, rgba(245, 158, 11, 0.1), rgba(249, 115, 22, 0.1))',
        borderBottom: '1px solid rgba(245, 158, 11, 0.2)',
        color: '#fbbf24',
        fontSize: '14px',
    } as React.CSSProperties,
    content: {
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
    } as React.CSSProperties,
    text: {
        display: 'flex',
        flexDirection: 'column' as const,
        gap: '2px',
    } as React.CSSProperties,
    email: {
        fontSize: '13px',
        color: '#d97706',
        fontWeight: 400,
    } as React.CSSProperties,
    actions: {
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
    } as React.CSSProperties,
    resendBtn: {
        background: 'rgba(245, 158, 11, 0.2)',
        border: '1px solid rgba(245, 158, 11, 0.3)',
        color: '#fbbf24',
        padding: '6px 12px',
        borderRadius: '6px',
        fontSize: '13px',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        gap: '6px',
    } as React.CSSProperties,
    closeBtn: {
        background: 'transparent',
        border: 'none',
        color: '#d97706',
        cursor: 'pointer',
        padding: '4px',
        display: 'flex',
        alignItems: 'center',
    } as React.CSSProperties,
    successMsg: {
        color: '#10b981',
        fontSize: '13px',
        fontWeight: 500,
    } as React.CSSProperties,
};
