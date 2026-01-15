"use client";

import { useState, useEffect } from "react";
import {
    Zap,
    AlertTriangle,
    Building2,
    RefreshCw,
    AlertCircle,
    Sparkles,
    ArrowDown,
    ArrowUp
} from "lucide-react";
import { cn } from "@/lib/utils";

interface TokenUsage {
    id: string;
    companyId: string;
    companyName: string;
    companyEmail: string;
    plan: string;
    inputTokens: number;
    outputTokens: number;
    totalTokens: number;
    maxTokens: number;
    percentUsed: number;
    isOverLimit: boolean;
    month: string;
}

interface Totals {
    inputTokens: number;
    outputTokens: number;
    totalTokens: number;
}

interface Alerts {
    nearLimit: number;
    overLimit: number;
}

export default function TokensPage() {
    const [usage, setUsage] = useState<TokenUsage[]>([]);
    const [totals, setTotals] = useState<Totals | null>(null);
    const [alerts, setAlerts] = useState<Alerts | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchTokens();
    }, []);

    const fetchTokens = async () => {
        try {
            setLoading(true);
            const response = await fetch("/api/admin/tokens");
            const data = await response.json();
            if (data.success) {
                setUsage(data.data.usage);
                setTotals(data.data.totals);
                setAlerts(data.data.alerts);
            }
        } catch (error) {
            console.error("Error fetching tokens:", error);
        } finally {
            setLoading(false);
        }
    };

    const getProgressStyle = (percent: number, isOverLimit: boolean) => {
        if (isOverLimit) return { bar: "bg-gradient-to-r from-[#ff3366] to-[#ff006e]", text: "text-danger" };
        if (percent >= 80) return { bar: "bg-gradient-to-r from-[#ffb800] to-[#ff9500]", text: "text-warning" };
        if (percent >= 50) return { bar: "bg-gradient-to-r from-[#8b5cf6] to-[#a855f7]", text: "text-primary" };
        return { bar: "bg-gradient-to-r from-[#00ff88] to-[#06ffd0]", text: "text-success" };
    };

    const getPlanClass = (plan: string) => {
        switch (plan) {
            case "BASIC": return "basic";
            case "PRO": return "pro";
            case "ENTERPRISE": return "enterprise";
            default: return "basic";
        }
    };

    if (loading) {
        return (
            <div className="loading-container">
                <div className="loading-content">
                    <div className="loading-icon">
                        <Sparkles className="w-7 h-7 text-white" />
                    </div>
                    <div className="loading-spinner" />
                    <p className="loading-text">Carregando consumo de tokens...</p>
                </div>
            </div>
        );
    }

    const kpiCards = [
        {
            title: "Total Tokens",
            value: totals ? (totals.totalTokens / 1000).toFixed(1) + "K" : "0",
            icon: Sparkles,
            color: "purple"
        },
        {
            title: "Input Tokens",
            value: totals ? (totals.inputTokens / 1000).toFixed(1) + "K" : "0",
            icon: ArrowDown,
            color: "cyan"
        },
        {
            title: "Output Tokens",
            value: totals ? (totals.outputTokens / 1000).toFixed(1) + "K" : "0",
            icon: ArrowUp,
            color: "green"
        },
        {
            title: "Acima do Limite",
            value: alerts?.overLimit || 0,
            icon: AlertCircle,
            color: "blue"
        },
    ];

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
                        Controle de <span className="highlight">Tokens</span>
                    </h1>
                    <p className="page-subtitle">Consumo de tokens por empresa neste mês</p>
                </div>
                <button onClick={fetchTokens} className="refresh-btn">
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

            {/* Alerts Banner */}
            {(alerts?.nearLimit || 0) > 0 && (
                <div className="alert-banner warning">
                    <div className="alert-banner-icon">
                        <AlertTriangle />
                    </div>
                    <div className="alert-banner-content">
                        <p className="alert-banner-title">{alerts?.nearLimit} empresas próximas do limite</p>
                        <p className="alert-banner-text">Estas empresas usaram mais de 80% dos tokens disponíveis</p>
                    </div>
                </div>
            )}

            {/* Usage Table */}
            <div className="panel-card">
                <div className="panel-header">
                    <div className="panel-title">
                        <div className="panel-title-icon purple">
                            <Zap />
                        </div>
                        Consumo por Empresa
                    </div>
                </div>
                <div className="panel-body">
                    <div className="table-container">
                        <table className="data-table">
                            <thead>
                                <tr>
                                    <th>Empresa</th>
                                    <th>Plano</th>
                                    <th className="text-right">Input</th>
                                    <th className="text-right">Output</th>
                                    <th className="text-right">Total</th>
                                    <th>Uso</th>
                                </tr>
                            </thead>
                            <tbody>
                                {usage.map((u) => {
                                    const style = getProgressStyle(u.percentUsed, u.isOverLimit);
                                    return (
                                        <tr key={u.id}>
                                            <td>
                                                <div className="company-cell">
                                                    <div className={cn(
                                                        "company-avatar",
                                                        u.isOverLimit && "bg-danger/15"
                                                    )}>
                                                        {u.isOverLimit ? (
                                                            <AlertCircle className="w-5 h-5 text-danger" />
                                                        ) : (
                                                            <Building2 className="w-5 h-5" />
                                                        )}
                                                    </div>
                                                    <div className="company-info">
                                                        <div className="company-name">{u.companyName}</div>
                                                        <div className="company-date">{u.companyEmail}</div>
                                                    </div>
                                                </div>
                                            </td>
                                            <td>
                                                <span className={`plan-badge ${getPlanClass(u.plan)}`}>
                                                    {u.plan}
                                                </span>
                                            </td>
                                            <td className="text-right">
                                                <span className="text-muted font-mono">{(u.inputTokens / 1000).toFixed(1)}K</span>
                                            </td>
                                            <td className="text-right">
                                                <span className="text-muted font-mono">{(u.outputTokens / 1000).toFixed(1)}K</span>
                                            </td>
                                            <td className="text-right">
                                                <span className="font-semibold text-white font-mono">{(u.totalTokens / 1000).toFixed(1)}K</span>
                                            </td>
                                            <td>
                                                <div className="chart-item">
                                                    <div className="chart-item-header">
                                                        <span className={cn("font-semibold text-sm", style.text)}>
                                                            {u.percentUsed}%
                                                        </span>
                                                        <span className="text-muted text-xs">{(u.maxTokens / 1000).toFixed(0)}K max</span>
                                                    </div>
                                                    <div className="chart-bar">
                                                        <div
                                                            className={cn("chart-bar-fill", style.bar)}
                                                            style={{ width: `${Math.min(u.percentUsed, 100)}%` }}
                                                        />
                                                    </div>
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
            {usage.length === 0 && (
                <div className="empty-state">
                    <div className="empty-state-icon">
                        <Zap />
                    </div>
                    <h3 className="empty-state-title">Nenhum consumo registrado</h3>
                    <p className="empty-state-text">Ainda não há uso de tokens este mês.</p>
                </div>
            )}
        </div>
    );
}
