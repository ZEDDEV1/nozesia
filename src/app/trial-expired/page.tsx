"use client";

/**
 * Trial Expired Page
 * 
 * Shown when user's trial period has ended and they need to subscribe.
 */

import { useEffect } from "react";
import Link from "next/link";
import { Clock, CreditCard, ArrowRight, Sparkles } from "lucide-react";

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
        border: '1px solid rgba(245, 158, 11, 0.2)',
        borderRadius: '20px',
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
        background: 'rgba(245, 158, 11, 0.1)',
        color: '#f59e0b',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        margin: '0 auto 24px',
    } as React.CSSProperties,
    title: {
        color: '#f1f5f9',
        fontSize: '26px',
        fontWeight: 700,
        marginBottom: '12px',
    } as React.CSSProperties,
    subtitle: {
        color: '#94a3b8',
        fontSize: '15px',
        lineHeight: 1.7,
        marginBottom: '32px',
    } as React.CSSProperties,
    benefits: {
        textAlign: 'left' as const,
        background: 'rgba(16, 185, 129, 0.05)',
        border: '1px solid rgba(16, 185, 129, 0.2)',
        borderRadius: '12px',
        padding: '20px',
        marginBottom: '28px',
    } as React.CSSProperties,
    benefitTitle: {
        color: '#10b981',
        fontSize: '14px',
        fontWeight: 600,
        marginBottom: '12px',
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
    } as React.CSSProperties,
    benefitList: {
        listStyle: 'none',
        padding: 0,
        margin: 0,
    } as React.CSSProperties,
    benefitItem: {
        color: '#94a3b8',
        fontSize: '13px',
        marginBottom: '8px',
        paddingLeft: '20px',
        position: 'relative' as const,
    } as React.CSSProperties,
    btnPrimary: {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '8px',
        width: '100%',
        background: 'linear-gradient(135deg, #10b981, #06b6d4)',
        color: 'white',
        fontWeight: 600,
        fontSize: '15px',
        padding: '14px 28px',
        borderRadius: '10px',
        border: 'none',
        cursor: 'pointer',
        textDecoration: 'none',
        marginBottom: '12px',
    } as React.CSSProperties,
    btnSecondary: {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '8px',
        width: '100%',
        background: 'transparent',
        border: '1px solid rgba(255, 255, 255, 0.1)',
        color: '#94a3b8',
        fontWeight: 500,
        fontSize: '14px',
        padding: '12px 24px',
        borderRadius: '10px',
        cursor: 'pointer',
        textDecoration: 'none',
    } as React.CSSProperties,
    footer: {
        marginTop: '28px',
        fontSize: '12px',
        color: '#475569',
    } as React.CSSProperties,
};

export default function TrialExpiredPage() {
    useEffect(() => {
        // Could fetch actual expired days from API
        // For now, just show generic message
    }, []);

    return (
        <div style={styles.page}>
            <div style={styles.card}>
                <div style={styles.icon}>
                    <Clock size={40} />
                </div>

                <h1 style={styles.title}>Período de teste encerrado</h1>
                <p style={styles.subtitle}>
                    Seu período gratuito de 7 dias terminou. Para continuar usando
                    o NozesIA e manter seu atendimento automatizado, escolha um plano.
                </p>

                <div style={styles.benefits}>
                    <div style={styles.benefitTitle}>
                        <Sparkles size={16} />
                        Ao assinar você terá:
                    </div>
                    <ul style={styles.benefitList}>
                        <li style={styles.benefitItem}>✓ Atendimento 24/7 com IA</li>
                        <li style={styles.benefitItem}>✓ Múltiplos agentes personalizados</li>
                        <li style={styles.benefitItem}>✓ Histórico completo de conversas</li>
                        <li style={styles.benefitItem}>✓ Suporte prioritário</li>
                    </ul>
                </div>

                <Link href="/dashboard/billing" style={styles.btnPrimary}>
                    <CreditCard size={18} />
                    Ver planos e assinar
                    <ArrowRight size={18} />
                </Link>

                <Link href="/login" style={styles.btnSecondary}>
                    Fazer login com outra conta
                </Link>

                <p style={styles.footer}>
                    Dúvidas? Entre em contato: contato@nozesia.com
                </p>
            </div>
        </div>
    );
}
