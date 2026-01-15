/**
 * Página 404 - Not Found
 * 
 * Exibida quando o usuário acessa uma URL que não existe.
 */

import Link from "next/link";
import { Home, Search, ArrowLeft } from "lucide-react";

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
        textAlign: 'center' as const,
        maxWidth: '500px',
    } as React.CSSProperties,
    code: {
        fontSize: '120px',
        fontWeight: 700,
        background: 'linear-gradient(135deg, #10b981, #06b6d4)',
        WebkitBackgroundClip: 'text',
        WebkitTextFillColor: 'transparent',
        lineHeight: 1,
        marginBottom: '16px',
    } as React.CSSProperties,
    title: {
        color: '#f1f5f9',
        fontSize: '28px',
        fontWeight: 600,
        marginBottom: '12px',
    } as React.CSSProperties,
    subtitle: {
        color: '#94a3b8',
        fontSize: '16px',
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
        textDecoration: 'none',
    } as React.CSSProperties,
    suggestions: {
        marginTop: '48px',
        padding: '24px',
        background: 'rgba(255, 255, 255, 0.02)',
        borderRadius: '12px',
        border: '1px solid rgba(255, 255, 255, 0.05)',
    } as React.CSSProperties,
    suggestionsTitle: {
        color: '#64748b',
        fontSize: '13px',
        marginBottom: '16px',
        textTransform: 'uppercase' as const,
        letterSpacing: '0.05em',
    } as React.CSSProperties,
    links: {
        display: 'flex',
        flexDirection: 'column' as const,
        gap: '8px',
    } as React.CSSProperties,
    link: {
        color: '#10b981',
        fontSize: '14px',
        textDecoration: 'none',
    } as React.CSSProperties,
};

export default function NotFound() {
    return (
        <div style={styles.page}>
            <div style={styles.card}>
                <div style={styles.code}>404</div>
                <h1 style={styles.title}>Página não encontrada</h1>
                <p style={styles.subtitle}>
                    A página que você está procurando não existe ou foi movida para outro endereço.
                </p>

                <div style={styles.actions}>
                    <Link href="/" style={styles.btnPrimary}>
                        <Home size={18} />
                        Página inicial
                    </Link>
                    <Link href="/dashboard" style={styles.btnSecondary}>
                        <ArrowLeft size={18} />
                        Dashboard
                    </Link>
                </div>

                <div style={styles.suggestions}>
                    <p style={styles.suggestionsTitle}>
                        <Search size={14} style={{ display: 'inline', marginRight: '8px' }} />
                        Páginas populares
                    </p>
                    <div style={styles.links}>
                        <Link href="/dashboard" style={styles.link}>→ Dashboard</Link>
                        <Link href="/dashboard/conversations" style={styles.link}>→ Conversas</Link>
                        <Link href="/dashboard/agents" style={styles.link}>→ Agentes de IA</Link>
                        <Link href="/dashboard/whatsapp" style={styles.link}>→ WhatsApp</Link>
                    </div>
                </div>
            </div>
        </div>
    );
}
