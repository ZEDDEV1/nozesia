"use client";

/**
 * Error Boundary para páginas
 * 
 * Esta página é exibida quando ocorre um erro em qualquer página.
 * Diferente do global-error.tsx, este mantém o layout da aplicação.
 */

import { useEffect, useId } from "react";
import Link from "next/link";
import { AlertTriangle, RefreshCw, Home, ArrowLeft, Bug } from "lucide-react";
import * as Sentry from "@sentry/nextjs";

const styles = {
    container: {
        minHeight: '60vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '40px 20px',
    } as React.CSSProperties,
    card: {
        background: 'rgba(255, 255, 255, 0.03)',
        border: '1px solid rgba(239, 68, 68, 0.2)',
        borderRadius: '16px',
        padding: '48px',
        maxWidth: '500px',
        width: '100%',
        textAlign: 'center' as const,
    } as React.CSSProperties,
    icon: {
        width: '72px',
        height: '72px',
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
    subtitle: {
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
    btnPrimary: {
        display: 'inline-flex',
        alignItems: 'center',
        gap: '8px',
        background: 'linear-gradient(135deg, #10b981, #06b6d4)',
        color: 'white',
        fontWeight: 500,
        fontSize: '14px',
        padding: '10px 20px',
        borderRadius: '8px',
        border: 'none',
        cursor: 'pointer',
        textDecoration: 'none',
    } as React.CSSProperties,
    btnSecondary: {
        display: 'inline-flex',
        alignItems: 'center',
        gap: '8px',
        background: 'rgba(255, 255, 255, 0.05)',
        border: '1px solid rgba(255, 255, 255, 0.1)',
        color: '#94a3b8',
        fontWeight: 500,
        fontSize: '14px',
        padding: '10px 20px',
        borderRadius: '8px',
        cursor: 'pointer',
        textDecoration: 'none',
    } as React.CSSProperties,
    errorBox: {
        marginTop: '28px',
        padding: '16px',
        background: 'rgba(0, 0, 0, 0.3)',
        borderRadius: '8px',
        fontSize: '12px',
        color: '#64748b',
        fontFamily: 'monospace',
        textAlign: 'left' as const,
        maxHeight: '100px',
        overflow: 'auto',
    } as React.CSSProperties,
    errorId: {
        marginTop: '20px',
        fontSize: '11px',
        color: '#475569',
    } as React.CSSProperties,
};

export default function Error({
    error,
    reset,
}: {
    error: Error & { digest?: string };
    reset: () => void;
}) {
    const generatedId = useId();

    useEffect(() => {
        // Send error to Sentry
        Sentry.captureException(error);
        console.error("[PageError]", error);
    }, [error]);

    const errorId = error.digest || generatedId;

    return (
        <div style={styles.container}>
            <div style={styles.card}>
                <div style={styles.icon}>
                    <AlertTriangle size={36} />
                </div>

                <h2 style={styles.title}>Erro ao carregar página</h2>
                <p style={styles.subtitle}>
                    Algo inesperado aconteceu ao carregar esta página.
                    Tente novamente ou volte para a página anterior.
                </p>

                <div style={styles.actions}>
                    <button onClick={reset} style={styles.btnPrimary}>
                        <RefreshCw size={16} />
                        Tentar novamente
                    </button>
                    <button
                        onClick={() => window.history.back()}
                        style={styles.btnSecondary}
                    >
                        <ArrowLeft size={16} />
                        Voltar
                    </button>
                    <Link href="/dashboard" style={styles.btnSecondary}>
                        <Home size={16} />
                        Dashboard
                    </Link>
                </div>

                {process.env.NODE_ENV === 'development' && (
                    <div style={styles.errorBox}>
                        <strong style={{ color: '#ef4444' }}>
                            <Bug size={12} style={{ display: 'inline', marginRight: '6px' }} />
                            {error.name}:
                        </strong>{' '}
                        {error.message}
                    </div>
                )}

                <p style={styles.errorId}>
                    Código: {errorId}
                </p>
            </div>
        </div>
    );
}
