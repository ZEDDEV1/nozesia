"use client";

import { AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";

// Cores do tema
const COLORS = {
    cyan: "#22d3ee",
    purple: "#a855f7",
    emerald: "#10b981",
    amber: "#f59e0b",
    rose: "#f43f5e",
    blue: "#3b82f6",
};

// Tooltip types
interface TooltipPayload {
    name: string;
    value: number;
    color: string;
}

interface CustomTooltipProps {
    active?: boolean;
    payload?: TooltipPayload[];
    label?: string;
}

// Tooltip customizado
const CustomTooltip = ({ active, payload, label }: CustomTooltipProps) => {
    if (active && payload && payload.length) {
        return (
            <div style={{
                background: "rgba(30, 41, 59, 0.95)",
                backdropFilter: "blur(10px)",
                border: "1px solid rgba(255, 255, 255, 0.1)",
                borderRadius: "8px",
                padding: "8px 12px",
                fontSize: "0.85rem"
            }}>
                <p style={{ color: "white", margin: "0 0 4px", fontWeight: 600 }}>{label}</p>
                {payload.map((entry: TooltipPayload, index: number) => (
                    <p key={index} style={{ color: entry.color, margin: 0 }}>
                        {entry.name}: {entry.value}
                    </p>
                ))}
            </div>
        );
    }
    return null;
};

// 1. LINE CHART (Conversas ao longo do tempo)
export function ConversationsLineChart({ data }: { data: Array<{ date: string; count: number }> }) {
    return (
        <ResponsiveContainer width="100%" height={250}>
            <AreaChart data={data}>
                <defs>
                    <linearGradient id="colorCount" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor={COLORS.cyan} stopOpacity={0.3} />
                        <stop offset="95%" stopColor={COLORS.cyan} stopOpacity={0} />
                    </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                <XAxis
                    dataKey="date"
                    stroke="var(--dash-text-dim)"
                    fontSize={12}
                    tickFormatter={(value) => {
                        const parts = value.split("-");
                        if (parts.length === 3) {
                            const [, month, day] = parts;
                            return `${day}/${month}`;
                        }
                        return value;
                    }}
                />
                <YAxis stroke="var(--dash-text-dim)" fontSize={12} />
                <Tooltip content={<CustomTooltip />} />
                <Area
                    type="monotone"
                    dataKey="count"
                    stroke={COLORS.cyan}
                    strokeWidth={2}
                    fillOpacity={1}
                    fill="url(#colorCount)"
                    name="Conversas"
                />
            </AreaChart>
        </ResponsiveContainer>
    );
}

// 2. BAR CHART (Mensagens por agente)
export function MessagesByAgentChart({ data }: { data: Array<{ agentName: string; count: number }> }) {
    return (
        <ResponsiveContainer width="100%" height={300}>
            <BarChart data={data} layout="horizontal">
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                <XAxis type="number" stroke="var(--dash-text-dim)" fontSize={12} />
                <YAxis
                    type="category"
                    dataKey="agentName"
                    stroke="var(--dash-text-dim)"
                    fontSize={12}
                    width={100}
                />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="count" fill={COLORS.purple} radius={[0, 8, 8, 0]} name="Mensagens" />
            </BarChart>
        </ResponsiveContainer>
    );
}

// 3. PIE CHART (Taxa de Resolução)
export function ResolutionPieChart({ data }: { data: { byAI: number; byHuman: number } }) {
    const chartData = [
        { name: "IA", value: data.byAI, color: COLORS.purple },
        { name: "Humano", value: data.byHuman, color: COLORS.cyan },
    ];

    return (
        <ResponsiveContainer width="100%" height={250}>
            <PieChart>
                <Pie
                    data={chartData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={90}
                    paddingAngle={2}
                    dataKey="value"
                >
                    {chartData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                </Pie>
                <Tooltip content={<CustomTooltip />} />
                <Legend
                    verticalAlign="bottom"
                    height={36}
                    formatter={(value: string) => (
                        <span style={{ color: "var(--dash-text-muted)", fontSize: "0.85rem" }}>
                            {value}
                        </span>
                    )}
                />
            </PieChart>
        </ResponsiveContainer>
    );
}

// 4. PIE CHART (Distribuição de Status)
export function StatusDistributionChart({ data }: {
    data: { active: number; waiting: number; resolved: number; closed: number }
}) {
    const chartData = [
        { name: "Ativo", value: data.active, color: COLORS.emerald },
        { name: "Aguardando", value: data.waiting, color: COLORS.amber },
        { name: "Resolvido", value: data.resolved, color: COLORS.blue },
        { name: "Fechado", value: data.closed, color: "#64748b" },
    ].filter(item => item.value > 0);

    return (
        <ResponsiveContainer width="100%" height={250}>
            <PieChart>
                <Pie
                    data={chartData}
                    cx="50%"
                    cy="50%"
                    outerRadius={80}
                    dataKey="value"
                    label
                >
                    {chartData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                </Pie>
                <Tooltip content={<CustomTooltip />} />
            </PieChart>
        </ResponsiveContainer>
    );
}

// 5. BAR CHART (Horários de Pico)
export function PeakHoursChart({ data }: { data: Array<{ hour: number; count: number }> }) {
    // Preencher todas as 24 horas
    const fullData = Array.from({ length: 24 }, (_, hour) => ({
        hour: `${hour}h`,
        count: data.find(d => d.hour === hour)?.count || 0
    }));

    return (
        <ResponsiveContainer width="100%" height={200}>
            <BarChart data={fullData}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                <XAxis
                    dataKey="hour"
                    stroke="var(--dash-text-dim)"
                    fontSize={10}
                    interval={5}
                />
                <YAxis stroke="var(--dash-text-dim)" fontSize={12} />
                <Tooltip content={<CustomTooltip />} />
                <Bar
                    dataKey="count"
                    fill={COLORS.amber}
                    radius={[4, 4, 0, 0]}
                    name="Mensagens"
                />
            </BarChart>
        </ResponsiveContainer>
    );
}
