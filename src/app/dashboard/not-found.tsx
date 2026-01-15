/**
 * Página 404 - Dashboard
 * 
 * Exibida quando o usuário acessa uma URL que não existe dentro do dashboard.
 */

import Link from "next/link";
import { Home, MessageSquare, Bot, Smartphone, FileQuestion } from "lucide-react";

const styles = {
    container: {
        minHeight: '50vh',
        display: 'flex',
        flexDirection: 'column' as const,
        alignItems: 'center',
        justifyContent: 'center',
        textAlign: 'center' as const,
        padding: '40px 20px',
    } as React.CSSProperties,
    icon: {
        width: '100px',
        height: '100px',
        borderRadius: '50%',
        background: 'rgba(100, 116, 139, 0.1)',
        color: '#64748b',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: '24px',
    } as React.CSSProperties,
    title: {
        color: '#f1f5f9',
        fontSize: '24px',
        fontWeight: 600,
        marginBottom: '8px',
    } as React.CSSProperties,
    text: {
        color: '#94a3b8',
        fontSize: '15px',
        marginBottom: '32px',
    } as React.CSSProperties,
    links: {
        display: 'flex',
        gap: '12px',
        flexWrap: 'wrap' as const,
        justifyContent: 'center',
    } as React.CSSProperties,
};

export default function DashboardNotFound() {
    return (
        <div style={styles.container}>
            <div style={styles.icon}>
                <FileQuestion size={48} />
            </div>

            <h2 style={styles.title}>Página não encontrada</h2>
            <p style={styles.text}>
                Esta página não existe ou você não tem permissão para acessá-la.
            </p>

            <div style={styles.links}>
                <Link href="/dashboard" className="dash-btn primary">
                    <Home size={18} />
                    Dashboard
                </Link>
                <Link href="/dashboard/conversations" className="dash-btn secondary">
                    <MessageSquare size={18} />
                    Conversas
                </Link>
                <Link href="/dashboard/agents" className="dash-btn secondary">
                    <Bot size={18} />
                    Agentes
                </Link>
                <Link href="/dashboard/whatsapp" className="dash-btn secondary">
                    <Smartphone size={18} />
                    WhatsApp
                </Link>
            </div>
        </div>
    );
}
