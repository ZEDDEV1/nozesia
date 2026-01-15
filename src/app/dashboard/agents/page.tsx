"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
    Bot,
    Plus,
    Settings,
    Trash2,
    ToggleLeft,
    ToggleRight,
    MessageSquare,
    BookOpen
} from "lucide-react";

interface Agent {
    id: string;
    name: string;
    description: string | null;
    personality: string;
    isActive: boolean;
    isDefault: boolean;
    _count: {
        trainingData: number;
        conversations: number;
    };
}

export default function AgentsPage() {
    const [agents, setAgents] = useState<Agent[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    useEffect(() => {
        fetchAgents();
    }, []);

    const fetchAgents = async () => {
        try {
            const response = await fetch("/api/agents");
            const data = await response.json();

            if (data.success) {
                setAgents(data.data);
            } else {
                setError(data.error || "Erro ao carregar agentes");
            }
        } catch {
            setError("Erro de conexão");
        } finally {
            setLoading(false);
        }
    };

    const toggleAgent = async (id: string, isActive: boolean) => {
        try {
            const response = await fetch(`/api/agents/${id}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ isActive: !isActive }),
            });

            const data = await response.json();
            if (data.success) {
                setAgents(agents.map((agent) =>
                    agent.id === id ? { ...agent, isActive: !isActive } : agent
                ));
            }
        } catch {
            setError("Erro ao atualizar agente");
        }
    };

    const deleteAgent = async (id: string) => {
        if (!confirm("Tem certeza que deseja excluir este agente?")) return;

        try {
            const response = await fetch(`/api/agents/${id}`, { method: "DELETE" });
            const data = await response.json();

            if (data.success) {
                setAgents(agents.filter((a) => a.id !== id));
            } else {
                setError(data.error);
            }
        } catch {
            setError("Erro ao excluir agente");
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
            {/* Page Header */}
            <div className="dash-page-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
                <div>
                    <h1 className="dash-page-title">Agentes de IA</h1>
                    <p className="dash-page-subtitle">Gerencie seus agentes de atendimento</p>
                </div>
                <Link href="/dashboard/agents/new" className="dash-btn primary">
                    <Plus />
                    Criar Agente
                </Link>
            </div>

            {/* Error */}
            {error && (
                <div style={{
                    padding: '1rem',
                    background: 'rgba(239, 68, 68, 0.1)',
                    border: '1px solid rgba(239, 68, 68, 0.2)',
                    borderRadius: '12px',
                    color: '#f87171',
                    marginBottom: '1.5rem'
                }}>
                    {error}
                </div>
            )}

            {/* Stats */}
            <div className="dash-stats-grid-auto" style={{ marginBottom: '1.5rem' }}>
                <div className="dash-stat-card">
                    <div className="dash-stat-header">
                        <div>
                            <div className="dash-stat-label">Agentes Ativos</div>
                            <div className="dash-stat-value">{agents.filter(a => a.isActive).length}</div>
                        </div>
                        <div className="dash-stat-icon emerald"><Bot /></div>
                    </div>
                </div>
                <div className="dash-stat-card">
                    <div className="dash-stat-header">
                        <div>
                            <div className="dash-stat-label">Conversas Totais</div>
                            <div className="dash-stat-value">{agents.reduce((acc, a) => acc + a._count.conversations, 0)}</div>
                        </div>
                        <div className="dash-stat-icon cyan"><MessageSquare /></div>
                    </div>
                </div>
                <div className="dash-stat-card">
                    <div className="dash-stat-header">
                        <div>
                            <div className="dash-stat-label">Treinamentos</div>
                            <div className="dash-stat-value">{agents.reduce((acc, a) => acc + a._count.trainingData, 0)}</div>
                        </div>
                        <div className="dash-stat-icon purple"><BookOpen /></div>
                    </div>
                </div>
            </div>

            {/* Agents List */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {agents.map((agent) => (
                    <div
                        key={agent.id}
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
                        <div className="dash-card-content dash-agent-card-content" style={{ display: 'flex', alignItems: 'flex-start', gap: '1rem' }}>
                            {/* Avatar */}
                            <div style={{
                                width: 56,
                                height: 56,
                                borderRadius: 12,
                                background: agent.isActive
                                    ? 'linear-gradient(135deg, #10b981, #059669)'
                                    : '#475569',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                flexShrink: 0
                            }}>
                                <Bot style={{ width: 28, height: 28, color: 'white' }} />
                            </div>

                            {/* Info */}
                            <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
                                    <Link href={`/dashboard/agents/${agent.id}`} style={{ textDecoration: 'none' }}>
                                        <h3 style={{ fontSize: '1.1rem', fontWeight: 600, color: 'white', margin: 0 }}>
                                            {agent.name}
                                        </h3>
                                    </Link>
                                    {agent.isDefault && (
                                        <span className="dash-list-badge success">Padrão</span>
                                    )}
                                    <span className={`dash-list-badge ${agent.isActive ? 'success' : ''}`}>
                                        {agent.isActive ? 'Ativo' : 'Inativo'}
                                    </span>
                                </div>
                                <p style={{ color: '#94a3b8', fontSize: '0.9rem', marginBottom: '0.75rem' }}>
                                    {agent.description || "Sem descrição"}
                                </p>

                                {/* Stats */}
                                <div style={{ display: 'flex', gap: '1.5rem', fontSize: '0.85rem', color: '#94a3b8' }}>
                                    <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                        <MessageSquare style={{ width: 16, height: 16 }} />
                                        {agent._count.conversations} conversas
                                    </span>
                                    <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                        <BookOpen style={{ width: 16, height: 16 }} />
                                        {agent._count.trainingData} treinamentos
                                    </span>
                                </div>
                            </div>

                            {/* Actions */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                <button
                                    onClick={() => toggleAgent(agent.id, agent.isActive)}
                                    style={{
                                        padding: '0.5rem',
                                        background: 'none',
                                        border: 'none',
                                        cursor: 'pointer',
                                        borderRadius: 8
                                    }}
                                >
                                    {agent.isActive ? (
                                        <ToggleRight style={{ width: 24, height: 24, color: '#34d399' }} />
                                    ) : (
                                        <ToggleLeft style={{ width: 24, height: 24, color: '#94a3b8' }} />
                                    )}
                                </button>
                                <Link href={`/dashboard/agents/${agent.id}`}>
                                    <button style={{
                                        padding: '0.5rem',
                                        background: 'none',
                                        border: 'none',
                                        cursor: 'pointer',
                                        borderRadius: 8,
                                        color: '#94a3b8'
                                    }}>
                                        <Settings style={{ width: 20, height: 20 }} />
                                    </button>
                                </Link>
                                <button
                                    onClick={() => deleteAgent(agent.id)}
                                    style={{
                                        padding: '0.5rem',
                                        background: 'none',
                                        border: 'none',
                                        cursor: 'pointer',
                                        borderRadius: 8,
                                        color: '#94a3b8'
                                    }}
                                >
                                    <Trash2 style={{ width: 20, height: 20 }} />
                                </button>
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            {/* Empty State */}
            {agents.length === 0 && (
                <div className="dash-card">
                    <div className="dash-empty">
                        <Bot className="dash-empty-icon" />
                        <h4 className="dash-empty-title">Nenhum agente criado</h4>
                        <p className="dash-empty-text" style={{ marginBottom: '1.5rem' }}>
                            Crie seu primeiro agente de IA para começar a atender automaticamente.
                        </p>
                        <Link href="/dashboard/agents/new" className="dash-btn primary">
                            <Plus />
                            Criar Primeiro Agente
                        </Link>
                    </div>
                </div>
            )}
        </div>
    );
}
