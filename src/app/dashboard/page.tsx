"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import {
    MessageCircle,
    Bot,
    Smartphone,
    BookOpen,
    Clock
} from "lucide-react";
import { formatTime } from "@/lib/utils";
import { useConversationsListSocket } from "@/lib/socket-client";
import { StatCard } from "@/components/stat-card";
import { WhatsAppStatus } from "@/components/whatsapp-status";
import { DashboardSkeleton } from "@/components/skeleton";

interface RecentConversation {
    id: string;
    customerName: string;
    customerPhone: string;
    lastMessage: string;
    lastMessageAt: string;
    unreadCount: number;
    status: string;
}

interface DashboardData {
    stats: {
        agents: number;
        activeAgents: number;
        sessions: number;
        connectedSessions: number;
        conversations: number;
        waitingResponse: number;
        messages: number;
        trainingData: number;
    };
    trends?: {
        conversations: number | null;
        messages: number | null;
    };
    recentConversations: RecentConversation[];
    subscription: {
        planName: string;
        planType: string;
        status: string;
        maxAgents: number;
        maxSessions: number;
        maxMessages: number;
    } | null;
}

export default function DashboardPage() {
    const [data, setData] = useState<DashboardData | null>(null);
    const [loading, setLoading] = useState(true);
    const [companyId, setCompanyId] = useState<string>("");
    const [recentConversations, setRecentConversations] = useState<RecentConversation[]>([]);

    useEffect(() => {
        // Buscar dados iniciais e companyId
        Promise.all([
            fetchDashboardData(),
            fetchCompanyId()
        ]);
    }, []);

    const fetchCompanyId = async () => {
        try {
            const res = await fetch("/api/auth/me");
            const result = await res.json();
            if (result.success && result.data.companyId) {
                setCompanyId(result.data.companyId);
            }
        } catch (error) {
            console.error("Error fetching companyId:", error);
        }
    };

    const fetchDashboardData = async () => {
        try {
            const response = await fetch("/api/dashboard");
            const result = await response.json();

            if (result.success) {
                setData(result.data);
                setRecentConversations(result.data.recentConversations || []);
            }
        } catch (error) {
            console.error("Error fetching dashboard data:", error);
        } finally {
            setLoading(false);
        }
    };

    // WebSocket para atualizações em tempo real das conversas recentes
    useConversationsListSocket({
        companyId,
        onNewMessage: useCallback((conversationId: string, message: { content?: string; createdAt: string; sender: string }) => {
            console.log("[Dashboard] New message received:", conversationId);

            // Atualizar conversa existente ou mover para o topo
            setRecentConversations(prev => {
                const existingIndex = prev.findIndex(c => c.id === conversationId);

                if (existingIndex >= 0) {
                    // Atualiza a conversa existente
                    const updated = [...prev];
                    updated[existingIndex] = {
                        ...updated[existingIndex],
                        lastMessage: message.content?.substring(0, 50) || "Nova mensagem",
                        lastMessageAt: message.createdAt,
                        unreadCount: updated[existingIndex].unreadCount + (message.sender === "CUSTOMER" ? 1 : 0),
                    };
                    // Move para o topo
                    const [moved] = updated.splice(existingIndex, 1);
                    return [moved, ...updated];
                }

                return prev;
            });

            // Incrementa contador de mensagens
            setData(prev => prev ? {
                ...prev,
                stats: {
                    ...prev.stats,
                    messages: prev.stats.messages + 1,
                }
            } : null);
        }, []),
        onNewConversation: useCallback((conv: { id: string; customerName: string | null; customerPhone: string; lastMessageAt: string; status: string }) => {
            console.log("[Dashboard] New conversation:", conv.customerPhone);

            // Adiciona nova conversa no topo
            setRecentConversations(prev => {
                if (prev.some(c => c.id === conv.id)) return prev;

                const newConv: RecentConversation = {
                    id: conv.id,
                    customerName: conv.customerName || conv.customerPhone,
                    customerPhone: conv.customerPhone,
                    lastMessage: "Nova conversa",
                    lastMessageAt: conv.lastMessageAt,
                    unreadCount: 1,
                    status: conv.status,
                };

                return [newConv, ...prev.slice(0, 4)]; // Mantém apenas 5 mais recentes
            });

            // Incrementa contador de conversas
            setData(prev => prev ? {
                ...prev,
                stats: {
                    ...prev.stats,
                    conversations: prev.stats.conversations + 1,
                }
            } : null);
        }, []),
    });

    if (loading) {
        return <DashboardSkeleton />;
    }

    const stats = data?.stats || {
        agents: 0,
        activeAgents: 0,
        sessions: 0,
        connectedSessions: 0,
        conversations: 0,
        waitingResponse: 0,
        messages: 0,
        trainingData: 0,
    };

    // Usar trends dinâmicos da API (ou null se não disponível)
    const trends = data?.trends;

    const statsCards = [
        {
            title: "Conversas",
            value: stats.conversations,
            icon: MessageCircle,
            color: "emerald" as const,
            trend: trends?.conversations !== null && trends?.conversations !== undefined
                ? { value: trends.conversations, label: "vs mês anterior" }
                : undefined
        },
        {
            title: "Aguardando",
            value: stats.waitingResponse,
            icon: Clock,
            color: "amber" as const,
            href: "/dashboard/awaiting-response",
            trend: stats.waitingResponse > 0 ? { value: stats.waitingResponse, label: "precisam atenção" } : undefined
        },
        {
            title: "Agentes de IA",
            value: `${stats.activeAgents}/${stats.agents}`,
            icon: Bot,
            color: "purple" as const,
            trend: stats.agents > 0 ? { value: 0, label: "ativos" } : undefined
        },
        {
            title: "WhatsApp",
            value: `${stats.connectedSessions}/${stats.sessions}`,
            icon: Smartphone,
            color: "cyan" as const,
            trend: stats.sessions > 0
                ? { value: stats.connectedSessions === stats.sessions ? 0 : Math.round((stats.connectedSessions / stats.sessions) * 100 - 100), label: "conectados" }
                : undefined
        },
    ];

    return (
        <div className="dash-fade-in">
            {/* Page Header */}
            <div className="dash-page-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                    <h1 className="dash-page-title">Dashboard</h1>
                    <p className="dash-page-subtitle">Visão geral do seu atendimento</p>
                </div>
                {data?.subscription && (
                    <div className="dash-plan-badge">
                        Plano {data.subscription.planName}
                    </div>
                )}
            </div>

            {/* Stats Grid */}
            <div className="dash-stats-grid" style={{ marginBottom: '1.5rem' }}>
                {statsCards.map((stat, index) => (
                    <StatCard
                        key={index}
                        title={stat.title}
                        value={stat.value}
                        icon={stat.icon}
                        color={stat.color}
                        trend={stat.trend}
                        index={index}
                        href={stat.href}
                    />
                ))}
            </div>

            {/* Main Content Grid */}
            <div className="dash-grid-2">
                {/* Recent Conversations */}
                <div className="dash-card">
                    <div className="dash-card-header">
                        <h3 className="dash-card-title">
                            <MessageCircle />
                            Conversas Recentes
                        </h3>
                    </div>
                    <div className="dash-card-content">
                        {recentConversations && recentConversations.length > 0 ? (
                            <div className="dash-list">
                                {recentConversations.map((conv) => (
                                    <Link
                                        key={conv.id}
                                        href="/dashboard/conversations"
                                        className="dash-list-item"
                                    >
                                        <div className="dash-list-avatar">
                                            {conv.customerName.charAt(0)}
                                        </div>
                                        <div className="dash-list-content">
                                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
                                                <h4 className="dash-list-title">{conv.customerName}</h4>
                                                <span className="dash-list-meta">{formatTime(conv.lastMessageAt)}</span>
                                            </div>
                                            <p className="dash-list-subtitle">
                                                {conv.lastMessage || "Sem mensagens"}
                                            </p>
                                        </div>
                                        {conv.unreadCount > 0 && (
                                            <span className="dash-list-badge success">{conv.unreadCount}</span>
                                        )}
                                    </Link>
                                ))}
                            </div>
                        ) : (
                            <div className="dash-empty">
                                <MessageCircle className="dash-empty-icon" />
                                <h4 className="dash-empty-title">Nenhuma conversa ainda</h4>
                                <p className="dash-empty-text">As conversas aparecerão aqui quando você conectar o WhatsApp</p>
                            </div>
                        )}
                    </div>
                </div>

                {/* Right Column */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                    {/* WhatsApp Status */}
                    <WhatsAppStatus />

                    {/* Quick Actions */}
                    <div className="dash-card">
                        <div className="dash-card-header">
                            <h3 className="dash-card-title">Ações Rápidas</h3>
                        </div>
                        <div className="dash-card-content">
                            <Link href="/dashboard/agents/new" className="dash-action-card highlight">
                                <div className="dash-action-icon emerald">
                                    <Bot />
                                </div>
                                <div>
                                    <h4 className="dash-action-title">Criar Agente</h4>
                                    <p className="dash-action-subtitle">Novo agente de IA</p>
                                </div>
                            </Link>

                            <Link href="/dashboard/whatsapp" className="dash-action-card">
                                <div className="dash-action-icon cyan">
                                    <Smartphone />
                                </div>
                                <div>
                                    <h4 className="dash-action-title">Conectar WhatsApp</h4>
                                    <p className="dash-action-subtitle">Adicionar número</p>
                                </div>
                            </Link>

                            {stats.agents > 0 && stats.trainingData === 0 && (
                                <Link href="/dashboard/agents" className="dash-action-card">
                                    <div className="dash-action-icon amber">
                                        <BookOpen />
                                    </div>
                                    <div>
                                        <h4 className="dash-action-title">Treinar Agente</h4>
                                        <p className="dash-action-subtitle" style={{ color: '#fbbf24' }}>
                                            Adicione conhecimento ao seu agente
                                        </p>
                                    </div>
                                </Link>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
