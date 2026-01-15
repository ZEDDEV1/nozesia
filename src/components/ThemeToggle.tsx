"use client";

import React from "react";
import { Sun, Moon, Monitor } from "lucide-react";
import { useTheme } from "@/hooks";

interface ThemeToggleProps {
    className?: string;
    showLabel?: boolean;
}

/**
 * Theme Toggle Button - Premium Version
 * 
 * Features:
 * - Dark / Light / System modes
 * - Smooth transitions
 * - Visual feedback with animations
 * 
 * Usage:
 * <ThemeToggle />
 * <ThemeToggle showLabel />
 */
export function ThemeToggle({ className = "", showLabel = false }: ThemeToggleProps) {
    const { isDark, isSystem, cycleTheme } = useTheme();

    const getIcon = () => {
        if (isSystem) return <Monitor size={18} style={{ color: "#64748b" }} />;
        if (isDark) return <Sun size={18} style={{ color: "#fbbf24" }} />;
        return <Moon size={18} style={{ color: "#6366f1" }} />;
    };

    const getLabel = () => {
        if (isSystem) return "Sistema";
        if (isDark) return "Escuro";
        return "Claro";
    };

    const getTooltip = () => {
        if (isSystem) return "Seguindo tema do sistema";
        if (isDark) return "Modo escuro ativo";
        return "Modo claro ativo";
    };

    return (
        <button
            onClick={cycleTheme}
            className={`theme-toggle-btn ${className}`}
            title={getTooltip()}
            aria-label={getTooltip()}
        >
            <span className="theme-toggle-icon">{getIcon()}</span>
            {showLabel && <span className="theme-toggle-label">{getLabel()}</span>}

            {/* Indicator dots */}
            <span className="theme-toggle-indicators">
                <span
                    className={`theme-indicator ${isDark ? "active" : ""}`}
                    title="Escuro"
                />
                <span
                    className={`theme-indicator ${isSystem ? "active" : ""}`}
                    title="Sistema"
                />
                <span
                    className={`theme-indicator ${!isDark && !isSystem ? "active" : ""}`}
                    title="Claro"
                />
            </span>

            <style jsx>{`
                .theme-toggle-btn {
                    display: inline-flex;
                    align-items: center;
                    gap: 0.5rem;
                    padding: 0.5rem 0.75rem;
                    border-radius: 10px;
                    background: rgba(255, 255, 255, 0.05);
                    border: 1px solid rgba(255, 255, 255, 0.1);
                    cursor: pointer;
                    transition: all 0.2s ease;
                }

                .theme-toggle-btn:hover {
                    background: rgba(255, 255, 255, 0.1);
                    border-color: rgba(255, 255, 255, 0.2);
                    transform: translateY(-1px);
                }

                .theme-toggle-icon {
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    transition: transform 0.3s ease;
                }

                .theme-toggle-btn:hover .theme-toggle-icon {
                    transform: rotate(15deg) scale(1.1);
                }

                .theme-toggle-label {
                    font-size: 0.8rem;
                    font-weight: 500;
                    color: #94a3b8;
                }

                .theme-toggle-indicators {
                    display: flex;
                    gap: 3px;
                    margin-left: 4px;
                }

                .theme-indicator {
                    width: 4px;
                    height: 4px;
                    border-radius: 50%;
                    background: rgba(255, 255, 255, 0.2);
                    transition: all 0.2s ease;
                }

                .theme-indicator.active {
                    background: #10b981;
                    box-shadow: 0 0 6px rgba(16, 185, 129, 0.6);
                }

                /* Light mode styles */
                :global([data-theme="light"]) .theme-toggle-btn {
                    background: rgba(0, 0, 0, 0.05);
                    border-color: rgba(0, 0, 0, 0.1);
                }

                :global([data-theme="light"]) .theme-toggle-btn:hover {
                    background: rgba(0, 0, 0, 0.1);
                    border-color: rgba(0, 0, 0, 0.2);
                }

                :global([data-theme="light"]) .theme-toggle-label {
                    color: #64748b;
                }

                :global([data-theme="light"]) .theme-indicator {
                    background: rgba(0, 0, 0, 0.15);
                }

                :global([data-theme="light"]) .theme-indicator.active {
                    background: #059669;
                    box-shadow: 0 0 6px rgba(5, 150, 105, 0.6);
                }
            `}</style>
        </button>
    );
}
