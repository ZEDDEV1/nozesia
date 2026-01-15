"use client";

/**
 * Notification Permission Request Component
 * 
 * Shows a banner prompting users to enable notifications.
 */

import { useState, useEffect } from "react";
import { Bell, X, Check } from "lucide-react";
import {
    isNotificationSupported,
    getNotificationPermission,
    requestNotificationPermission,
    registerServiceWorker,
} from "@/lib/notifications";

const styles = {
    banner: {
        background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.15), rgba(139, 92, 246, 0.15))',
        border: '1px solid rgba(59, 130, 246, 0.3)',
        borderRadius: '12px',
        padding: '16px 20px',
        display: 'flex',
        alignItems: 'center',
        gap: '16px',
        marginBottom: '20px',
    } as React.CSSProperties,
    icon: {
        width: '44px',
        height: '44px',
        borderRadius: '12px',
        background: 'rgba(59, 130, 246, 0.2)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: '#3b82f6',
        flexShrink: 0,
    } as React.CSSProperties,
    content: {
        flex: 1,
    } as React.CSSProperties,
    title: {
        color: '#f1f5f9',
        fontSize: '14px',
        fontWeight: 600,
        marginBottom: '4px',
    } as React.CSSProperties,
    description: {
        color: '#94a3b8',
        fontSize: '13px',
    } as React.CSSProperties,
    actions: {
        display: 'flex',
        gap: '8px',
    } as React.CSSProperties,
    btnPrimary: {
        display: 'flex',
        alignItems: 'center',
        gap: '6px',
        background: '#3b82f6',
        color: 'white',
        fontSize: '13px',
        fontWeight: 500,
        padding: '8px 14px',
        borderRadius: '8px',
        border: 'none',
        cursor: 'pointer',
    } as React.CSSProperties,
    btnClose: {
        background: 'rgba(255, 255, 255, 0.05)',
        border: '1px solid rgba(255, 255, 255, 0.1)',
        color: '#64748b',
        padding: '8px',
        borderRadius: '8px',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
    } as React.CSSProperties,
    granted: {
        background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.15), rgba(6, 182, 212, 0.15))',
        border: '1px solid rgba(16, 185, 129, 0.3)',
    } as React.CSSProperties,
    grantedIcon: {
        background: 'rgba(16, 185, 129, 0.2)',
        color: '#10b981',
    } as React.CSSProperties,
};

export function NotificationPermissionBanner() {
    const [visible, setVisible] = useState(false);
    const [status, setStatus] = useState<'prompt' | 'granted' | 'denied' | 'unsupported'>('prompt');
    const [loading, setLoading] = useState(false);

    const checkPermission = () => {
        if (!isNotificationSupported()) {
            setStatus('unsupported');
            return;
        }

        const permission = getNotificationPermission();

        if (permission === 'default') {
            // Show banner if user hasn't decided yet
            const dismissed = localStorage.getItem('notification-banner-dismissed');
            if (!dismissed) {
                setVisible(true);
                setStatus('prompt');
            }
        } else if (permission === 'granted') {
            // Register service worker if permission granted
            registerServiceWorker();
            setStatus('granted');
        } else {
            setStatus('denied');
        }
    };

    useEffect(() => {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        checkPermission();
    }, []);

    const handleEnable = async () => {
        setLoading(true);

        // Register SW first
        await registerServiceWorker();

        // Then ask for permission
        const result = await requestNotificationPermission();

        setLoading(false);

        if (result === 'granted') {
            setStatus('granted');
            // Show success briefly, then hide
            setTimeout(() => setVisible(false), 2000);
        } else if (result === 'denied') {
            setStatus('denied');
            setVisible(false);
        }
    };

    const handleDismiss = () => {
        localStorage.setItem('notification-banner-dismissed', 'true');
        setVisible(false);
    };

    if (!visible) return null;
    if (status === 'unsupported' || status === 'denied') return null;

    if (status === 'granted') {
        return (
            <div style={{ ...styles.banner, ...styles.granted }}>
                <div style={{ ...styles.icon, ...styles.grantedIcon }}>
                    <Check size={22} />
                </div>
                <div style={styles.content}>
                    <div style={styles.title}>Notificações ativadas!</div>
                    <div style={styles.description}>
                        Você receberá alertas quando novos clientes enviarem mensagens.
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div style={styles.banner}>
            <div style={styles.icon}>
                <Bell size={22} />
            </div>
            <div style={styles.content}>
                <div style={styles.title}>Ativar notificações</div>
                <div style={styles.description}>
                    Receba alertas em tempo real quando clientes enviarem mensagens.
                </div>
            </div>
            <div style={styles.actions}>
                <button
                    onClick={handleEnable}
                    style={styles.btnPrimary}
                    disabled={loading}
                >
                    {loading ? 'Ativando...' : (
                        <>
                            <Bell size={14} />
                            Ativar
                        </>
                    )}
                </button>
                <button onClick={handleDismiss} style={styles.btnClose}>
                    <X size={16} />
                </button>
            </div>
        </div>
    );
}
