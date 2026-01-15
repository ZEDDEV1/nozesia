"use client";

import { X, FileDown, FileText } from "lucide-react";

interface AnalyticsData {
    summary: {
        period: string;
        startDate: string;
        endDate: string;
        totalConversations: number;
        totalMessages: number;
        totalInterests: number;
        totalOrders: number;
        avgResponseTimeSeconds?: number;
    };
    conversationsOverTime: Array<{ date: string; count: number }>;
    peakHours: Array<{ hour: number; count: number }>;
    topProducts: Array<{ name: string; count: number }>;
    funnel: {
        conversations: number;
        interests: number;
        orders: number;
        conversionRate: number;
    };
}

interface AnalyticsReportProps {
    data: AnalyticsData;
    onClose: () => void;
}

export function AnalyticsReport({ data, onClose }: AnalyticsReportProps) {
    const handlePrint = () => {
        window.print();
    };

    const handleExportCSV = () => {
        // Create CSV content
        const lines: string[] = [];

        // Header
        lines.push("Relatório de Analytics - AgenteDeia");
        lines.push(`Período: ${formatDate(data.summary.startDate)} - ${formatDate(data.summary.endDate)}`);
        lines.push("");

        // Summary
        lines.push("=== RESUMO ===");
        lines.push("Métrica,Valor");
        lines.push(`Conversas,${data.summary.totalConversations}`);
        lines.push(`Mensagens,${data.summary.totalMessages}`);
        lines.push(`Interesses,${data.summary.totalInterests}`);
        lines.push(`Pedidos,${data.summary.totalOrders}`);
        lines.push(`Tempo Médio de Resposta (segundos),${data.summary.avgResponseTimeSeconds || 0}`);
        lines.push("");

        // Funnel
        lines.push("=== FUNIL DE CONVERSÃO ===");
        lines.push("Etapa,Quantidade");
        lines.push(`Conversas,${data.funnel.conversations}`);
        lines.push(`Interesses,${data.funnel.interests}`);
        lines.push(`Pedidos,${data.funnel.orders}`);
        lines.push(`Taxa de Conversão,${data.funnel.conversionRate}%`);
        lines.push("");

        // Conversations Over Time
        lines.push("=== CONVERSAS POR DIA ===");
        lines.push("Data,Quantidade");
        data.conversationsOverTime.forEach(item => {
            lines.push(`${item.date},${item.count}`);
        });
        lines.push("");

        // Peak Hours
        lines.push("=== HORÁRIOS DE PICO ===");
        lines.push("Hora,Quantidade");
        data.peakHours.forEach(item => {
            lines.push(`${item.hour}:00,${item.count}`);
        });
        lines.push("");

        // Top Products
        if (data.topProducts.length > 0) {
            lines.push("=== TOP PRODUTOS ===");
            lines.push("Produto,Consultas");
            data.topProducts.forEach(item => {
                lines.push(`"${item.name.replace(/"/g, '""')}",${item.count}`);
            });
        }

        // Create and download file
        const csvContent = lines.join("\n");
        const blob = new Blob(["\uFEFF" + csvContent], { type: "text/csv;charset=utf-8;" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = `relatorio-analytics-${data.summary.period}.csv`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    };

    const formatNumber = (num: number) => {
        if (num >= 1000) return `${(num / 1000).toFixed(1)}k`;
        return num.toString();
    };

    const formatDate = (dateStr: string) => {
        return new Date(dateStr).toLocaleDateString("pt-BR");
    };

    return (
        <div style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.8)",
            backdropFilter: "blur(4px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 9999,
        }}>
            <div style={{
                background: "white",
                width: "100%",
                maxWidth: 800,
                maxHeight: "90vh",
                overflow: "auto",
                borderRadius: 12,
                margin: "0 1rem",
            }}>
                {/* Actions (hide on print) */}
                <div className="no-print" style={{
                    display: "flex",
                    justifyContent: "space-between",
                    padding: "1rem",
                    borderBottom: "1px solid #e2e8f0",
                    position: "sticky",
                    top: 0,
                    background: "white",
                    zIndex: 10,
                }}>
                    <div style={{ display: "flex", gap: "0.5rem" }}>
                        <button
                            onClick={handlePrint}
                            style={{
                                display: "flex",
                                alignItems: "center",
                                gap: "0.5rem",
                                padding: "0.5rem 1rem",
                                background: "#3b82f6",
                                color: "white",
                                border: "none",
                                borderRadius: 6,
                                cursor: "pointer",
                                fontWeight: 500,
                            }}
                        >
                            <FileText size={16} />
                            Salvar PDF
                        </button>
                        <button
                            onClick={handleExportCSV}
                            style={{
                                display: "flex",
                                alignItems: "center",
                                gap: "0.5rem",
                                padding: "0.5rem 1rem",
                                background: "#10b981",
                                color: "white",
                                border: "none",
                                borderRadius: 6,
                                cursor: "pointer",
                                fontWeight: 500,
                            }}
                        >
                            <FileDown size={16} />
                            Exportar CSV
                        </button>
                    </div>
                    <button
                        onClick={onClose}
                        style={{
                            background: "none",
                            border: "none",
                            cursor: "pointer",
                            color: "#64748b",
                        }}
                    >
                        <X size={20} />
                    </button>
                </div>

                {/* Report Content */}
                <div id="analytics-report" style={{ padding: "2rem", color: "#1e293b" }}>
                    {/* Header */}
                    <div style={{ textAlign: "center", marginBottom: "2rem" }}>
                        <h1 style={{ fontSize: "1.5rem", fontWeight: 700, margin: "0 0 0.5rem" }}>
                            📊 Relatório de Analytics
                        </h1>
                        <p style={{ color: "#64748b", margin: 0 }}>
                            Período: {formatDate(data.summary.startDate)} - {formatDate(data.summary.endDate)}
                        </p>
                    </div>

                    {/* Summary Cards */}
                    <div style={{
                        display: "grid",
                        gridTemplateColumns: "repeat(4, 1fr)",
                        gap: "1rem",
                        marginBottom: "2rem",
                    }}>
                        <div style={{ padding: "1rem", background: "#f1f5f9", borderRadius: 8, textAlign: "center" }}>
                            <div style={{ fontSize: "1.5rem", fontWeight: 700, color: "#3b82f6" }}>
                                {formatNumber(data.summary.totalConversations)}
                            </div>
                            <div style={{ fontSize: "0.85rem", color: "#64748b" }}>Conversas</div>
                        </div>
                        <div style={{ padding: "1rem", background: "#f1f5f9", borderRadius: 8, textAlign: "center" }}>
                            <div style={{ fontSize: "1.5rem", fontWeight: 700, color: "#10b981" }}>
                                {formatNumber(data.summary.totalMessages)}
                            </div>
                            <div style={{ fontSize: "0.85rem", color: "#64748b" }}>Mensagens</div>
                        </div>
                        <div style={{ padding: "1rem", background: "#f1f5f9", borderRadius: 8, textAlign: "center" }}>
                            <div style={{ fontSize: "1.5rem", fontWeight: 700, color: "#f59e0b" }}>
                                {formatNumber(data.summary.totalInterests)}
                            </div>
                            <div style={{ fontSize: "0.85rem", color: "#64748b" }}>Interesses</div>
                        </div>
                        <div style={{ padding: "1rem", background: "#f1f5f9", borderRadius: 8, textAlign: "center" }}>
                            <div style={{ fontSize: "1.5rem", fontWeight: 700, color: "#8b5cf6" }}>
                                {formatNumber(data.summary.totalOrders)}
                            </div>
                            <div style={{ fontSize: "0.85rem", color: "#64748b" }}>Pedidos</div>
                        </div>
                    </div>

                    {/* Funnel */}
                    <div style={{ marginBottom: "2rem" }}>
                        <h2 style={{ fontSize: "1.1rem", fontWeight: 600, marginBottom: "1rem" }}>
                            🎯 Funil de Conversão
                        </h2>
                        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                            <div style={{ flex: 1, padding: "0.75rem", background: "#dbeafe", borderRadius: 6, textAlign: "center" }}>
                                <div style={{ fontWeight: 600 }}>{data.funnel.conversations}</div>
                                <div style={{ fontSize: "0.8rem", color: "#64748b" }}>Conversas</div>
                            </div>
                            <span>→</span>
                            <div style={{ flex: 1, padding: "0.75rem", background: "#fef3c7", borderRadius: 6, textAlign: "center" }}>
                                <div style={{ fontWeight: 600 }}>{data.funnel.interests}</div>
                                <div style={{ fontSize: "0.8rem", color: "#64748b" }}>Interesses</div>
                            </div>
                            <span>→</span>
                            <div style={{ flex: 1, padding: "0.75rem", background: "#d1fae5", borderRadius: 6, textAlign: "center" }}>
                                <div style={{ fontWeight: 600 }}>{data.funnel.orders}</div>
                                <div style={{ fontSize: "0.8rem", color: "#64748b" }}>Pedidos</div>
                            </div>
                            <span>=</span>
                            <div style={{ flex: 1, padding: "0.75rem", background: "#10b981", color: "white", borderRadius: 6, textAlign: "center" }}>
                                <div style={{ fontWeight: 600 }}>{data.funnel.conversionRate.toFixed(1)}%</div>
                                <div style={{ fontSize: "0.8rem", opacity: 0.9 }}>Conversão</div>
                            </div>
                        </div>
                    </div>

                    {/* Top Products */}
                    {data.topProducts.length > 0 && (
                        <div style={{ marginBottom: "2rem" }}>
                            <h2 style={{ fontSize: "1.1rem", fontWeight: 600, marginBottom: "1rem" }}>
                                🏆 Produtos Mais Consultados
                            </h2>
                            <table style={{ width: "100%", borderCollapse: "collapse" }}>
                                <thead>
                                    <tr style={{ borderBottom: "2px solid #e2e8f0" }}>
                                        <th style={{ textAlign: "left", padding: "0.5rem", fontWeight: 600 }}>Produto</th>
                                        <th style={{ textAlign: "right", padding: "0.5rem", fontWeight: 600 }}>Consultas</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {data.topProducts.slice(0, 5).map((p, i) => (
                                        <tr key={i} style={{ borderBottom: "1px solid #e2e8f0" }}>
                                            <td style={{ padding: "0.5rem" }}>{p.name}</td>
                                            <td style={{ padding: "0.5rem", textAlign: "right" }}>{p.count}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}

                    {/* Peak Hours */}
                    <div>
                        <h2 style={{ fontSize: "1.1rem", fontWeight: 600, marginBottom: "1rem" }}>
                            ⏰ Horários de Pico
                        </h2>
                        <div style={{ display: "flex", gap: "0.25rem", alignItems: "flex-end", height: 100 }}>
                            {data.peakHours.map((h, i) => {
                                const maxCount = Math.max(...data.peakHours.map(x => x.count));
                                const height = maxCount > 0 ? (h.count / maxCount) * 100 : 0;
                                return (
                                    <div key={i} style={{ flex: 1, textAlign: "center" }}>
                                        <div style={{
                                            height: `${height}%`,
                                            minHeight: 4,
                                            background: h.count > maxCount * 0.7 ? "#3b82f6" : "#94a3b8",
                                            borderRadius: "2px 2px 0 0",
                                        }} />
                                        <div style={{ fontSize: "0.6rem", color: "#64748b", marginTop: 2 }}>
                                            {h.hour}h
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    {/* Footer */}
                    <div style={{ marginTop: "2rem", paddingTop: "1rem", borderTop: "1px solid #e2e8f0", textAlign: "center" }}>
                        <p style={{ color: "#94a3b8", fontSize: "0.8rem", margin: 0 }}>
                            Gerado automaticamente por AgenteDeia • {new Date().toLocaleDateString("pt-BR")}
                        </p>
                    </div>
                </div>
            </div>

            {/* Print styles */}
            <style>{`
                @media print {
                    .no-print { display: none !important; }
                    body * { visibility: hidden; }
                    #analytics-report, #analytics-report * { visibility: visible; }
                    #analytics-report { position: absolute; left: 0; top: 0; width: 100%; }
                }
            `}</style>
        </div>
    );
}
