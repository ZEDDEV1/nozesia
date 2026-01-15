"use client";

import { useState } from "react";
import { Check, ChevronRight, Sparkles, X } from "lucide-react";
import Link from "next/link";

interface OnboardingStep {
    id: string;
    title: string;
    description: string;
    href: string;
    checkCondition: (data: OnboardingData) => boolean;
}

interface OnboardingData {
    hasAgent: boolean;
    hasSession: boolean;
    hasTraining: boolean;
    hasProducts: boolean;
    hasTemplate: boolean;
}

const ONBOARDING_STEPS: OnboardingStep[] = [
    {
        id: "agent",
        title: "Criar Agente de IA",
        description: "Configure seu primeiro assistente virtual",
        href: "/dashboard/agents/new",
        checkCondition: (data) => data.hasAgent,
    },
    {
        id: "session",
        title: "Conectar WhatsApp",
        description: "Vincule seu número de WhatsApp",
        href: "/dashboard/whatsapp",
        checkCondition: (data) => data.hasSession,
    },
    {
        id: "training",
        title: "Treinar a IA",
        description: "Adicione FAQs e documentos",
        href: "/dashboard/agents", // Will navigate to first agent
        checkCondition: (data) => data.hasTraining,
    },
    {
        id: "products",
        title: "Cadastrar Produtos",
        description: "Adicione seu catálogo (opcional)",
        href: "/dashboard/products",
        checkCondition: (data) => data.hasProducts,
    },
    {
        id: "template",
        title: "Criar Templates",
        description: "Mensagens prontas para respostas rápidas",
        href: "/dashboard/templates",
        checkCondition: (data) => data.hasTemplate,
    },
];

interface OnboardingChecklistProps {
    data: OnboardingData;
    onDismiss?: () => void;
}

export function OnboardingChecklist({ data, onDismiss }: OnboardingChecklistProps) {
    const [dismissed, setDismissed] = useState(() => {
        // Check localStorage for dismissed state on initial render
        if (typeof window !== "undefined") {
            return localStorage.getItem("onboarding_dismissed") === "true";
        }
        return false;
    });

    const completedSteps = ONBOARDING_STEPS.filter(step => step.checkCondition(data));
    const progress = Math.round((completedSteps.length / ONBOARDING_STEPS.length) * 100);
    const isComplete = progress === 100;

    // Auto-hide when complete
    if (dismissed || isComplete) return null;

    const handleDismiss = () => {
        localStorage.setItem("onboarding_dismissed", "true");
        setDismissed(true);
        onDismiss?.();
    };

    return (
        <div
            className="dash-card animate-fade-in"
            style={{
                background: "linear-gradient(135deg, rgba(16,185,129,0.1) 0%, rgba(59,130,246,0.1) 100%)",
                border: "1px solid rgba(16,185,129,0.3)",
                marginBottom: "1.5rem",
            }}
        >
            <div style={{ padding: "1.25rem" }}>
                {/* Header */}
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1rem" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                        <div style={{
                            width: 40,
                            height: 40,
                            borderRadius: 10,
                            background: "linear-gradient(135deg, #10b981 0%, #3b82f6 100%)",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                        }}>
                            <Sparkles size={20} style={{ color: "white" }} />
                        </div>
                        <div>
                            <h3 style={{ color: "#e2e8f0", fontSize: "1rem", fontWeight: 600, margin: 0 }}>
                                Primeiros Passos
                            </h3>
                            <p style={{ color: "#94a3b8", fontSize: "0.8rem", margin: 0 }}>
                                {completedSteps.length} de {ONBOARDING_STEPS.length} concluídos
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={handleDismiss}
                        style={{
                            background: "none",
                            border: "none",
                            padding: "0.25rem",
                            cursor: "pointer",
                            color: "#64748b",
                        }}
                        title="Dispensar"
                    >
                        <X size={18} />
                    </button>
                </div>

                {/* Progress bar */}
                <div style={{
                    height: 6,
                    background: "rgba(255,255,255,0.1)",
                    borderRadius: 3,
                    marginBottom: "1rem",
                    overflow: "hidden",
                }}>
                    <div style={{
                        height: "100%",
                        width: `${progress}%`,
                        background: "linear-gradient(90deg, #10b981 0%, #3b82f6 100%)",
                        borderRadius: 3,
                        transition: "width 0.3s ease",
                    }} />
                </div>

                {/* Steps */}
                <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                    {ONBOARDING_STEPS.map((step) => {
                        const isCompleted = step.checkCondition(data);
                        return (
                            <Link
                                key={step.id}
                                href={step.href}
                                style={{
                                    display: "flex",
                                    alignItems: "center",
                                    gap: "0.75rem",
                                    padding: "0.75rem",
                                    background: isCompleted ? "rgba(16,185,129,0.1)" : "rgba(255,255,255,0.03)",
                                    borderRadius: 8,
                                    textDecoration: "none",
                                    border: `1px solid ${isCompleted ? "rgba(16,185,129,0.3)" : "rgba(255,255,255,0.05)"}`,
                                    transition: "all 0.2s",
                                }}
                            >
                                <div style={{
                                    width: 24,
                                    height: 24,
                                    borderRadius: "50%",
                                    background: isCompleted ? "#10b981" : "rgba(255,255,255,0.1)",
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    flexShrink: 0,
                                }}>
                                    {isCompleted ? (
                                        <Check size={14} style={{ color: "white" }} />
                                    ) : (
                                        <span style={{ color: "#64748b", fontSize: "0.75rem", fontWeight: 600 }}>
                                            {ONBOARDING_STEPS.indexOf(step) + 1}
                                        </span>
                                    )}
                                </div>
                                <div style={{ flex: 1 }}>
                                    <p style={{
                                        color: isCompleted ? "#10b981" : "#e2e8f0",
                                        fontSize: "0.9rem",
                                        fontWeight: 500,
                                        margin: 0,
                                        textDecoration: isCompleted ? "line-through" : "none",
                                    }}>
                                        {step.title}
                                    </p>
                                    <p style={{ color: "#64748b", fontSize: "0.75rem", margin: 0 }}>
                                        {step.description}
                                    </p>
                                </div>
                                {!isCompleted && (
                                    <ChevronRight size={18} style={{ color: "#64748b" }} />
                                )}
                            </Link>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}
