"use client";

/**
 * 2FA Verification Page
 * 
 * Shown after password login if user has 2FA enabled.
 */

import { useState, useEffect, useRef, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Shield, ArrowLeft, Loader2 } from "lucide-react";

const styles = {
    page: {
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'linear-gradient(135deg, #0a0a0b 0%, #1a1a2e 100%)',
        padding: '20px',
    } as React.CSSProperties,
    card: {
        background: 'rgba(255, 255, 255, 0.03)',
        border: '1px solid rgba(255, 255, 255, 0.08)',
        borderRadius: '20px',
        padding: '48px',
        maxWidth: '420px',
        width: '100%',
        textAlign: 'center' as const,
    } as React.CSSProperties,
    icon: {
        width: '72px',
        height: '72px',
        borderRadius: '50%',
        background: 'rgba(59, 130, 246, 0.1)',
        color: '#3b82f6',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        margin: '0 auto 24px',
    } as React.CSSProperties,
    title: {
        color: '#f1f5f9',
        fontSize: '24px',
        fontWeight: 600,
        marginBottom: '8px',
    } as React.CSSProperties,
    subtitle: {
        color: '#94a3b8',
        fontSize: '14px',
        marginBottom: '32px',
    } as React.CSSProperties,
    codeInputs: {
        display: 'flex',
        gap: '10px',
        justifyContent: 'center',
        marginBottom: '28px',
    } as React.CSSProperties,
    codeInput: {
        width: '50px',
        height: '56px',
        fontSize: '24px',
        fontWeight: 600,
        textAlign: 'center' as const,
        background: 'rgba(255, 255, 255, 0.05)',
        border: '2px solid rgba(255, 255, 255, 0.1)',
        borderRadius: '12px',
        color: '#f1f5f9',
        outline: 'none',
    } as React.CSSProperties,
    btn: {
        width: '100%',
        padding: '14px 24px',
        fontSize: '15px',
        fontWeight: 600,
        borderRadius: '10px',
        border: 'none',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '8px',
    } as React.CSSProperties,
    btnPrimary: {
        background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)',
        color: 'white',
    } as React.CSSProperties,
    btnLink: {
        background: 'transparent',
        color: '#94a3b8',
        marginTop: '16px',
    } as React.CSSProperties,
    error: {
        color: '#ef4444',
        fontSize: '13px',
        marginBottom: '16px',
        padding: '12px',
        background: 'rgba(239, 68, 68, 0.1)',
        borderRadius: '8px',
    } as React.CSSProperties,
    loading: {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        background: 'linear-gradient(135deg, #0a0a0b 0%, #1a1a2e 100%)',
    } as React.CSSProperties,
};

function TwoFactorContent() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const userId = searchParams.get("userId");
    const returnUrl = searchParams.get("returnUrl") || "/dashboard";

    const [code, setCode] = useState(["", "", "", "", "", ""]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

    useEffect(() => {
        // Focus first input on mount
        inputRefs.current[0]?.focus();
    }, []);

    useEffect(() => {
        // Auto-submit when all digits are entered
        if (code.every(digit => digit !== "") && code.join("").length === 6) {
            handleSubmit();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [code]);

    const handleInputChange = (index: number, value: string) => {
        // Only allow numbers
        if (value && !/^\d$/.test(value)) return;

        const newCode = [...code];
        newCode[index] = value;
        setCode(newCode);
        setError("");

        // Move to next input
        if (value && index < 5) {
            inputRefs.current[index + 1]?.focus();
        }
    };

    const handleKeyDown = (index: number, e: React.KeyboardEvent) => {
        // Move to previous input on backspace if current is empty
        if (e.key === "Backspace" && !code[index] && index > 0) {
            inputRefs.current[index - 1]?.focus();
        }
    };

    const handlePaste = (e: React.ClipboardEvent) => {
        e.preventDefault();
        const pastedData = e.clipboardData.getData("text").slice(0, 6);
        if (/^\d+$/.test(pastedData)) {
            const newCode = pastedData.split("");
            while (newCode.length < 6) newCode.push("");
            setCode(newCode);
            inputRefs.current[Math.min(pastedData.length, 5)]?.focus();
        }
    };

    const handleSubmit = async () => {
        const token = code.join("");
        if (token.length !== 6) {
            setError("Digite o código completo");
            return;
        }

        if (!userId) {
            setError("Sessão inválida. Faça login novamente.");
            return;
        }

        setLoading(true);
        setError("");

        try {
            const response = await fetch("/api/auth/2fa/verify", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ userId, token }),
            });

            const data = await response.json();

            if (data.success) {
                router.push(returnUrl);
            } else {
                setError(data.error || "Código inválido");
                setCode(["", "", "", "", "", ""]);
                inputRefs.current[0]?.focus();
            }
        } catch {
            setError("Erro de conexão");
        } finally {
            setLoading(false);
        }
    };

    const handleBackToLogin = () => {
        router.push("/login");
    };

    return (
        <div style={styles.page}>
            <div style={styles.card}>
                <div style={styles.icon}>
                    <Shield size={36} />
                </div>

                <h1 style={styles.title}>Verificação em duas etapas</h1>
                <p style={styles.subtitle}>
                    Digite o código de 6 dígitos do seu app autenticador.
                </p>

                {error && <div style={styles.error}>{error}</div>}

                <div style={styles.codeInputs} onPaste={handlePaste}>
                    {code.map((digit, index) => (
                        <input
                            key={index}
                            ref={el => { inputRefs.current[index] = el; }}
                            type="text"
                            inputMode="numeric"
                            maxLength={1}
                            value={digit}
                            onChange={e => handleInputChange(index, e.target.value)}
                            onKeyDown={e => handleKeyDown(index, e)}
                            style={{
                                ...styles.codeInput,
                                borderColor: digit ? '#3b82f6' : 'rgba(255, 255, 255, 0.1)',
                            }}
                            disabled={loading}
                        />
                    ))}
                </div>

                <button
                    onClick={handleSubmit}
                    disabled={loading || code.join("").length !== 6}
                    style={{
                        ...styles.btn,
                        ...styles.btnPrimary,
                        opacity: loading || code.join("").length !== 6 ? 0.6 : 1,
                    }}
                >
                    {loading ? (
                        <>
                            <Loader2 size={18} className="animate-spin" />
                            Verificando...
                        </>
                    ) : (
                        "Verificar"
                    )}
                </button>

                <button
                    onClick={handleBackToLogin}
                    style={{ ...styles.btn, ...styles.btnLink }}
                >
                    <ArrowLeft size={16} />
                    Voltar para login
                </button>
            </div>
        </div>
    );
}

function LoadingFallback() {
    return (
        <div style={styles.loading}>
            <Loader2 size={32} color="#3b82f6" className="animate-spin" />
        </div>
    );
}

export default function TwoFactorVerifyPage() {
    return (
        <Suspense fallback={<LoadingFallback />}>
            <TwoFactorContent />
        </Suspense>
    );
}

