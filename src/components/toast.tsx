"use client";

import React, { useState, createContext, useContext, useCallback } from "react";
import { CheckCircle, XCircle, AlertTriangle, Info, X } from "lucide-react";

type ToastType = "success" | "error" | "warning" | "info";

interface Toast {
    id: string;
    message: string;
    type: ToastType;
}

interface ToastContextType {
    showToast: (message: string, type?: ToastType) => void;
    success: (message: string) => void;
    error: (message: string) => void;
    warning: (message: string) => void;
    info: (message: string) => void;
}

const ToastContext = createContext<ToastContextType | null>(null);

export function useToast() {
    const context = useContext(ToastContext);
    if (!context) {
        throw new Error("useToast must be used within ToastProvider");
    }
    return context;
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
    const [toasts, setToasts] = useState<Toast[]>([]);

    const removeToast = useCallback((id: string) => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
    }, []);

    const showToast = useCallback((message: string, type: ToastType = "info") => {
        const id = Math.random().toString(36).substring(7);
        setToasts((prev) => [...prev, { id, message, type }]);

        // Auto remove after 4 seconds
        setTimeout(() => removeToast(id), 4000);
    }, [removeToast]);

    const success = useCallback((msg: string) => showToast(msg, "success"), [showToast]);
    const error = useCallback((msg: string) => showToast(msg, "error"), [showToast]);
    const warning = useCallback((msg: string) => showToast(msg, "warning"), [showToast]);
    const info = useCallback((msg: string) => showToast(msg, "info"), [showToast]);

    const icons = {
        success: CheckCircle,
        error: XCircle,
        warning: AlertTriangle,
        info: Info,
    };

    const colors = {
        success: { bg: "rgba(34, 197, 94, 0.15)", border: "#22c55e", icon: "#22c55e" },
        error: { bg: "rgba(239, 68, 68, 0.15)", border: "#ef4444", icon: "#ef4444" },
        warning: { bg: "rgba(245, 158, 11, 0.15)", border: "#f59e0b", icon: "#f59e0b" },
        info: { bg: "rgba(59, 130, 246, 0.15)", border: "#3b82f6", icon: "#3b82f6" },
    };

    return (
        <ToastContext.Provider value={{ showToast, success, error, warning, info }}>
            {children}

            {/* Toast Container */}
            <div style={{
                position: "fixed",
                bottom: 24,
                right: 24,
                display: "flex",
                flexDirection: "column",
                gap: "0.75rem",
                zIndex: 9999,
                pointerEvents: "none",
            }}>
                {toasts.map((toast) => {
                    const Icon = icons[toast.type];
                    const color = colors[toast.type];

                    return (
                        <div
                            key={toast.id}
                            className="animate-slide-in"
                            style={{
                                display: "flex",
                                alignItems: "center",
                                gap: "0.75rem",
                                padding: "1rem 1.25rem",
                                background: color.bg,
                                border: `1px solid ${color.border}`,
                                borderRadius: 12,
                                backdropFilter: "blur(12px)",
                                boxShadow: "0 4px 20px rgba(0,0,0,0.3)",
                                pointerEvents: "auto",
                                minWidth: 280,
                                maxWidth: 400,
                            }}
                        >
                            <Icon style={{ width: 20, height: 20, color: color.icon, flexShrink: 0 }} />
                            <span style={{ color: "white", fontSize: "0.9rem", flex: 1 }}>
                                {toast.message}
                            </span>
                            <button
                                onClick={() => removeToast(toast.id)}
                                style={{
                                    background: "none",
                                    border: "none",
                                    padding: "0.25rem",
                                    cursor: "pointer",
                                    color: "#64748b",
                                    flexShrink: 0,
                                }}
                            >
                                <X style={{ width: 16, height: 16 }} />
                            </button>
                        </div>
                    );
                })}
            </div>
        </ToastContext.Provider>
    );
}
