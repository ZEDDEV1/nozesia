"use client";

import React from "react";

interface SkeletonProps {
    className?: string;
    width?: string | number;
    height?: string | number;
    borderRadius?: string | number;
    style?: React.CSSProperties;
}

/**
 * Skeleton component for loading states
 */
export function Skeleton({
    className = "",
    width = "100%",
    height = 20,
    borderRadius = 8,
    style = {},
}: SkeletonProps) {
    return (
        <div
            className={`skeleton ${className}`}
            style={{
                width,
                height,
                borderRadius,
                background: "linear-gradient(90deg, rgba(255,255,255,0.05) 25%, rgba(255,255,255,0.1) 50%, rgba(255,255,255,0.05) 75%)",
                backgroundSize: "200% 100%",
                animation: "shimmer 1.5s infinite",
                ...style,
            }}
        />
    );
}

/**
 * Card skeleton for dashboard cards
 */
export function CardSkeleton() {
    return (
        <div className="dash-card" style={{ padding: "1.5rem" }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "1rem" }}>
                <Skeleton width={120} height={16} />
                <Skeleton width={40} height={40} borderRadius="50%" />
            </div>
            <Skeleton width={80} height={32} style={{ marginBottom: "0.5rem" }} />
            <Skeleton width={100} height={14} />
        </div>
    );
}

/**
 * Table row skeleton
 */
export function TableRowSkeleton({ columns = 5 }: { columns?: number }) {
    return (
        <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
            {Array.from({ length: columns }).map((_, i) => (
                <td key={i} style={{ padding: "1rem" }}>
                    <Skeleton width={i === 0 ? "70%" : "50%"} height={16} />
                </td>
            ))}
        </tr>
    );
}

/**
 * Product card skeleton
 */
export function ProductCardSkeleton() {
    return (
        <div className="dash-card">
            <div className="dash-card-content">
                <Skeleton width="100%" height={160} borderRadius={12} style={{ marginBottom: "1rem" }} />
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.5rem" }}>
                    <Skeleton width="60%" height={20} />
                    <Skeleton width="25%" height={20} />
                </div>
                <Skeleton width="80%" height={14} />
            </div>
        </div>
    );
}

/**
 * List skeleton - multiple items
 */
export function ListSkeleton({ count = 5, height = 60 }: { count?: number; height?: number }) {
    return (
        <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
            {Array.from({ length: count }).map((_, i) => (
                <Skeleton key={i} width="100%" height={height} />
            ))}
        </div>
    );
}

/**
 * Conversation row skeleton
 */
export function ConversationRowSkeleton() {
    return (
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", padding: "1rem" }}>
            <Skeleton width={40} height={40} borderRadius="50%" />
            <div style={{ flex: 1 }}>
                <Skeleton width="50%" height={14} style={{ marginBottom: "0.5rem" }} />
                <Skeleton width="70%" height={12} />
            </div>
            <Skeleton width={50} height={12} />
        </div>
    );
}

/**
 * Dashboard skeleton - full dashboard loading state
 */
export function DashboardSkeleton() {
    return (
        <div className="dash-fade-in">
            {/* Header */}
            <div className="dash-page-header">
                <Skeleton width={180} height={28} style={{ marginBottom: "0.5rem" }} />
                <Skeleton width={280} height={16} />
            </div>

            {/* Stats Grid */}
            <div className="dash-stats-grid" style={{ marginBottom: "1.5rem" }}>
                <CardSkeleton />
                <CardSkeleton />
                <CardSkeleton />
                <CardSkeleton />
            </div>

            {/* Content Grid */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1.5rem" }}>
                {/* Recent Conversations */}
                <div className="dash-card">
                    <div className="dash-card-header">
                        <Skeleton width={180} height={18} />
                    </div>
                    <div>
                        {Array.from({ length: 5 }).map((_, i) => (
                            <div
                                key={i}
                                style={{
                                    borderBottom: i < 4 ? "1px solid rgba(255,255,255,0.05)" : undefined,
                                }}
                            >
                                <ConversationRowSkeleton />
                            </div>
                        ))}
                    </div>
                </div>

                {/* Quick Actions */}
                <div className="dash-card">
                    <div className="dash-card-header">
                        <Skeleton width={120} height={18} />
                    </div>
                    <div style={{ padding: "1rem" }}>
                        <Skeleton width="100%" height={52} borderRadius={10} style={{ marginBottom: "0.75rem" }} />
                        <Skeleton width="100%" height={52} borderRadius={10} style={{ marginBottom: "0.75rem" }} />
                        <Skeleton width="100%" height={52} borderRadius={10} />
                    </div>
                </div>
            </div>
        </div>
    );
}
