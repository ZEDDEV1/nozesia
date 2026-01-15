"use client";

import { useState } from "react";

interface HeatmapData {
    [dayOfWeek: number]: {
        [hour: number]: number;
    };
}

interface HeatmapChartProps {
    data: HeatmapData;
}

const DAYS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
const HOURS = Array.from({ length: 24 }, (_, i) => i);

export function HeatmapChart({ data }: HeatmapChartProps) {
    const [hoveredCell, setHoveredCell] = useState<{ day: number; hour: number; value: number } | null>(null);

    // Calcular valores mín e máx para normalizar cores
    let minValue = Infinity;
    let maxValue = -Infinity;

    Object.values(data).forEach((dayData: Record<number, number>) => {
        Object.values(dayData).forEach((value: number) => {
            if (value < minValue) minValue = value;
            if (value > maxValue) maxValue = value;
        });
    });

    // Função para calcular cor baseada no valor
    const getColor = (value: number): string => {
        if (value === 0 || !value) return "rgba(100, 116, 139, 0.1)"; // Cinza muito claro

        const normalized = (value - minValue) / (maxValue - minValue || 1);

        if (normalized < 0.33) {
            // Frio (cyan)
            return `rgba(6, 182, 212, ${0.2 + normalized * 0.4})`;
        } else if (normalized < 0.66) {
            // Médio (amber)
            return `rgba(251, 191, 36, ${0.3 + normalized * 0.4})`;
        } else {
            // Quente (rose)
            return `rgba(239, 68, 68, ${0.5 + normalized * 0.4})`;
        }
    };

    return (
        <div style={{ position: "relative" }}>
            {/* Grid principal */}
            <div style={{
                display: "grid",
                gridTemplateColumns: "60px repeat(24, 1fr)",
                gap: "4px",
                fontSize: "0.75rem"
            }}>
                {/* Cabeçalho de horas */}
                <div /> {/* Espaço vazio no canto */}
                {HOURS.map(hour => (
                    <div
                        key={`hour-${hour}`}
                        style={{
                            textAlign: "center",
                            color: "var(--dash-text-dim)",
                            fontSize: "0.7rem",
                            paddingBottom: "4px"
                        }}
                    >
                        {hour % 6 === 0 ? `${hour}h` : ""}
                    </div>
                ))}

                {/* Linhas de dias */}
                {DAYS.map((day, dayIndex) => (
                    <div key={`row-${dayIndex}`} style={{ display: "contents" }}>
                        {/* Label do dia */}
                        <div style={{
                            display: "flex",
                            alignItems: "center",
                            color: "var(--dash-text-muted)",
                            fontSize: "0.75rem",
                            fontWeight: 500,
                            paddingRight: "8px"
                        }}>
                            {day}
                        </div>

                        {/* Células de horas */}
                        {HOURS.map(hour => {
                            const value = data[dayIndex]?.[hour] || 0;
                            const color = getColor(value);

                            return (
                                <div
                                    key={`cell-${dayIndex}-${hour}`}
                                    style={{
                                        aspectRatio: "1",
                                        backgroundColor: color,
                                        borderRadius: "4px",
                                        cursor: "pointer",
                                        transition: "all 0.2s ease",
                                        border: hoveredCell?.day === dayIndex && hoveredCell?.hour === hour
                                            ? "2px solid rgba(255, 255, 255, 0.3)"
                                            : "1px solid transparent"
                                    }}
                                    onMouseEnter={() => setHoveredCell({ day: dayIndex, hour, value })}
                                    onMouseLeave={() => setHoveredCell(null)}
                                    title={`${day}, ${hour}h: ${value} mensagens`}
                                />
                            );
                        })}
                    </div>
                ))}
            </div>

            {/* Tooltip customizado */}
            {hoveredCell && (
                <div style={{
                    position: "absolute",
                    bottom: "100%",
                    left: "50%",
                    transform: "translateX(-50%)",
                    marginBottom: "8px",
                    padding: "8px 12px",
                    background: "rgba(30, 41, 59, 0.95)",
                    backdropFilter: "blur(10px)",
                    border: "1px solid rgba(255, 255, 255, 0.1)",
                    borderRadius: "8px",
                    fontSize: "0.85rem",
                    color: "white",
                    whiteSpace: "nowrap",
                    pointerEvents: "none",
                    zIndex: 10
                }}>
                    <strong>{DAYS[hoveredCell.day]}, {hoveredCell.hour}h</strong>: {hoveredCell.value} mensagens
                </div>
            )}

            {/* Legenda */}
            <div style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "1rem",
                marginTop: "1rem",
                fontSize: "0.75rem",
                color: "var(--dash-text-muted)"
            }}>
                <span>Menos</span>
                <div style={{ display: "flex", gap: "4px" }}>
                    {[0, 0.25, 0.5, 0.75, 1].map(intensity => (
                        <div
                            key={intensity}
                            style={{
                                width: 20,
                                height: 20,
                                borderRadius: "4px",
                                backgroundColor: getColor(minValue + (maxValue - minValue) * intensity)
                            }}
                        />
                    ))}
                </div>
                <span>Mais</span>
            </div>
        </div>
    );
}
