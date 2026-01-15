"use client";

import { useState } from "react";
import { X, Bot, Smartphone, Crown, ShoppingCart, RefreshCw, CheckCircle, AlertCircle } from "lucide-react";

interface ExtraPurchaseModalProps {
    isOpen: boolean;
    type: "agent" | "whatsapp";
    onClose: () => void;
}

export default function ExtraPurchaseModal({ isOpen, type, onClose }: ExtraPurchaseModalProps) {
    const [quantity, setQuantity] = useState(1);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const [success, setSuccess] = useState(false);

    const pricePerItem = 29.99;
    const totalPrice = pricePerItem * quantity;

    const handlePurchase = async () => {
        setLoading(true);
        setError("");

        try {
            const response = await fetch("/api/extras/checkout", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ type, quantity }),
            });

            const data = await response.json();

            if (data.success && (data.data.checkoutUrl || data.data.sandboxUrl)) {
                setSuccess(true);
                // Redirect to Mercado Pago checkout
                // Use sandbox URL for testing, checkoutUrl for production
                const checkoutUrl = data.data.checkoutUrl || data.data.sandboxUrl;
                setTimeout(() => {
                    window.location.href = checkoutUrl;
                }, 1500);
            } else {
                setError(data.error || "Erro ao criar checkout");
            }
        } catch {
            setError("Erro de conexão. Tente novamente.");
        } finally {
            setLoading(false);
        }
    };

    if (!isOpen) return null;

    const Icon = type === "agent" ? Bot : Smartphone;
    const title = type === "agent" ? "Agente IA Extra" : "WhatsApp Extra";
    const description = type === "agent"
        ? "Adicione mais agentes de IA para atender seus clientes simultaneamente."
        : "Conecte mais números de WhatsApp para expandir seu atendimento.";

    return (
        <div
            className="dash-modal-overlay"
            onClick={onClose}
        >
            <div
                className="dash-modal"
                style={{ maxWidth: 480 }}
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="dash-modal-header">
                    <h3 className="dash-modal-title" style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <ShoppingCart style={{ width: 20, height: 20, color: "#10b981" }} />
                        Adicionar Extra
                    </h3>
                    <button className="dash-modal-close" onClick={onClose}>
                        <X />
                    </button>
                </div>

                {/* Body */}
                <div className="dash-modal-body">
                    {success ? (
                        <div style={{ textAlign: "center", padding: "2rem 0" }}>
                            <div style={{
                                width: 64,
                                height: 64,
                                borderRadius: "50%",
                                background: "rgba(16, 185, 129, 0.15)",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                margin: "0 auto 16px"
                            }}>
                                <CheckCircle style={{ width: 32, height: 32, color: "#10b981" }} />
                            </div>
                            <h4 style={{ color: "white", fontSize: 18, margin: "0 0 8px" }}>
                                Redirecionando...
                            </h4>
                            <p style={{ color: "#94a3b8", fontSize: 14, margin: 0 }}>
                                Você será redirecionado para o Mercado Pago para finalizar o pagamento.
                            </p>
                            <div style={{ marginTop: 16 }}>
                                <RefreshCw style={{ width: 20, height: 20, color: "#10b981", animation: "spin 1s linear infinite" }} />
                            </div>
                        </div>
                    ) : (
                        <>
                            {/* Product Card */}
                            <div style={{
                                background: "rgba(16, 185, 129, 0.1)",
                                border: "1px solid rgba(16, 185, 129, 0.2)",
                                borderRadius: 12,
                                padding: 16,
                                marginBottom: 20,
                                display: "flex",
                                alignItems: "center",
                                gap: 16
                            }}>
                                <div style={{
                                    width: 56,
                                    height: 56,
                                    borderRadius: 12,
                                    background: "linear-gradient(135deg, #10b981, #059669)",
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    flexShrink: 0
                                }}>
                                    <Icon style={{ width: 28, height: 28, color: "white" }} />
                                </div>
                                <div>
                                    <h4 style={{ color: "white", fontSize: 16, fontWeight: 600, margin: "0 0 4px" }}>
                                        {title}
                                    </h4>
                                    <p style={{ color: "#94a3b8", fontSize: 13, margin: 0 }}>
                                        {description}
                                    </p>
                                </div>
                            </div>

                            {/* Quantity Selector */}
                            <div style={{ marginBottom: 20 }}>
                                <label style={{ color: "#d1d5db", fontSize: 14, fontWeight: 500, display: "block", marginBottom: 8 }}>
                                    Quantidade
                                </label>
                                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                                    <button
                                        onClick={() => setQuantity(Math.max(1, quantity - 1))}
                                        disabled={quantity <= 1}
                                        style={{
                                            width: 40,
                                            height: 40,
                                            borderRadius: 8,
                                            border: "1px solid rgba(255,255,255,0.1)",
                                            background: "rgba(255,255,255,0.05)",
                                            color: quantity <= 1 ? "#64748b" : "white",
                                            fontSize: 20,
                                            cursor: quantity <= 1 ? "not-allowed" : "pointer",
                                        }}
                                    >
                                        −
                                    </button>
                                    <span style={{
                                        fontSize: 24,
                                        fontWeight: 700,
                                        color: "white",
                                        minWidth: 40,
                                        textAlign: "center"
                                    }}>
                                        {quantity}
                                    </span>
                                    <button
                                        onClick={() => setQuantity(Math.min(5, quantity + 1))}
                                        disabled={quantity >= 5}
                                        style={{
                                            width: 40,
                                            height: 40,
                                            borderRadius: 8,
                                            border: "1px solid rgba(255,255,255,0.1)",
                                            background: "rgba(255,255,255,0.05)",
                                            color: quantity >= 5 ? "#64748b" : "white",
                                            fontSize: 20,
                                            cursor: quantity >= 5 ? "not-allowed" : "pointer",
                                        }}
                                    >
                                        +
                                    </button>
                                </div>
                            </div>

                            {/* Pricing */}
                            <div style={{
                                background: "rgba(0,0,0,0.2)",
                                borderRadius: 12,
                                padding: 16,
                                marginBottom: 20
                            }}>
                                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                                    <span style={{ color: "#94a3b8", fontSize: 14 }}>
                                        {title} x {quantity}
                                    </span>
                                    <span style={{ color: "#94a3b8", fontSize: 14 }}>
                                        R$ {(pricePerItem * quantity).toFixed(2)}
                                    </span>
                                </div>
                                <div style={{
                                    display: "flex",
                                    justifyContent: "space-between",
                                    borderTop: "1px solid rgba(255,255,255,0.1)",
                                    paddingTop: 12,
                                    marginTop: 8
                                }}>
                                    <span style={{ color: "white", fontSize: 16, fontWeight: 600 }}>
                                        Total mensal
                                    </span>
                                    <span style={{ color: "#10b981", fontSize: 20, fontWeight: 700 }}>
                                        R$ {totalPrice.toFixed(2)}
                                    </span>
                                </div>
                                <p style={{ color: "#64748b", fontSize: 11, marginTop: 8, marginBottom: 0 }}>
                                    * Cobrança mensal recorrente junto com seu plano
                                </p>
                            </div>

                            {/* Error */}
                            {error && (
                                <div style={{
                                    padding: "12px 16px",
                                    background: "rgba(239, 68, 68, 0.1)",
                                    border: "1px solid rgba(239, 68, 68, 0.2)",
                                    borderRadius: 8,
                                    color: "#f87171",
                                    fontSize: 14,
                                    display: "flex",
                                    alignItems: "center",
                                    gap: 8,
                                    marginBottom: 16
                                }}>
                                    <AlertCircle style={{ width: 16, height: 16, flexShrink: 0 }} />
                                    {error}
                                </div>
                            )}

                            {/* Benefits */}
                            <div style={{
                                background: "rgba(168, 85, 247, 0.08)",
                                border: "1px solid rgba(168, 85, 247, 0.15)",
                                borderRadius: 8,
                                padding: 12
                            }}>
                                <p style={{ color: "#a855f7", fontSize: 13, fontWeight: 600, margin: "0 0 6px" }}>
                                    <Crown style={{ width: 14, height: 14, display: "inline", marginRight: 6 }} />
                                    Benefícios inclusos:
                                </p>
                                <ul style={{ color: "#94a3b8", fontSize: 12, margin: 0, paddingLeft: 18 }}>
                                    <li>Ativação imediata após pagamento</li>
                                    <li>Sem fidelidade - cancele quando quiser</li>
                                    <li>Suporte prioritário por WhatsApp</li>
                                </ul>
                            </div>
                        </>
                    )}
                </div>

                {/* Footer */}
                {!success && (
                    <div className="dash-modal-footer" style={{ justifyContent: "space-between" }}>
                        <button
                            className="dash-btn secondary"
                            onClick={onClose}
                            disabled={loading}
                        >
                            Cancelar
                        </button>
                        <button
                            className="dash-btn primary"
                            onClick={handlePurchase}
                            disabled={loading}
                            style={{ minWidth: 160 }}
                        >
                            {loading ? (
                                <RefreshCw style={{ width: 16, height: 16, animation: "spin 1s linear infinite" }} />
                            ) : (
                                <>
                                    <ShoppingCart style={{ width: 16, height: 16 }} />
                                    Pagar R$ {totalPrice.toFixed(2)}
                                </>
                            )}
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}
