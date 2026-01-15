"use client";

interface PerformerData {
    name: string;
    count: number;
    avatar?: string;
}

interface TopPerformersCardProps {
    agents: PerformerData[];
    products: PerformerData[];
}

const MEDALS = ["🥇", "🥈", "🥉"];

export function TopPerformersCard({ agents, products }: TopPerformersCardProps) {
    const renderList = (items: PerformerData[], type: "agent" | "product") => {
        if (items.length === 0) {
            return (
                <div style={{
                    padding: "2rem 1rem",
                    textAlign: "center",
                    color: "var(--dash-text-dim)",
                    fontSize: "0.875rem"
                }}>
                    Sem dados ainda
                </div>
            );
        }

        const maxCount = Math.max(...items.map(i => i.count), 1);

        return (
            <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                {items.slice(0, 3).map((item, index) => (
                    <div
                        key={`${type}-${item.name}-${index}`}
                        style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "0.75rem",
                            padding: "0.75rem",
                            borderRadius: "10px",
                            background: index === 0
                                ? "rgba(251, 191, 36, 0.1)"
                                : "rgba(255, 255, 255, 0.03)",
                            border: index === 0
                                ? "1px solid rgba(251, 191, 36, 0.2)"
                                : "1px solid transparent",
                            transition: "all 0.2s ease"
                        }}
                    >
                        {/* Medal/Rank */}
                        <div style={{
                            width: 32,
                            height: 32,
                            borderRadius: "50%",
                            background: index === 0
                                ? "linear-gradient(135deg, #fbbf24, #f59e0b)"
                                : index === 1
                                    ? "linear-gradient(135deg, #94a3b8, #64748b)"
                                    : "linear-gradient(135deg, #d97706, #b45309)",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            fontSize: "1.2rem",
                            flexShrink: 0
                        }}>
                            {MEDALS[index]}
                        </div>

                        {/* Info */}
                        <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{
                                fontSize: "0.9rem",
                                fontWeight: 600,
                                color: "white",
                                marginBottom: "4px",
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                                whiteSpace: "nowrap"
                            }}>
                                {item.name}
                            </div>
                            {/* Progress bar */}
                            <div style={{
                                height: 6,
                                background: "rgba(255, 255, 255, 0.08)",
                                borderRadius: 3,
                                overflow: "hidden"
                            }}>
                                <div style={{
                                    height: "100%",
                                    width: `${(item.count / maxCount) * 100}%`,
                                    background: index === 0
                                        ? "linear-gradient(90deg, #fbbf24, #f59e0b)"
                                        : index === 1
                                            ? "linear-gradient(90deg, #94a3b8, #64748b)"
                                            : "linear-gradient(90deg, #d97706, #b45309)",
                                    borderRadius: 3,
                                    transition: "width 0.3s ease"
                                }} />
                            </div>
                        </div>

                        {/* Count */}
                        <div style={{
                            fontSize: "1rem",
                            fontWeight: 700,
                            color: index === 0 ? "#fbbf24" : "var(--dash-text-muted)",
                            flexShrink: 0
                        }}>
                            {item.count}
                        </div>
                    </div>
                ))}
            </div>
        );
    };

    return (
        <div style={{
            display: "grid",
            gridTemplateColumns: "1fr",
            gap: "1.5rem"
        }}>
            {/* Top Agents */}
            <div>
                <h4 style={{
                    fontSize: "0.9rem",
                    fontWeight: 600,
                    color: "var(--dash-text-muted)",
                    marginBottom: "1rem",
                    display: "flex",
                    alignItems: "center",
                    gap: "0.5rem"
                }}>
                    🤖 Top Agentes
                </h4>
                {renderList(agents, "agent")}
            </div>

            {/* Top Products */}
            <div>
                <h4 style={{
                    fontSize: "0.9rem",
                    fontWeight: 600,
                    color: "var(--dash-text-muted)",
                    marginBottom: "1rem",
                    display: "flex",
                    alignItems: "center",
                    gap: "0.5rem"
                }}>
                    📦 Top Produtos
                </h4>
                {renderList(products, "product")}
            </div>
        </div>
    );
}
