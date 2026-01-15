"use client";

/**
 * Error Boundary para o Dashboard
 * 
 * Captura erros específicos do dashboard e mantém o layout.
 */

import { useEffect, useId } from "react";
import Link from "next/link";
import { AlertTriangle, RefreshCw, Home, Bug } from "lucide-react";

const styles = {
    container: {
        minHeight: '60vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '40px 20px',
    } as React.CSSProperties,
    card: {
        background: 'rgba(255, 255, 255, 0.02)',
        border: '1px solid rgba(239, 68, 68, 0.2)',
        borderRadius: '16px',
        padding: '48px',
        maxWidth: '480px',
        width: '100%',
        textAlign: 'center' as const,
    } as React.CSSProperties,
    icon: {
        width: '80px',
        height: '80px',
        borderRadius: '50%',
        background: 'rgba(239, 68, 68, 0.1)',
        color: '#ef4444',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        margin: '0 auto 24px',
    } as React.CSSProperties,
    title: {
        color: '#f1f5f9',
        fontSize: '22px',
        fontWeight: 600,
        marginBottom: '12px',
    } as React.CSSProperties,
    text: {
        color: '#94a3b8',
        fontSize: '14px',
        lineHeight: 1.6,
        marginBottom: '28px',
    } as React.CSSProperties,
    actions: {
        display: 'flex',
        gap: '12px',
        justifyContent: 'center',
        flexWrap: 'wrap' as const,
    } as React.CSSProperties,
    debug: {
        marginTop: '24px',
        padding: '12px 16px',
        background: 'rgba(239, 68, 68, 0.1)',
        border: '1px solid rgba(239, 68, 68, 0.2)',
        borderRadius: '8px',
        fontSize: '12px',
        color: '#f87171',
        fontFamily: 'monospace',
        textAlign: 'left' as const,
        display: 'flex',
        alignItems: 'flex-start',
        gap: '8px',
    } as React.CSSProperties,
    errorCode: {
        marginTop: '20px',
        fontSize: '11px',
        color: '#475569',
    } as React.CSSProperties,
};

export default function DashboardError({
    error,
    reset,
}: {
    error: Error & { digest?: string };
    reset: () => void;
}) {
    const generatedId = useId();

    useEffect(() => {
        console.error("[DashboardError]", error);
    }, [error]);

    const errorId = error.digest || generatedId;

    return (
        <div style={styles.container}>
            <div style={styles.card}>
                <div style={styles.icon}>
                    <AlertTriangle size={40} />
                </div>

                <h2 style={styles.title}>Ops! Algo deu errado</h2>
                <p style={styles.text}>
                    Encontramos um problema ao carregar esta página.
                    Isso pode ser temporário - tente novamente.
                </p>

                <div style={styles.actions}>
                    <button onClick={reset} className="dash-btn primary">
                        <RefreshCw size={18} />
                        Tentar novamente
                    </button>
                    <Link href="/dashboard" className="dash-btn secondary">
                        <Home size={18} />
                        Voltar ao Dashboard
                    </Link>
                </div>

                {process.env.NODE_ENV === 'development' && (
                    <div style={styles.debug}>
                        <Bug size={14} />
                        <span><strong>{error.name}:</strong> {error.message}</span>
                    </div>
                )}

                <p style={styles.errorCode}>
                    Código do erro: {errorId}
                </p>
            </div>
        </div>
    );
}
