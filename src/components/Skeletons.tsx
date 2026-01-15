"use client";

import React from "react";

/**
 * Base Skeleton Component
 * 
 * Animated loading placeholder with shimmer effect.
 */
export function Skeleton({
    width = "100%",
    height = "1rem",
    borderRadius = "4px",
    className = ""
}: {
    width?: string | number;
    height?: string | number;
    borderRadius?: string;
    className?: string;
}) {
    return (
        <div
            className={`skeleton ${className}`}
            style={{
                width: typeof width === "number" ? `${width}px` : width,
                height: typeof height === "number" ? `${height}px` : height,
                borderRadius,
            }}
        />
    );
}

/**
 * Card Skeleton - for dashboard cards
 */
export function CardSkeleton() {
    return (
        <div className="dash-card">
            <div style={{ display: "flex", alignItems: "center", gap: "1rem", marginBottom: "1rem" }}>
                <Skeleton width={48} height={48} borderRadius="12px" />
                <div style={{ flex: 1 }}>
                    <Skeleton width="60%" height="1.25rem" />
                    <Skeleton width="40%" height="0.875rem" className="mt-2" />
                </div>
            </div>
            <Skeleton height="2rem" />
        </div>
    );
}

/**
 * Stats Card Skeleton - for KPI cards
 */
export function StatsCardSkeleton() {
    return (
        <div className="dash-card">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                <div style={{ flex: 1 }}>
                    <Skeleton width="50%" height="0.875rem" />
                    <Skeleton width="70%" height="2rem" className="mt-2" />
                </div>
                <Skeleton width={40} height={40} borderRadius="10px" />
            </div>
        </div>
    );
}

/**
 * Conversation List Skeleton
 */
export function ConversationListSkeleton({ count = 5 }: { count?: number }) {
    return (
        <div className="dash-card" style={{ padding: 0 }}>
            {Array.from({ length: count }).map((_, i) => (
                <div
                    key={i}
                    style={{
                        display: "flex",
                        gap: "1rem",
                        padding: "1rem",
                        borderBottom: i < count - 1 ? "1px solid var(--border)" : "none"
                    }}
                >
                    <Skeleton width={48} height={48} borderRadius="50%" />
                    <div style={{ flex: 1 }}>
                        <div style={{ display: "flex", justifyContent: "space-between" }}>
                            <Skeleton width="40%" height="1rem" />
                            <Skeleton width={60} height="0.75rem" />
                        </div>
                        <Skeleton width="80%" height="0.875rem" className="mt-2" />
                    </div>
                </div>
            ))}
        </div>
    );
}

/**
 * Table Skeleton
 */
export function TableSkeleton({
    rows = 5,
    columns = 4
}: {
    rows?: number;
    columns?: number;
}) {
    return (
        <div className="dash-card" style={{ padding: 0, overflow: "hidden" }}>
            {/* Header */}
            <div style={{
                display: "grid",
                gridTemplateColumns: `repeat(${columns}, 1fr)`,
                gap: "1rem",
                padding: "1rem",
                background: "var(--bg-tertiary)",
                borderBottom: "1px solid var(--border)"
            }}>
                {Array.from({ length: columns }).map((_, i) => (
                    <Skeleton key={i} width="60%" height="0.875rem" />
                ))}
            </div>
            {/* Rows */}
            {Array.from({ length: rows }).map((_, rowIdx) => (
                <div
                    key={rowIdx}
                    style={{
                        display: "grid",
                        gridTemplateColumns: `repeat(${columns}, 1fr)`,
                        gap: "1rem",
                        padding: "1rem",
                        borderBottom: rowIdx < rows - 1 ? "1px solid var(--border)" : "none"
                    }}
                >
                    {Array.from({ length: columns }).map((_, colIdx) => (
                        <Skeleton key={colIdx} width={`${60 + Math.random() * 30}%`} height="1rem" />
                    ))}
                </div>
            ))}
        </div>
    );
}

/**
 * Agent Card Skeleton
 */
export function AgentCardSkeleton() {
    return (
        <div className="dash-card">
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "1rem" }}>
                <div style={{ display: "flex", gap: "1rem", alignItems: "center" }}>
                    <Skeleton width={56} height={56} borderRadius="12px" />
                    <div>
                        <Skeleton width={120} height="1.25rem" />
                        <Skeleton width={80} height="0.75rem" className="mt-1" />
                    </div>
                </div>
                <Skeleton width={50} height={24} borderRadius="12px" />
            </div>
            <Skeleton height="3rem" borderRadius="8px" />
            <div style={{ display: "flex", gap: "0.5rem", marginTop: "1rem" }}>
                <Skeleton width={80} height={32} borderRadius="6px" />
                <Skeleton width={80} height={32} borderRadius="6px" />
            </div>
        </div>
    );
}

/**
 * Dashboard Page Skeleton - Complete dashboard loading state
 */
export function DashboardSkeleton() {
    return (
        <div className="dashboard-page">
            {/* Stats Grid */}
            <div style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
                gap: "1.5rem",
                marginBottom: "2rem"
            }}>
                {Array.from({ length: 4 }).map((_, i) => (
                    <StatsCardSkeleton key={i} />
                ))}
            </div>

            {/* Main Content */}
            <div style={{
                display: "grid",
                gridTemplateColumns: "2fr 1fr",
                gap: "1.5rem"
            }}>
                <ConversationListSkeleton count={5} />
                <div>
                    <CardSkeleton />
                    <div style={{ marginTop: "1rem" }}>
                        <CardSkeleton />
                    </div>
                </div>
            </div>
        </div>
    );
}

/**
 * Agents Page Skeleton
 */
export function AgentsPageSkeleton() {
    return (
        <div className="dashboard-page">
            <div style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: "2rem"
            }}>
                <Skeleton width={200} height="2rem" />
                <Skeleton width={150} height={40} borderRadius="8px" />
            </div>
            <div style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))",
                gap: "1.5rem"
            }}>
                {Array.from({ length: 3 }).map((_, i) => (
                    <AgentCardSkeleton key={i} />
                ))}
            </div>
        </div>
    );
}
