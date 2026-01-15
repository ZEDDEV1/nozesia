"use client";

import { useState, useEffect } from "react";
import {
    Smartphone,
    Wifi,
    WifiOff,
    RefreshCw,
    Building2,
    MessageCircle,
    Clock,
    Signal,
    AlertCircle,
    CheckCircle2,
    QrCode,
    Sparkles
} from "lucide-react";
import { formatDate, cn } from "@/lib/utils";

interface WhatsAppSession {
    id: string;
    sessionName: string;
    phoneNumber: string | null;
    status: string;
    company: {
        id: string;
        name: string;
        email: string;
    };
    conversationsCount: number;
    lastSeenAt: string | null;
    createdAt: string;
    updatedAt: string;
}

interface Stats {
    total: number;
    connected: number;
    disconnected: number;
    connecting: number;
}

export default function AdminWhatsAppPage() {
    const [sessions, setSessions] = useState<WhatsAppSession[]>([]);
    const [stats, setStats] = useState<Stats | null>(null);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState("all");

    useEffect(() => {
        fetchSessions();
    }, []);

    const fetchSessions = async () => {
        try {
            setLoading(true);
            const response = await fetch("/api/admin/whatsapp");
            const data = await response.json();
            if (data.success) {
                setSessions(data.data.sessions);
                setStats(data.data.stats);
            }
        } catch (error) {
            console.error("Error fetching sessions:", error);
        } finally {
            setLoading(false);
        }
    };

    const getStatusStyle = (status: string) => {
        switch (status) {
            case "CONNECTED":
                return {
                    icon: <Wifi className="w-4 h-4" />,
                    badge: "active",
                    label: "Conectado"
                };
            case "CONNECTING":
                return {
                    icon: <RefreshCw className="w-4 h-4 animate-spin" />,
                    badge: "pending",
                    label: "Conectando"
                };
            case "QR_CODE":
                return {
                    icon: <QrCode className="w-4 h-4" />,
                    badge: "pending",
                    label: "QR Code"
                };
            default:
                return {
                    icon: <WifiOff className="w-4 h-4" />,
                    badge: "suspended",
                    label: "Desconectado"
                };
        }
    };

    const filteredSessions = sessions.filter((s) => {
        if (filter === "all") return true;
        return s.status === filter;
    });

    if (loading) {
        return (
            <div className="loading-container">
                <div className="loading-content">
                    <div className="loading-icon">
                        <Sparkles className="w-7 h-7 text-white" />
                    </div>
                    <div className="loading-spinner" />
                    <p className="loading-text">Carregando sessões...</p>
                </div>
            </div>
        );
    }

    const kpiCards = stats ? [
        {
            title: "Total de Sessões",
            value: stats.total,
            icon: Signal,
            color: "purple"
        },
        {
            title: "Conectados",
            value: stats.connected,
            icon: CheckCircle2,
            color: "green"
        },
        {
            title: "Conectando",
            value: stats.connecting,
            icon: RefreshCw,
            color: "cyan"
        },
        {
            title: "Desconectados",
            value: stats.disconnected,
            icon: AlertCircle,
            color: "blue"
        },
    ] : [];

    return (
        <div className="dashboard-page">
            {/* Page Header */}
            <div className="page-header">
                <div className="page-title-section">
                    <div className="status-indicator">
                        <span className="status-dot" />
                        Monitoramento Ativo
                    </div>
                    <h1 className="page-title">
                        Monitoramento <span className="highlight">WhatsApp</span>
                    </h1>
                    <p className="page-subtitle">Todas as sessões de todas as empresas em tempo real</p>
                </div>
                <button onClick={fetchSessions} className="refresh-btn">
                    <RefreshCw className="w-4 h-4" />
                    Atualizar
                </button>
            </div>

            {/* KPI Cards */}
            <div className="kpi-grid">
                {kpiCards.map((kpi, index) => (
                    <div key={index} className="kpi-card">
                        <div className="kpi-content">
                            <div className="kpi-info">
                                <span className="kpi-label">{kpi.title}</span>
                                <span className="kpi-value">{kpi.value}</span>
                            </div>
                            <div className={`kpi-icon ${kpi.color}`}>
                                <kpi.icon />
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            {/* Filter Pills */}
            <div className="filter-pills">
                {[
                    { value: "all", label: "Todos" },
                    { value: "CONNECTED", label: "Conectados" },
                    { value: "CONNECTING", label: "Conectando" },
                    { value: "DISCONNECTED", label: "Desconectados" }
                ].map((f) => (
                    <button
                        key={f.value}
                        onClick={() => setFilter(f.value)}
                        className={cn("filter-pill", filter === f.value && "active")}
                    >
                        {f.label}
                    </button>
                ))}
            </div>

            {/* Sessions Table */}
            <div className="panel-card">
                <div className="panel-header">
                    <div className="panel-title">
                        <div className="panel-title-icon purple">
                            <Smartphone />
                        </div>
                        Sessões WhatsApp
                    </div>
                </div>
                <div className="panel-body">
                    <div className="table-container">
                        <table className="data-table">
                            <thead>
                                <tr>
                                    <th>Empresa</th>
                                    <th>Sessão</th>
                                    <th>Telefone</th>
                                    <th>Status</th>
                                    <th className="text-right">Conversas</th>
                                    <th>Último Acesso</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredSessions.map((session) => {
                                    const statusStyle = getStatusStyle(session.status);
                                    return (
                                        <tr key={session.id}>
                                            <td>
                                                <div className="company-cell">
                                                    <div className="company-avatar">
                                                        <Building2 className="w-5 h-5" />
                                                    </div>
                                                    <div className="company-info">
                                                        <div className="company-name">{session.company.name}</div>
                                                        <div className="company-date">{session.company.email}</div>
                                                    </div>
                                                </div>
                                            </td>
                                            <td>
                                                <span className="font-medium text-white">{session.sessionName}</span>
                                            </td>
                                            <td>
                                                <span className="text-muted font-mono">{session.phoneNumber || "-"}</span>
                                            </td>
                                            <td>
                                                <span className={`status-badge ${statusStyle.badge}`}>
                                                    <span className="status-badge-dot" />
                                                    {statusStyle.icon}
                                                    {statusStyle.label}
                                                </span>
                                            </td>
                                            <td className="text-right">
                                                <div className="flex items-center justify-end gap-2">
                                                    <MessageCircle className="w-4 h-4 text-primary" />
                                                    <span className="font-semibold text-white">{session.conversationsCount}</span>
                                                </div>
                                            </td>
                                            <td>
                                                <div className="flex items-center gap-2 text-muted text-sm">
                                                    <Clock className="w-4 h-4" />
                                                    {session.lastSeenAt ? formatDate(session.lastSeenAt) : "Nunca"}
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            {/* Empty State */}
            {filteredSessions.length === 0 && (
                <div className="empty-state">
                    <div className="empty-state-icon">
                        <Smartphone />
                    </div>
                    <h3 className="empty-state-title">Nenhuma sessão encontrada</h3>
                    <p className="empty-state-text">Não há sessões com o filtro selecionado.</p>
                </div>
            )}
        </div>
    );
}
