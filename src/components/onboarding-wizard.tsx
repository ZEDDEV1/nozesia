"use client";

import { useState } from "react";
import {
    MessageCircle,
    Bot,
    Smartphone,
    BrainCircuit,
    CheckCircle,
    ArrowRight,
    X,
    Sparkles
} from "lucide-react";

interface OnboardingStep {
    id: number;
    title: string;
    description: string;
    icon: React.ReactNode;
    action?: string;
    actionLink?: string;
}

const ONBOARDING_STEPS: OnboardingStep[] = [
    {
        id: 1,
        title: "Conecte o WhatsApp",
        description: "Vincule seu número de WhatsApp para começar a receber mensagens automaticamente.",
        icon: <Smartphone size={32} />,
        action: "Conectar WhatsApp",
        actionLink: "/dashboard/whatsapp"
    },
    {
        id: 2,
        title: "Crie seu Agente de IA",
        description: "Configure um agente inteligente para responder seus clientes 24/7.",
        icon: <Bot size={32} />,
        action: "Criar Agente",
        actionLink: "/dashboard/agents/new"
    },
    {
        id: 3,
        title: "Treine com seus dados",
        description: "Adicione FAQs, catálogos e informações para personalizar as respostas.",
        icon: <BrainCircuit size={32} />,
        action: "Ver Agentes",
        actionLink: "/dashboard/agents"
    },
    {
        id: 4,
        title: "Pronto para atender!",
        description: "Seu assistente está configurado. Acompanhe as conversas em tempo real.",
        icon: <MessageCircle size={32} />,
        action: "Ver Conversas",
        actionLink: "/dashboard/conversations"
    }
];

interface OnboardingWizardProps {
    onComplete: () => void;
    onSkip: () => void;
    currentStep?: number;
}

export function OnboardingWizard({ onComplete, onSkip, currentStep = 0 }: OnboardingWizardProps) {
    const [step, setStep] = useState(currentStep);
    const [isAnimating, setIsAnimating] = useState(false);

    const handleNext = () => {
        if (step < ONBOARDING_STEPS.length - 1) {
            setIsAnimating(true);
            setTimeout(() => {
                setStep(step + 1);
                setIsAnimating(false);
            }, 200);
        } else {
            onComplete();
        }
    };

    const handleSkip = () => {
        onSkip();
    };

    const handleStepAction = () => {
        const currentStepData = ONBOARDING_STEPS[step];
        if (currentStepData.actionLink) {
            window.location.href = currentStepData.actionLink;
        }
    };

    const progress = ((step + 1) / ONBOARDING_STEPS.length) * 100;
    const currentStepData = ONBOARDING_STEPS[step];

    return (
        <div className="onboarding-overlay">
            <div className="onboarding-modal">
                {/* Header */}
                <div className="onboarding-header">
                    <div className="onboarding-logo">
                        <Sparkles size={20} />
                        <span>NozesIA</span>
                    </div>
                    <button onClick={handleSkip} className="onboarding-skip" title="Pular tour">
                        <X size={18} />
                    </button>
                </div>

                {/* Progress */}
                <div className="onboarding-progress">
                    <div className="onboarding-progress-bar" style={{ width: `${progress}%` }} />
                </div>

                {/* Steps indicator */}
                <div className="onboarding-steps">
                    {ONBOARDING_STEPS.map((s, i) => (
                        <div
                            key={s.id}
                            className={`onboarding-step-dot ${i <= step ? "active" : ""} ${i === step ? "current" : ""}`}
                        >
                            {i < step ? <CheckCircle size={16} /> : <span>{i + 1}</span>}
                        </div>
                    ))}
                </div>

                {/* Content */}
                <div className={`onboarding-content ${isAnimating ? "animating" : ""}`}>
                    <div className="onboarding-icon">
                        {currentStepData.icon}
                    </div>
                    <h2 className="onboarding-title">{currentStepData.title}</h2>
                    <p className="onboarding-description">{currentStepData.description}</p>
                </div>

                {/* Actions */}
                <div className="onboarding-actions">
                    {currentStepData.action && (
                        <button onClick={handleStepAction} className="onboarding-btn secondary">
                            {currentStepData.action}
                        </button>
                    )}
                    <button onClick={handleNext} className="onboarding-btn primary">
                        {step === ONBOARDING_STEPS.length - 1 ? "Concluir" : "Próximo"}
                        <ArrowRight size={16} />
                    </button>
                </div>

                {/* Footer hint */}
                <p className="onboarding-hint">
                    Passo {step + 1} de {ONBOARDING_STEPS.length}
                </p>
            </div>
        </div>
    );
}

// Mini banner for dashboard (shows if onboarding incomplete)
export function OnboardingBanner({ step, onResume }: { step: number; onResume: () => void }) {
    const remaining = ONBOARDING_STEPS.length - step;

    return (
        <div className="onboarding-banner">
            <div className="onboarding-banner-content">
                <Sparkles size={18} />
                <span>Complete a configuração: {remaining} passo{remaining > 1 ? "s" : ""} restante{remaining > 1 ? "s" : ""}</span>
            </div>
            <button onClick={onResume} className="onboarding-banner-btn">
                Continuar
                <ArrowRight size={14} />
            </button>
        </div>
    );
}
