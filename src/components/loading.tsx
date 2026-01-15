/**
 * Componentes de Loading Globais
 * 
 * Inclui:
 * - Spinner: loading circular
 * - Skeleton: placeholder para conteúdo
 * - LoadingOverlay: overlay de carregamento
 * - PageLoading: loading de página inteira
 */

"use client";

import React from "react";

// ============================================
// SPINNER
// ============================================

interface SpinnerProps {
    size?: "sm" | "md" | "lg" | "xl";
    color?: string;
    className?: string;
}

export function Spinner({
    size = "md",
    color = "#10b981",
    className = ""
}: SpinnerProps) {
    const sizes = {
        sm: 16,
        md: 24,
        lg: 32,
        xl: 48,
    };

    const sizeValue = sizes[size];

    return (
        <div className={`loading-spinner ${className}`} style={{ width: sizeValue, height: sizeValue }}>
            <svg
                viewBox="0 0 24 24"
                fill="none"
                style={{
                    width: '100%',
                    height: '100%',
                    animation: 'spin 1s linear infinite'
                }}
            >
                <circle
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="3"
                    strokeLinecap="round"
                    style={{
                        color: 'rgba(255,255,255,0.1)',
                    }}
                />
                <circle
                    cx="12"
                    cy="12"
                    r="10"
                    stroke={color}
                    strokeWidth="3"
                    strokeLinecap="round"
                    strokeDasharray="31.4 31.4"
                    style={{
                        transformOrigin: 'center',
                    }}
                />
            </svg>
        </div>
    );
}

// ============================================
// SKELETON
// ============================================

interface SkeletonProps {
    width?: string | number;
    height?: string | number;
    borderRadius?: string | number;
    className?: string;
    variant?: "text" | "circular" | "rectangular";
}

export function Skeleton({
    width = "100%",
    height = 20,
    borderRadius,
    className = "",
    variant = "text"
}: SkeletonProps) {
    const getRadius = () => {
        if (borderRadius) return borderRadius;
        if (variant === "circular") return "50%";
        if (variant === "text") return "4px";
        return "8px";
    };

    return (
        <div
            className={`skeleton ${className}`}
            style={{
                width: typeof width === "number" ? `${width}px` : width,
                height: typeof height === "number" ? `${height}px` : height,
                borderRadius: getRadius(),
                background: 'linear-gradient(90deg, rgba(255,255,255,0.05) 25%, rgba(255,255,255,0.1) 50%, rgba(255,255,255,0.05) 75%)',
                backgroundSize: '200% 100%',
                animation: 'shimmer 1.5s infinite',
            }}
        />
    );
}

// ============================================
// SKELETON VARIANTS
// ============================================

export function SkeletonText({ lines = 3, className = "" }: { lines?: number; className?: string }) {
    return (
        <div className={className} style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {Array.from({ length: lines }).map((_, i) => (
                <Skeleton
                    key={i}
                    height={16}
                    width={i === lines - 1 ? "70%" : "100%"}
                />
            ))}
        </div>
    );
}

export function SkeletonCard({ className = "" }: { className?: string }) {
    return (
        <div
            className={className}
            style={{
                background: 'rgba(255,255,255,0.02)',
                border: '1px solid rgba(255,255,255,0.05)',
                borderRadius: '12px',
                padding: '20px',
            }}
        >
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
                <Skeleton variant="circular" width={40} height={40} />
                <div style={{ flex: 1 }}>
                    <Skeleton height={16} width="60%" />
                    <div style={{ marginTop: 8 }}>
                        <Skeleton height={12} width="40%" />
                    </div>
                </div>
            </div>
            <SkeletonText lines={2} />
        </div>
    );
}

export function SkeletonList({ items = 5, className = "" }: { items?: number; className?: string }) {
    return (
        <div className={className} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {Array.from({ length: items }).map((_, i) => (
                <div
                    key={i}
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '12px',
                        padding: '12px',
                        background: 'rgba(255,255,255,0.02)',
                        borderRadius: '8px',
                    }}
                >
                    <Skeleton variant="circular" width={36} height={36} />
                    <div style={{ flex: 1 }}>
                        <Skeleton height={14} width="50%" />
                        <div style={{ marginTop: 6 }}>
                            <Skeleton height={12} width="30%" />
                        </div>
                    </div>
                </div>
            ))}
        </div>
    );
}

// ============================================
// LOADING OVERLAY
// ============================================

interface LoadingOverlayProps {
    visible: boolean;
    text?: string;
    blur?: boolean;
}

export function LoadingOverlay({ visible, text, blur = true }: LoadingOverlayProps) {
    if (!visible) return null;

    return (
        <div
            style={{
                position: 'absolute',
                inset: 0,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '16px',
                background: blur ? 'rgba(15, 23, 42, 0.8)' : 'rgba(15, 23, 42, 0.95)',
                backdropFilter: blur ? 'blur(4px)' : 'none',
                zIndex: 50,
                borderRadius: 'inherit',
            }}
        >
            <Spinner size="lg" />
            {text && (
                <p style={{ color: '#94a3b8', fontSize: '14px', margin: 0 }}>{text}</p>
            )}
        </div>
    );
}

// ============================================
// PAGE LOADING
// ============================================

interface PageLoadingProps {
    text?: string;
}

export function PageLoading({ text = "Carregando..." }: PageLoadingProps) {
    return (
        <div
            style={{
                minHeight: '50vh',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '16px',
            }}
        >
            <Spinner size="xl" />
            <p style={{ color: '#94a3b8', fontSize: '15px', margin: 0 }}>{text}</p>
        </div>
    );
}

// ============================================
// BUTTON LOADING
// ============================================

interface ButtonLoadingProps {
    loading: boolean;
    children: React.ReactNode;
    loadingText?: string;
}

export function ButtonLoading({ loading, children, loadingText }: ButtonLoadingProps) {
    if (loading) {
        return (
            <>
                <Spinner size="sm" color="currentColor" />
                {loadingText || "Carregando..."}
            </>
        );
    }
    return <>{children}</>;
}

// ============================================
// GLOBAL STYLES (adicionar ao CSS global)
// ============================================

export function LoadingStyles() {
    return (
        <style>{`
            @keyframes spin {
                from { transform: rotate(0deg); }
                to { transform: rotate(360deg); }
            }

            @keyframes shimmer {
                0% { background-position: -200% 0; }
                100% { background-position: 200% 0; }
            }

            @keyframes pulse {
                0%, 100% { opacity: 1; }
                50% { opacity: 0.5; }
            }
        `}</style>
    );
}
