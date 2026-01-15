"use client";

import React, { useState, createContext, useContext, useCallback } from "react";
import { AlertTriangle, X } from "lucide-react";

interface ConfirmDialogOptions {
    title?: string;
    message: string;
    confirmText?: string;
    cancelText?: string;
    type?: "danger" | "warning" | "info";
}

interface ConfirmContextType {
    confirm: (options: ConfirmDialogOptions) => Promise<boolean>;
}

const ConfirmContext = createContext<ConfirmContextType | null>(null);

export function useConfirm() {
    const context = useContext(ConfirmContext);
    if (!context) {
        throw new Error("useConfirm must be used within ConfirmProvider");
    }
    return context;
}

interface ConfirmProviderProps {
    children: React.ReactNode;
}

export function ConfirmProvider({ children }: ConfirmProviderProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [options, setOptions] = useState<ConfirmDialogOptions | null>(null);
    const [resolvePromise, setResolvePromise] = useState<((value: boolean) => void) | null>(null);

    const confirm = useCallback((opts: ConfirmDialogOptions): Promise<boolean> => {
        setOptions(opts);
        setIsOpen(true);

        return new Promise((resolve) => {
            setResolvePromise(() => resolve);
        });
    }, []);

    const handleConfirm = () => {
        setIsOpen(false);
        resolvePromise?.(true);
    };

    const handleCancel = () => {
        setIsOpen(false);
        resolvePromise?.(false);
    };

    const typeColors = {
        danger: { bg: "rgba(239, 68, 68, 0.1)", color: "#ef4444", icon: "#ef4444" },
        warning: { bg: "rgba(245, 158, 11, 0.1)", color: "#f59e0b", icon: "#f59e0b" },
        info: { bg: "rgba(59, 130, 246, 0.1)", color: "#3b82f6", icon: "#3b82f6" },
    };

    const colors = options?.type ? typeColors[options.type] : typeColors.danger;

    return (
        <ConfirmContext.Provider value={{ confirm }}>
            {children}

            {isOpen && options && (
                <div
                    style={{
                        position: "fixed",
                        inset: 0,
                        background: "rgba(0, 0, 0, 0.6)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        zIndex: 9999,
                        backdropFilter: "blur(4px)",
                    }}
                    onClick={handleCancel}
                >
                    <div
                        className="dash-card animate-fade-in"
                        style={{
                            width: "100%",
                            maxWidth: 420,
                            margin: "1rem",
                            padding: 0,
                        }}
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div style={{ padding: "1.5rem" }}>
                            <div style={{ display: "flex", alignItems: "flex-start", gap: "1rem" }}>
                                <div style={{
                                    width: 48,
                                    height: 48,
                                    borderRadius: 12,
                                    background: colors.bg,
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    flexShrink: 0,
                                }}>
                                    <AlertTriangle style={{ width: 24, height: 24, color: colors.icon }} />
                                </div>
                                <div style={{ flex: 1 }}>
                                    <h3 style={{
                                        color: "white",
                                        fontSize: "1.1rem",
                                        fontWeight: 600,
                                        margin: "0 0 0.5rem",
                                    }}>
                                        {options.title || "Confirmar Ação"}
                                    </h3>
                                    <p style={{ color: "#94a3b8", fontSize: "0.9rem", lineHeight: 1.5, margin: 0 }}>
                                        {options.message}
                                    </p>
                                </div>
                                <button
                                    onClick={handleCancel}
                                    style={{
                                        background: "none",
                                        border: "none",
                                        padding: "0.25rem",
                                        cursor: "pointer",
                                        color: "#64748b",
                                    }}
                                >
                                    <X style={{ width: 20, height: 20 }} />
                                </button>
                            </div>
                        </div>

                        <div style={{
                            display: "flex",
                            gap: "0.75rem",
                            padding: "1rem 1.5rem",
                            borderTop: "1px solid rgba(255,255,255,0.1)",
                            justifyContent: "flex-end",
                        }}>
                            <button
                                onClick={handleCancel}
                                className="dash-btn secondary"
                            >
                                {options.cancelText || "Cancelar"}
                            </button>
                            <button
                                onClick={handleConfirm}
                                className="dash-btn"
                                style={{
                                    background: colors.color,
                                    borderColor: colors.color,
                                }}
                            >
                                {options.confirmText || "Confirmar"}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </ConfirmContext.Provider>
    );
}
