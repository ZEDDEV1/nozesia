"use client";

/**
 * Error Boundary Global
 * 
 * Esta página é exibida quando ocorre um erro no root layout.
 * É o fallback final para erros não capturados.
 */

import { useEffect, useId } from "react";
import Link from "next/link";
import { AlertTriangle, RefreshCw, Home, Bug } from "lucide-react";
import * as Sentry from "@sentry/nextjs";

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
        border: '1px solid rgba(239, 68, 68, 0.2)',
        borderRadius: '16px',
        padding: '48px',
        maxWidth: '500px',
        width: '100%',
        textAlign: 'center' as const,
        backdropFilter: 'blur(10px)',
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
        fontSize: '24px',
        fontWeight: 600,
        marginBottom: '12px',
    } as React.CSSProperties,
    subtitle: {
        color: '#94a3b8',
        fontSize: '15px',
        lineHeight: 1.6,
        marginBottom: '32px',
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
        padding: '12px 24px',
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
        padding: '12px 24px',
        borderRadius: '8px',
        cursor: 'pointer',
        textDecoration: 'none',
    } as React.CSSProperties,
    errorCode: {
        marginTop: '32px',
        padding: '16px',
        background: 'rgba(0, 0, 0, 0.3)',
        borderRadius: '8px',
        fontSize: '12px',
        color: '#64748b',
        fontFamily: 'monospace',
        textAlign: 'left' as const,
        maxHeight: '120px',
        overflow: 'auto',
    } as React.CSSProperties,
    errorId: {
        marginTop: '24px',
        fontSize: '12px',
        color: '#475569',
    } as React.CSSProperties,
};

export default function GlobalError({
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
        console.error("[GlobalError]", error);
    }, [error]);

    const errorId = error.digest || generatedId;

    return (
        <html>
            <body>
                <div style={styles.page}>
                    <div style={styles.card}>
                        <div style={styles.icon}>
                            <AlertTriangle size={40} />
                        </div>

                        <h1 style={styles.title}>Algo deu errado</h1>
                        <p style={styles.subtitle}>
                            Ocorreu um erro inesperado. Nossa equipe foi notificada e está
                            trabalhando para resolver. Tente novamente ou volte para a página inicial.
                        </p>

                        <div style={styles.actions}>
                            <button onClick={reset} style={styles.btnPrimary}>
                                <RefreshCw size={16} />
                                Tentar novamente
                            </button>
                            <Link href="/" style={styles.btnSecondary}>
                                <Home size={16} />
                                Página inicial
                            </Link>
                        </div>

                        {process.env.NODE_ENV === 'development' && (
                            <div style={styles.errorCode}>
                                <strong style={{ color: '#ef4444' }}>
                                    <Bug size={14} style={{ display: 'inline', marginRight: '8px' }} />
                                    {error.name}:
                                </strong>
                                <br />
                                {error.message}
                                {error.stack && (
                                    <>
                                        <br /><br />
                                        <span style={{ color: '#475569' }}>Stack:</span>
                                        <pre style={{ margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
                                            {error.stack.split('\n').slice(1, 5).join('\n')}
                                        </pre>
                                    </>
                                )}
                            </div>
                        )}

                        <p style={styles.errorId}>
                            ID do erro: {errorId}
                        </p>
                    </div>
                </div>
            </body>
        </html>
    );
}
