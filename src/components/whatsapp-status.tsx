"use client";

import { useEffect, useState } from "react";
import { Smartphone, Check, X, Loader2 } from "lucide-react";

interface WhatsAppSession {
    id: string;
    sessionName: string;
    status: string;
}

export function WhatsAppStatus() {
    const [sessions, setSessions] = useState<WhatsAppSession[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchSessions();

        // Auto-refresh a cada 30 segundos
        const interval = setInterval(fetchSessions, 30000);
        return () => clearInterval(interval);
    }, []);

    const fetchSessions = async () => {
        try {
            const res = await fetch("/api/whatsapp/sessions");
            const result = await res.json();
            if (result.success) {
                setSessions(result.data);
            }
        } catch (error) {
            console.error("Error fetching sessions:", error);
        } finally {
            setLoading(false);
        }
    };

    const connectedCount = sessions.filter(s => s.status === "CONNECTED").length;
    const totalCount = sessions.length;
    const allConnected = totalCount > 0 && connectedCount === totalCount;
    const someConnected = connectedCount > 0 && connectedCount < totalCount;

    return (
        <div className="dash-card">
            <div className="dash-card-header">
                <h3 className="dash-card-title">
                    <Smartphone />
                    Status WhatsApp
                </h3>
            </div>
            <div className="dash-card-content">
                {loading ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--dash-text-muted)' }}>
                        <Loader2 style={{ width: 16, height: 16, animation: 'spin 1s linear infinite' }} />
                        Verificando...
                    </div>
                ) : sessions.length === 0 ? (
                    <div className="dash-empty" style={{ padding: '2rem 1rem' }}>
                        <Smartphone className="dash-empty-icon" style={{ margin: '0 auto 1rem' }} />
                        <h4 className="dash-empty-title">Nenhum WhatsApp conectado</h4>
                        <p className="dash-empty-text">
                            Conecte seu primeiro número para começar
                        </p>
                    </div>
                ) : (
                    <div>
                        {/* Status geral */}
                        <div
                            className="whatsapp-status-summary"
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.75rem',
                                padding: '1rem',
                                borderRadius: '12px',
                                background: allConnected
                                    ? 'rgba(16, 185, 129, 0.1)'
                                    : someConnected
                                        ? 'rgba(245, 158, 11, 0.1)'
                                        : 'rgba(239, 68, 68, 0.1)',
                                border: allConnected
                                    ? '1px solid rgba(16, 185, 129, 0.2)'
                                    : someConnected
                                        ? '1px solid rgba(245, 158, 11, 0.2)'
                                        : '1px solid rgba(239, 68, 68, 0.2)',
                                marginBottom: sessions.length > 1 ? '1rem' : '0'
                            }}
                        >
                            <div
                                style={{
                                    width: 48,
                                    height: 48,
                                    borderRadius: '12px',
                                    background: allConnected
                                        ? 'linear-gradient(135deg, rgba(16, 185, 129, 0.2), rgba(5, 150, 105, 0.1))'
                                        : someConnected
                                            ? 'linear-gradient(135deg, rgba(245, 158, 11, 0.2), rgba(217, 119, 6, 0.1))'
                                            : 'linear-gradient(135deg, rgba(239, 68, 68, 0.2), rgba(220, 38, 38, 0.1))',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center'
                                }}
                            >
                                {allConnected ? (
                                    <Check style={{ width: 24, height: 24, color: '#34d399' }} />
                                ) : someConnected ? (
                                    <Smartphone style={{ width: 24, height: 24, color: '#fbbf24' }} />
                                ) : (
                                    <X style={{ width: 24, height: 24, color: '#f87171' }} />
                                )}
                            </div>
                            <div style={{ flex: 1 }}>
                                <div style={{
                                    fontSize: '0.875rem',
                                    fontWeight: 600,
                                    color: allConnected ? '#34d399' : someConnected ? '#fbbf24' : '#f87171',
                                    marginBottom: '0.25rem'
                                }}>
                                    {allConnected
                                        ? '✓ Todos conectados'
                                        : someConnected
                                            ? '⚠ Parcialmente conectado'
                                            : '✗ Desconectado'}
                                </div>
                                <div style={{ fontSize: '0.75rem', color: 'var(--dash-text-muted)' }}>
                                    {connectedCount} de {totalCount} número{totalCount > 1 ? 's' : ''}
                                </div>
                            </div>
                        </div>

                        {/* Lista de sessões (apenas se houver múltiplas) */}
                        {sessions.length > 1 && (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                {sessions.map(session => (
                                    <div
                                        key={session.id}
                                        style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'space-between',
                                            padding: '0.75rem',
                                            borderRadius: '8px',
                                            background: 'rgba(255, 255, 255, 0.03)',
                                            border: '1px solid var(--dash-border)'
                                        }}
                                    >
                                        <span style={{ fontSize: '0.875rem', color: 'var(--dash-text)' }}>
                                            {session.sessionName}
                                        </span>
                                        <span
                                            className="dash-status"
                                            style={{
                                                color: session.status === "CONNECTED" ? '#34d399' : '#64748b'
                                            }}
                                        >
                                            <span className={`dash-status-dot ${session.status === "CONNECTED" ? 'online' : 'offline'}`} />
                                            {session.status === "CONNECTED" ? "Conectado" : "Desconectado"}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
