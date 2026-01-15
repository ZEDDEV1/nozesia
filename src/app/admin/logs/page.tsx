"use client";

import { useState, useEffect } from "react";
import {
    FileText,
    RefreshCw,
    Search,
    Building2,
    Clock,
    User,
    Activity,
    AlertTriangle,
    XCircle,
    Shield,
    Info,
    ChevronLeft,
    ChevronRight,
    ChevronDown,
    ChevronUp,
    Trash2,
    Sparkles
} from "lucide-react";
import { formatDate, cn } from "@/lib/utils";

interface SystemLog {
    id: string;
    level: "DEBUG" | "INFO" | "WARNING" | "ERROR" | "SECURITY";
    category: string;
    message: string;
    context: Record<string, unknown> | null;
    stack: string | null;
    route: string | null;
    method: string | null;
    statusCode: number | null;
    duration: number | null;
    userId: string | null;
    userEmail: string | null;
    company: {
        id: string;
        name: string;
    } | null;
    ipAddress: string | null;
    createdAt: string;
}

interface Pagination {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
}

interface Stats {
    total: number;
    byLevel: Record<string, number>;
    today: Record<string, number>;
    byCategory: Record<string, number>;
}

const LEVEL_CONFIG = {
    DEBUG: { icon: Info, color: "text-gray-400", bg: "bg-gray-500/10", label: "Debug" },
    INFO: { icon: Info, color: "text-blue-400", bg: "bg-blue-500/10", label: "Info" },
    WARNING: { icon: AlertTriangle, color: "text-yellow-400", bg: "bg-yellow-500/10", label: "Alerta" },
    ERROR: { icon: XCircle, color: "text-red-400", bg: "bg-red-500/10", label: "Erro" },
    SECURITY: { icon: Shield, color: "text-purple-400", bg: "bg-purple-500/10", label: "Segurança" },
};

const CATEGORY_ICONS = {
    API: "🔌",
    WHATSAPP: "💬",
    AUTH: "🔐",
    PAYMENT: "💳",
    AI: "🤖",
    WEBHOOK: "🔗",
    CRON: "⏰",
    SYSTEM: "⚙️",
};

export default function AdminLogsPage() {
    const [logs, setLogs] = useState<SystemLog[]>([]);
    const [pagination, setPagination] = useState<Pagination>({
        page: 1,
        limit: 50,
        total: 0,
        totalPages: 0,
    });
    const [stats, setStats] = useState<Stats>({ total: 0, byLevel: {}, today: {}, byCategory: {} });
    const [loading, setLoading] = useState(true);
    const [cleaning, setCleaning] = useState(false);
    const [cleanDays, setCleanDays] = useState<string>("30");
    const [refreshing, setRefreshing] = useState(false);
    const [searchTerm, setSearchTerm] = useState("");
    const [levelFilter, _setLevelFilter] = useState("");
    const [categoryFilter, setCategoryFilter] = useState("");
    const [expandedLog, setExpandedLog] = useState<string | null>(null);
    const [activeTab, setActiveTab] = useState("ALL");

    useEffect(() => {
        fetchLogs();
    }, [pagination.page, levelFilter, categoryFilter]);

    const fetchLogs = async () => {
        try {
            setLoading(true);
            const params = new URLSearchParams({
                page: pagination.page.toString(),
                limit: pagination.limit.toString(),
            });
            if (levelFilter) params.append("level", levelFilter);
            if (categoryFilter) params.append("category", categoryFilter);

            const response = await fetch(`/api/admin/system-logs?${params}`);
            const data = await response.json();

            if (data.success) {
                setLogs(data.data.logs);
                setPagination(data.data.pagination);
                setStats(data.data.stats);
            }
        } catch (error) {
            console.error("Error fetching logs:", error);
        } finally {
            setLoading(false);
        }
    };

    const handleCleanLogs = async () => {
        const confirmMsg = cleanDays === "all"
            ? "⚠️ ATENÇÃO: Isso irá excluir TODOS os logs do sistema! Tem certeza?"
            : `Excluir logs com mais de ${cleanDays} dias?`;

        if (!confirm(confirmMsg)) return;

        // Double confirmation for deleting all
        if (cleanDays === "all" && !confirm("Esta ação é irreversível. Confirmar exclusão de TODOS os logs?")) return;

        setCleaning(true);
        try {
            const url = cleanDays === "all"
                ? "/api/admin/system-logs?all=true"
                : `/api/admin/system-logs?days=${cleanDays}`;
            const response = await fetch(url, { method: "DELETE" });
            const data = await response.json();

            if (response.ok && data.success) {
                alert(`✅ ${data.data.deleted} logs excluídos com sucesso!`);
                await fetchLogs();
            } else {
                alert(`❌ Erro: ${data.error || "Falha ao limpar logs"}`);
            }
        } catch (error) {
            console.error("Error cleaning logs:", error);
            alert("❌ Erro de conexão ao limpar logs");
        } finally {
            setCleaning(false);
        }
    };

    const handleRefresh = async () => {
        setRefreshing(true);
        await fetchLogs();
        setRefreshing(false);
    };

    const filteredLogs = logs.filter((log) => {
        // Filtro por tab
        if (activeTab !== "ALL" && log.level !== activeTab) return false;

        // Filtro por busca
        if (!searchTerm) return true;
        const search = searchTerm.toLowerCase();
        return (
            log.message.toLowerCase().includes(search) ||
            log.route?.toLowerCase().includes(search) ||
            log.userEmail?.toLowerCase().includes(search) ||
            log.company?.name.toLowerCase().includes(search)
        );
    });

    const tabs = [
        { id: "ALL", label: "Todos", count: stats.total, icon: FileText },
        { id: "ERROR", label: "Erros", count: stats.byLevel.ERROR || 0, icon: XCircle },
        { id: "WARNING", label: "Alertas", count: stats.byLevel.WARNING || 0, icon: AlertTriangle },
        { id: "SECURITY", label: "Segurança", count: stats.byLevel.SECURITY || 0, icon: Shield },
        { id: "INFO", label: "Info", count: stats.byLevel.INFO || 0, icon: Info },
    ];

    if (loading && logs.length === 0) {
        return (
            <div className="loading-container">
                <div className="loading-content">
                    <div className="loading-icon">
                        <Sparkles className="w-7 h-7 text-white" />
                    </div>
                    <div className="loading-spinner" />
                    <p className="loading-text">Carregando logs do sistema...</p>
                </div>
            </div>
        );
    }

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
                        Logs do <span className="highlight">Sistema</span>
                    </h1>
                    <p className="page-subtitle">Erros, alertas e eventos de segurança</p>
                </div>
                <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
                    <select
                        className="form-input"
                        style={{
                            width: "auto",
                            minWidth: "140px",
                            padding: "0.5rem 0.75rem",
                            fontSize: "0.875rem",
                            borderColor: cleanDays === "all" ? "rgba(248, 113, 113, 0.5)" : undefined,
                        }}
                        value={cleanDays}
                        onChange={(e) => setCleanDays(e.target.value)}
                        disabled={cleaning}
                    >
                        <option value="7">+ de 7 dias</option>
                        <option value="14">+ de 14 dias</option>
                        <option value="30">+ de 30 dias</option>
                        <option value="all">🗑️ Todos os logs</option>
                    </select>
                    <button
                        onClick={handleCleanLogs}
                        className="refresh-btn"
                        style={{ color: cleanDays === "all" ? "#ef4444" : "#f87171" }}
                        disabled={cleaning}
                    >
                        {cleaning ? (
                            <><RefreshCw className="w-4 h-4 animate-spin" /> Limpando...</>
                        ) : (
                            <><Trash2 className="w-4 h-4" /> {cleanDays === "all" ? "Limpar Tudo" : "Limpar"}</>
                        )}
                    </button>
                    <button
                        onClick={handleRefresh}
                        className="refresh-btn"
                        disabled={refreshing}
                    >
                        <RefreshCw className={`w-4 h-4 ${refreshing ? "animate-spin" : ""}`} />
                        {refreshing ? "Atualizando..." : "Atualizar"}
                    </button>
                </div>
            </div>

            {/* Stats Cards */}
            <div className="kpi-grid">
                <div className="kpi-card">
                    <div className="kpi-content">
                        <div className="kpi-info">
                            <span className="kpi-label">Erros Hoje</span>
                            <span className="kpi-value" style={{ color: "#f87171" }}>
                                {stats.today.ERROR || 0}
                            </span>
                        </div>
                        <div className="kpi-icon" style={{ background: "rgba(248, 113, 113, 0.1)" }}>
                            <XCircle style={{ color: "#f87171" }} />
                        </div>
                    </div>
                </div>
                <div className="kpi-card">
                    <div className="kpi-content">
                        <div className="kpi-info">
                            <span className="kpi-label">Alertas Hoje</span>
                            <span className="kpi-value" style={{ color: "#fbbf24" }}>
                                {stats.today.WARNING || 0}
                            </span>
                        </div>
                        <div className="kpi-icon" style={{ background: "rgba(251, 191, 36, 0.1)" }}>
                            <AlertTriangle style={{ color: "#fbbf24" }} />
                        </div>
                    </div>
                </div>
                <div className="kpi-card">
                    <div className="kpi-content">
                        <div className="kpi-info">
                            <span className="kpi-label">Segurança Hoje</span>
                            <span className="kpi-value" style={{ color: "#a78bfa" }}>
                                {stats.today.SECURITY || 0}
                            </span>
                        </div>
                        <div className="kpi-icon" style={{ background: "rgba(167, 139, 250, 0.1)" }}>
                            <Shield style={{ color: "#a78bfa" }} />
                        </div>
                    </div>
                </div>
                <div className="kpi-card">
                    <div className="kpi-content">
                        <div className="kpi-info">
                            <span className="kpi-label">Total de Logs</span>
                            <span className="kpi-value">{stats.total.toLocaleString()}</span>
                        </div>
                        <div className="kpi-icon blue">
                            <Activity />
                        </div>
                    </div>
                </div>
            </div>

            {/* Tabs */}
            <div style={{ display: "flex", gap: "0.5rem", marginBottom: "1rem", flexWrap: "wrap" }}>
                {tabs.map((tab) => {
                    const Icon = tab.icon;
                    const isActive = activeTab === tab.id;
                    return (
                        <button
                            key={tab.id}
                            onClick={() => {
                                setActiveTab(tab.id);
                                setPagination((p) => ({ ...p, page: 1 }));
                            }}
                            className={cn("filter-pill", isActive && "active")}
                            style={{
                                display: "flex",
                                alignItems: "center",
                                gap: "0.5rem",
                                padding: "0.5rem 1rem",
                                borderRadius: "8px",
                                border: "1px solid",
                                borderColor: isActive ? "rgba(59, 130, 246, 0.5)" : "rgba(255,255,255,0.1)",
                                background: isActive ? "rgba(59, 130, 246, 0.1)" : "rgba(255,255,255,0.03)",
                                color: isActive ? "#3b82f6" : "#94a3b8",
                                cursor: "pointer",
                            }}
                        >
                            <Icon className="w-4 h-4" />
                            {tab.label}
                            <span style={{
                                background: isActive ? "#3b82f6" : "rgba(255,255,255,0.1)",
                                color: isActive ? "white" : "#64748b",
                                padding: "0.125rem 0.5rem",
                                borderRadius: "999px",
                                fontSize: "0.75rem",
                            }}>
                                {tab.count}
                            </span>
                        </button>
                    );
                })}
            </div>

            {/* Filters */}
            <div className="filter-section">
                <div className="search-input">
                    <Search />
                    <input
                        type="text"
                        placeholder="Buscar por mensagem, rota, usuário..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
                <div className="filter-pills" style={{ flexWrap: 'wrap' }}>
                    <select
                        className="form-input"
                        style={{ width: 'auto', minWidth: '150px' }}
                        value={categoryFilter}
                        onChange={(e) => {
                            setCategoryFilter(e.target.value);
                            setPagination((p) => ({ ...p, page: 1 }));
                        }}
                    >
                        <option value="">Todas categorias</option>
                        {Object.entries(CATEGORY_ICONS).map(([cat, icon]) => (
                            <option key={cat} value={cat}>
                                {icon} {cat}
                            </option>
                        ))}
                    </select>
                </div>
            </div>

            {/* Logs List */}
            <div className="panel-card">
                <div className="panel-header">
                    <div className="panel-title">
                        <div className="panel-title-icon purple">
                            <FileText />
                        </div>
                        Logs ({filteredLogs.length})
                    </div>
                </div>
                <div className="panel-body" style={{ padding: 0 }}>
                    {filteredLogs.length === 0 ? (
                        <div className="empty-state" style={{ padding: "3rem" }}>
                            <div className="empty-state-icon">
                                <FileText />
                            </div>
                            <h3 className="empty-state-title">Nenhum log encontrado</h3>
                            <p className="empty-state-text">
                                {activeTab !== "ALL"
                                    ? `Não há logs do tipo ${activeTab} no momento.`
                                    : "Os logs aparecerão aqui quando houver eventos."}
                            </p>
                        </div>
                    ) : (
                        <div style={{ display: "flex", flexDirection: "column" }}>
                            {filteredLogs.map((log) => {
                                const config = LEVEL_CONFIG[log.level];
                                const Icon = config.icon;
                                const isExpanded = expandedLog === log.id;
                                const categoryIcon = CATEGORY_ICONS[log.category as keyof typeof CATEGORY_ICONS] || "📋";

                                return (
                                    <div
                                        key={log.id}
                                        style={{
                                            borderBottom: "1px solid rgba(255,255,255,0.05)",
                                        }}
                                    >
                                        <div
                                            onClick={() => setExpandedLog(isExpanded ? null : log.id)}
                                            style={{
                                                padding: "1rem 1.5rem",
                                                display: "flex",
                                                alignItems: "flex-start",
                                                gap: "1rem",
                                                cursor: "pointer",
                                                background: isExpanded ? "rgba(255,255,255,0.02)" : "transparent",
                                            }}
                                        >
                                            {/* Level Icon */}
                                            <div
                                                style={{
                                                    padding: "0.5rem",
                                                    borderRadius: "8px",
                                                    flexShrink: 0,
                                                }}
                                                className={config.bg}
                                            >
                                                <Icon className={cn("w-5 h-5", config.color)} />
                                            </div>

                                            {/* Content */}
                                            <div style={{ flex: 1, minWidth: 0 }}>
                                                <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.25rem" }}>
                                                    <span style={{ fontSize: "1rem" }}>{categoryIcon}</span>
                                                    <span className={cn("text-sm font-medium", config.color)}>
                                                        {config.label}
                                                    </span>
                                                    {log.route && (
                                                        <code style={{
                                                            fontSize: "0.75rem",
                                                            background: "rgba(0,0,0,0.3)",
                                                            padding: "0.125rem 0.5rem",
                                                            borderRadius: "4px",
                                                            color: "#94a3b8",
                                                        }}>
                                                            {log.method} {log.route}
                                                        </code>
                                                    )}
                                                    {log.statusCode && (
                                                        <span style={{
                                                            fontSize: "0.75rem",
                                                            color: log.statusCode >= 500 ? "#f87171" : log.statusCode >= 400 ? "#fbbf24" : "#34d399",
                                                        }}>
                                                            {log.statusCode}
                                                        </span>
                                                    )}
                                                </div>
                                                <p style={{
                                                    color: "white",
                                                    margin: 0,
                                                    fontSize: "0.9rem",
                                                    overflow: "hidden",
                                                    textOverflow: "ellipsis",
                                                    whiteSpace: isExpanded ? "normal" : "nowrap",
                                                }}>
                                                    {log.message}
                                                </p>
                                            </div>

                                            {/* Meta */}
                                            <div style={{ textAlign: "right", flexShrink: 0 }}>
                                                <div style={{ display: "flex", alignItems: "center", gap: "0.25rem", color: "#64748b", fontSize: "0.75rem" }}>
                                                    <Clock className="w-3 h-3" />
                                                    {formatDate(log.createdAt)}
                                                </div>
                                                {log.company && (
                                                    <div style={{ display: "flex", alignItems: "center", gap: "0.25rem", color: "#64748b", fontSize: "0.75rem", marginTop: "0.25rem" }}>
                                                        <Building2 className="w-3 h-3" />
                                                        {log.company.name}
                                                    </div>
                                                )}
                                            </div>

                                            {/* Expand Icon */}
                                            <div style={{ flexShrink: 0, color: "#64748b" }}>
                                                {isExpanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                                            </div>
                                        </div>

                                        {/* Expanded Details */}
                                        {isExpanded && (
                                            <div style={{
                                                padding: "0 1.5rem 1.5rem 4.5rem",
                                                background: "rgba(0,0,0,0.2)",
                                            }}>
                                                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "1rem", marginBottom: "1rem" }}>
                                                    {log.userEmail && (
                                                        <div>
                                                            <span style={{ color: "#64748b", fontSize: "0.75rem" }}>Usuário</span>
                                                            <p style={{ color: "white", margin: "0.25rem 0 0", display: "flex", alignItems: "center", gap: "0.25rem" }}>
                                                                <User className="w-4 h-4" />
                                                                {log.userEmail}
                                                            </p>
                                                        </div>
                                                    )}
                                                    {log.duration && (
                                                        <div>
                                                            <span style={{ color: "#64748b", fontSize: "0.75rem" }}>Duração</span>
                                                            <p style={{ color: "white", margin: "0.25rem 0 0" }}>{log.duration}ms</p>
                                                        </div>
                                                    )}
                                                    {log.ipAddress && (
                                                        <div>
                                                            <span style={{ color: "#64748b", fontSize: "0.75rem" }}>IP</span>
                                                            <p style={{ color: "white", margin: "0.25rem 0 0", fontFamily: "monospace" }}>{log.ipAddress}</p>
                                                        </div>
                                                    )}
                                                </div>

                                                {log.context && Object.keys(log.context).length > 0 && (
                                                    <div style={{ marginBottom: "1rem" }}>
                                                        <span style={{ color: "#64748b", fontSize: "0.75rem" }}>Contexto</span>
                                                        <pre style={{
                                                            background: "#0a0a0b",
                                                            padding: "1rem",
                                                            borderRadius: "8px",
                                                            overflow: "auto",
                                                            fontSize: "0.8rem",
                                                            color: "#94a3b8",
                                                            marginTop: "0.5rem",
                                                            maxHeight: "200px",
                                                        }}>
                                                            {JSON.stringify(log.context, null, 2)}
                                                        </pre>
                                                    </div>
                                                )}

                                                {log.stack && (
                                                    <div>
                                                        <span style={{ color: "#f87171", fontSize: "0.75rem" }}>Stack Trace</span>
                                                        <pre style={{
                                                            background: "#0a0a0b",
                                                            padding: "1rem",
                                                            borderRadius: "8px",
                                                            overflow: "auto",
                                                            fontSize: "0.75rem",
                                                            color: "#f87171",
                                                            marginTop: "0.5rem",
                                                            maxHeight: "300px",
                                                            whiteSpace: "pre-wrap",
                                                            wordBreak: "break-all",
                                                        }}>
                                                            {log.stack}
                                                        </pre>
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    )}

                    {/* Pagination */}
                    {pagination.totalPages > 1 && (
                        <div className="pagination" style={{ padding: "1rem" }}>
                            <button
                                onClick={() => setPagination((p) => ({ ...p, page: p.page - 1 }))}
                                disabled={pagination.page === 1}
                                className="pagination-btn"
                            >
                                <ChevronLeft className="w-4 h-4" />
                            </button>
                            <span className="pagination-info">
                                Página {pagination.page} de {pagination.totalPages}
                            </span>
                            <button
                                onClick={() => setPagination((p) => ({ ...p, page: p.page + 1 }))}
                                disabled={pagination.page === pagination.totalPages}
                                className="pagination-btn"
                            >
                                <ChevronRight className="w-4 h-4" />
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
