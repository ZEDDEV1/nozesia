"use client";

import { useState, useEffect } from "react";
import {
    Smartphone,
    Plus,
    QrCode,
    RefreshCw,
    Wifi,
    WifiOff,
    AlertTriangle,
    CheckCircle,
    X,
    Power,
    PowerOff,
    Lock,
    Crown,
    Trash2
} from "lucide-react";
import ExtraPurchaseModal from "@/components/ExtraPurchaseModal";

interface WhatsAppSession {
    id: string;
    sessionName: string;
    phoneNumber: string | null;
    status: "DISCONNECTED" | "CONNECTING" | "QR_CODE" | "CONNECTED" | "ERROR";
    qrCode: string | null;
    lastSeenAt: string | null;
}

export default function WhatsAppPage() {
    const [sessions, setSessions] = useState<WhatsAppSession[]>([]);
    const [loading, setLoading] = useState(true);
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [newSessionName, setNewSessionName] = useState("");
    const [creating, setCreating] = useState(false);
    const [error, setError] = useState("");
    const [connecting, setConnecting] = useState<string | null>(null);
    const [activeQR, setActiveQR] = useState<{ id: string; qrCode: string } | null>(null);
    const [upgradeModal, setUpgradeModal] = useState<{ open: boolean; message: string }>({ open: false, message: "" });
    const [extraModal, setExtraModal] = useState(false);

    useEffect(() => {
        fetchSessions();
    }, []);

    useEffect(() => {
        if (!connecting) return;

        const interval = setInterval(async () => {
            try {
                const response = await fetch(`/api/whatsapp/sessions/${connecting}/connect`);
                const data = await response.json();

                if (data.success) {
                    if (data.data.status === "CONNECTED") {
                        setConnecting(null);
                        setActiveQR(null);
                        fetchSessions();
                    } else if (data.data.qrCode) {
                        setActiveQR({ id: connecting, qrCode: data.data.qrCode });
                    }
                }
            } catch (err) {
                console.error("Error polling QR:", err);
            }
        }, 3000);

        return () => clearInterval(interval);
    }, [connecting]);

    const fetchSessions = async () => {
        try {
            const response = await fetch("/api/whatsapp/sessions");
            const data = await response.json();

            if (data.success) {
                setSessions(data.data);
            }
        } catch {
            setError("Erro ao carregar sessões");
        } finally {
            setLoading(false);
        }
    };

    const getStatusClass = (status: string) => {
        switch (status) {
            case "CONNECTED": return "success";
            case "CONNECTING": return "warning";
            case "QR_CODE": return "warning";
            case "ERROR": return "error";
            default: return "";
        }
    };

    const getStatusIcon = (status: string) => {
        switch (status) {
            case "CONNECTED": return <Wifi />;
            case "CONNECTING": return <RefreshCw style={{ animation: 'spin 1s linear infinite' }} />;
            case "QR_CODE": return <QrCode />;
            case "ERROR": return <AlertTriangle />;
            default: return <WifiOff />;
        }
    };

    const getStatusLabel = (status: string) => {
        switch (status) {
            case "CONNECTED": return "Conectado";
            case "CONNECTING": return "Conectando...";
            case "QR_CODE": return "Escaneie o QR Code";
            case "ERROR": return "Erro na conexão";
            default: return "Desconectado";
        }
    };

    const handleCreateSession = async (e: React.FormEvent) => {
        e.preventDefault();
        setCreating(true);
        setError("");

        try {
            const response = await fetch("/api/whatsapp/sessions", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ sessionName: newSessionName }),
            });

            const data = await response.json();

            if (data.success) {
                setSessions([data.data, ...sessions]);
                setNewSessionName("");
                setShowCreateModal(false);
            } else if (response.status === 403) {
                setShowCreateModal(false);
                setUpgradeModal({
                    open: true,
                    message: data.error || "Limite de números de WhatsApp atingido"
                });
            } else {
                setError(data.error);
            }
        } catch {
            setError("Erro ao criar sessão");
        } finally {
            setCreating(false);
        }
    };

    const handleConnect = async (sessionId: string) => {
        setConnecting(sessionId);
        setError("");

        try {
            const response = await fetch(`/api/whatsapp/sessions/${sessionId}/connect`, {
                method: "POST",
            });

            const data = await response.json();

            if (data.success) {
                if (data.data.qrCode) {
                    setActiveQR({ id: sessionId, qrCode: data.data.qrCode });
                } else if (data.data.status === "CONNECTED") {
                    setConnecting(null);
                    fetchSessions();
                }
            } else {
                setError(data.error || "Erro ao conectar. Verifique se o servidor WPPConnect está rodando.");
                setConnecting(null);
            }
        } catch {
            setError("Erro ao conectar. Verifique se o servidor WPPConnect está rodando.");
            setConnecting(null);
        }
    };

    const handleDisconnect = async (sessionId: string) => {
        if (!confirm("Tem certeza que deseja desconectar?")) return;

        try {
            const response = await fetch(`/api/whatsapp/sessions/${sessionId}/connect`, {
                method: "DELETE",
            });

            const data = await response.json();

            if (data.success) {
                fetchSessions();
            } else {
                setError(data.error);
            }
        } catch {
            setError("Erro ao desconectar");
        }
    };

    const handleDeleteSession = async (sessionId: string) => {
        if (!confirm("⚠️ ATENÇÃO!\n\nIsso irá EXCLUIR permanentemente:\n• O número do WhatsApp\n• Todas as conversas deste número\n• Todas as mensagens\n• Todos os pedidos relacionados\n\nEsta ação NÃO pode ser desfeita!\n\nDeseja continuar?")) return;

        try {
            const response = await fetch(`/api/whatsapp/sessions/${sessionId}`, {
                method: "DELETE",
            });

            const data = await response.json();

            if (data.success) {
                fetchSessions();
            } else {
                setError(data.error || "Erro ao excluir sessão");
            }
        } catch {
            setError("Erro ao excluir sessão");
        }
    };

    if (loading) {
        return (
            <div className="dash-loading">
                <div className="dash-spinner" />
            </div>
        );
    }

    return (
        <div className="dash-fade-in">
            {/* Header */}
            <div className="dash-page-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
                <div>
                    <h1 className="dash-page-title">WhatsApp</h1>
                    <p className="dash-page-subtitle">Gerencie suas conexões de WhatsApp</p>
                </div>
                <button className="dash-btn primary" onClick={() => setShowCreateModal(true)}>
                    <Plus />
                    Conectar Número
                </button>
            </div>

            {/* Error */}
            {error && (
                <div style={{
                    padding: '1rem',
                    background: 'rgba(239, 68, 68, 0.1)',
                    border: '1px solid rgba(239, 68, 68, 0.2)',
                    borderRadius: '12px',
                    color: '#f87171',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    marginBottom: '1.5rem'
                }}>
                    {error}
                    <button onClick={() => setError("")} style={{ background: 'none', border: 'none', color: '#f87171', cursor: 'pointer' }}>
                        <X style={{ width: 16, height: 16 }} />
                    </button>
                </div>
            )}

            {/* QR Code Modal */}
            {activeQR && (
                <div className="dash-modal-overlay">
                    <div className="dash-modal">
                        <div className="dash-modal-header">
                            <h3 className="dash-modal-title">Escaneie o QR Code</h3>
                            <button
                                className="dash-modal-close"
                                onClick={() => { setActiveQR(null); setConnecting(null); }}
                            >
                                <X />
                            </button>
                        </div>
                        <div className="dash-modal-body" style={{ textAlign: 'center' }}>
                            <div className="dash-qr-box" style={{ marginBottom: '1rem' }}>
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img src={activeQR.qrCode} alt="QR Code para conectar WhatsApp" />
                            </div>
                            <p style={{ color: '#94a3b8', fontSize: '0.875rem', marginBottom: '1rem' }}>
                                Abra o WhatsApp no seu celular, vá em Configurações &gt; Aparelhos conectados &gt; Conectar um aparelho
                            </p>
                            <div className="dash-status connecting">
                                <span className="dash-status-dot" />
                                <span>Aguardando conexão...</span>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Create Modal */}
            {showCreateModal && (
                <div className="dash-modal-overlay">
                    <div className="dash-modal">
                        <div className="dash-modal-header">
                            <h3 className="dash-modal-title">Nova Conexão</h3>
                            <button className="dash-modal-close" onClick={() => setShowCreateModal(false)}>
                                <X />
                            </button>
                        </div>
                        <form onSubmit={handleCreateSession}>
                            <div className="dash-modal-body">
                                <div className="dash-field">
                                    <label className="dash-label">Nome da Sessão</label>
                                    <input
                                        type="text"
                                        className="dash-input"
                                        placeholder="Ex: Principal, Vendas, Suporte..."
                                        value={newSessionName}
                                        onChange={(e) => setNewSessionName(e.target.value)}
                                        required
                                    />
                                </div>
                            </div>
                            <div className="dash-modal-footer">
                                <button type="button" className="dash-btn secondary" onClick={() => setShowCreateModal(false)}>
                                    Cancelar
                                </button>
                                <button type="submit" className="dash-btn primary" disabled={creating}>
                                    {creating ? <RefreshCw style={{ animation: 'spin 1s linear infinite' }} /> : <Plus />}
                                    Criar
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Stats */}
            <div className="dash-stats-grid-auto" style={{ marginBottom: '1.5rem' }}>
                <div className="dash-stat-card">
                    <div className="dash-stat-header">
                        <div>
                            <div className="dash-stat-label">Conectados</div>
                            <div className="dash-stat-value">{sessions.filter(s => s.status === "CONNECTED").length}</div>
                        </div>
                        <div className="dash-stat-icon emerald"><CheckCircle /></div>
                    </div>
                </div>
                <div className="dash-stat-card">
                    <div className="dash-stat-header">
                        <div>
                            <div className="dash-stat-label">Pendentes</div>
                            <div className="dash-stat-value">{sessions.filter(s => s.status !== "CONNECTED").length}</div>
                        </div>
                        <div className="dash-stat-icon amber"><RefreshCw /></div>
                    </div>
                </div>
                <div className="dash-stat-card">
                    <div className="dash-stat-header">
                        <div>
                            <div className="dash-stat-label">Total</div>
                            <div className="dash-stat-value">{sessions.length}</div>
                        </div>
                        <div className="dash-stat-icon cyan"><Smartphone /></div>
                    </div>
                </div>
            </div>

            {/* Sessions List */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {sessions.map((session) => (
                    <div
                        key={session.id}
                        className="dash-card"
                        style={{ transition: 'all 0.2s ease' }}
                        onMouseEnter={(e) => {
                            e.currentTarget.style.transform = 'translateY(-2px)';
                            e.currentTarget.style.boxShadow = '0 8px 25px rgba(0, 0, 0, 0.3)';
                        }}
                        onMouseLeave={(e) => {
                            e.currentTarget.style.transform = 'translateY(0)';
                            e.currentTarget.style.boxShadow = '';
                        }}
                    >
                        <div className="dash-card-content dash-session-card" style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                            <div style={{
                                width: 56,
                                height: 56,
                                borderRadius: 12,
                                background: session.status === "CONNECTED"
                                    ? 'linear-gradient(135deg, #10b981, #059669)'
                                    : '#475569',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                flexShrink: 0
                            }}>
                                <Smartphone style={{ width: 28, height: 28, color: 'white' }} />
                            </div>

                            <div style={{ flex: 1 }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.25rem' }}>
                                    <h3 style={{ fontSize: '1.1rem', fontWeight: 600, color: 'white', margin: 0 }}>
                                        {session.sessionName}
                                    </h3>
                                    <span className={`dash-list-badge ${getStatusClass(session.status)}`} style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                                        {getStatusIcon(session.status)}
                                        {getStatusLabel(session.status)}
                                    </span>
                                </div>
                                {session.phoneNumber ? (
                                    <p style={{ color: '#94a3b8', margin: 0 }}>{session.phoneNumber}</p>
                                ) : (
                                    <p style={{ color: '#64748b', fontStyle: 'italic', margin: 0 }}>Clique em conectar para vincular</p>
                                )}
                            </div>

                            <div style={{ display: 'flex', gap: '0.5rem' }}>
                                {session.status === "CONNECTED" ? (
                                    <button
                                        className="dash-btn secondary sm"
                                        onClick={() => handleDisconnect(session.id)}
                                    >
                                        <PowerOff />
                                        Desconectar
                                    </button>
                                ) : (
                                    <button
                                        className="dash-btn primary sm"
                                        onClick={() => handleConnect(session.id)}
                                        disabled={connecting === session.id}
                                    >
                                        {connecting === session.id ? (
                                            <RefreshCw style={{ animation: 'spin 1s linear infinite' }} />
                                        ) : (
                                            <Power />
                                        )}
                                        Conectar
                                    </button>
                                )}
                                <button
                                    className="dash-btn sm"
                                    onClick={() => handleDeleteSession(session.id)}
                                    title="Excluir número"
                                    style={{
                                        background: 'rgba(220, 38, 38, 0.15)',
                                        color: '#ef4444',
                                        border: '1px solid rgba(220, 38, 38, 0.3)',
                                    }}
                                >
                                    <Trash2 />
                                </button>
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            {/* Empty State */}
            {sessions.length === 0 && (
                <div className="dash-card">
                    <div className="dash-empty">
                        <Smartphone className="dash-empty-icon" />
                        <h4 className="dash-empty-title">Nenhum número conectado</h4>
                        <p className="dash-empty-text" style={{ marginBottom: '1.5rem' }}>
                            Conecte um número de WhatsApp para começar.
                        </p>
                        <button className="dash-btn primary" onClick={() => setShowCreateModal(true)}>
                            <Plus />
                            Conectar Primeiro Número
                        </button>
                    </div>
                </div>
            )}

            {/* Upgrade Modal */}
            {upgradeModal.open && (
                <div
                    className="dash-modal-overlay"
                    onClick={() => setUpgradeModal({ open: false, message: "" })}
                >
                    <div
                        className="dash-modal"
                        style={{ maxWidth: 480 }}
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="dash-modal-header">
                            <h3 className="dash-modal-title" style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                <Lock style={{ width: 20, height: 20, color: "#f59e0b" }} />
                                Limite Atingido
                            </h3>
                            <button
                                className="dash-modal-close"
                                onClick={() => setUpgradeModal({ open: false, message: "" })}
                            >
                                <X />
                            </button>
                        </div>
                        <div className="dash-modal-body">
                            <div style={{ textAlign: "center", marginBottom: 24 }}>
                                <div style={{
                                    width: 64,
                                    height: 64,
                                    borderRadius: "50%",
                                    background: "rgba(245, 158, 11, 0.15)",
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    margin: "0 auto 16px"
                                }}>
                                    <Smartphone style={{ width: 28, height: 28, color: "#f59e0b" }} />
                                </div>
                                <p style={{ color: "#94a3b8", fontSize: 14, margin: 0 }}>
                                    {upgradeModal.message}
                                </p>
                            </div>

                            <div style={{
                                background: "rgba(16, 185, 129, 0.1)",
                                border: "1px solid rgba(16, 185, 129, 0.2)",
                                borderRadius: 12,
                                padding: 16,
                                marginBottom: 16
                            }}>
                                <p style={{ color: "#34d399", fontSize: 14, fontWeight: 600, margin: "0 0 8px" }}>
                                    💡 O que você pode fazer:
                                </p>
                                <ul style={{ color: "#94a3b8", fontSize: 13, margin: 0, paddingLeft: 20 }}>
                                    <li><strong>Fazer upgrade</strong> para um plano com mais números</li>
                                    <li><strong>Adicionar um número extra</strong> por R$29,99/mês</li>
                                    <li>Desconectar um número existente para liberar espaço</li>
                                </ul>
                            </div>
                        </div>
                        <div className="dash-modal-footer" style={{ justifyContent: "center", gap: 8, flexWrap: "wrap" }}>
                            <button
                                className="dash-btn secondary"
                                onClick={() => setUpgradeModal({ open: false, message: "" })}
                            >
                                Entendi
                            </button>
                            <button
                                className="dash-btn primary"
                                style={{ background: "linear-gradient(135deg, #a855f7, #7c3aed)" }}
                                onClick={() => {
                                    setUpgradeModal({ open: false, message: "" });
                                    setExtraModal(true);
                                }}
                            >
                                <Plus style={{ width: 16, height: 16 }} />
                                Adicionar Extra
                            </button>
                            <button
                                className="dash-btn primary"
                                onClick={() => window.location.href = "/dashboard/billing"}
                            >
                                <Crown style={{ width: 16, height: 16 }} />
                                Ver Planos
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Extra Purchase Modal */}
            <ExtraPurchaseModal
                isOpen={extraModal}
                type="whatsapp"
                onClose={() => setExtraModal(false)}
            />
        </div>
    );
}
