"use client";

import { useState, useRef, useEffect } from "react";
import { Send, Bot, User, Trash2, X, Play } from "lucide-react";

interface Message {
    id: string;
    content: string;
    sender: "user" | "agent";
    timestamp: Date;
}

interface AgentPlaygroundProps {
    agentId: string;
    agentName: string;
    onClose: () => void;
}

export function AgentPlayground({ agentId, agentName, onClose }: AgentPlaygroundProps) {
    const [messages, setMessages] = useState<Message[]>([]);
    const [input, setInput] = useState("");
    const [loading, setLoading] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages]);

    const sendMessage = async () => {
        if (!input.trim() || loading) return;

        const userMessage: Message = {
            id: `user-${Date.now()}`,
            content: input,
            sender: "user",
            timestamp: new Date(),
        };

        setMessages(prev => [...prev, userMessage]);
        setInput("");
        setLoading(true);

        try {
            const res = await fetch(`/api/agents/${agentId}/playground`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ message: input }),
            });

            const data = await res.json();

            if (data.success) {
                const agentMessage: Message = {
                    id: `agent-${Date.now()}`,
                    content: data.data.message,
                    sender: "agent",
                    timestamp: new Date(),
                };
                setMessages(prev => [...prev, agentMessage]);
            } else {
                const errorMessage: Message = {
                    id: `error-${Date.now()}`,
                    content: `Erro: ${data.error || "Falha ao processar"}`,
                    sender: "agent",
                    timestamp: new Date(),
                };
                setMessages(prev => [...prev, errorMessage]);
            }
        } catch {
            const errorMessage: Message = {
                id: `error-${Date.now()}`,
                content: "Erro de conexão",
                sender: "agent",
                timestamp: new Date(),
            };
            setMessages(prev => [...prev, errorMessage]);
        } finally {
            setLoading(false);
        }
    };

    const clearMessages = () => {
        setMessages([]);
    };

    return (
        <div style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.8)",
            backdropFilter: "blur(4px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 9999,
        }}>
            <div className="dash-card" style={{
                width: "100%",
                maxWidth: 500,
                height: "70vh",
                maxHeight: 600,
                display: "flex",
                flexDirection: "column",
                margin: "0 1rem",
            }}>
                {/* Header */}
                <div style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "1rem",
                    borderBottom: "1px solid rgba(255,255,255,0.1)",
                }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                        <div style={{
                            width: 36,
                            height: 36,
                            borderRadius: 8,
                            background: "linear-gradient(135deg, #10b981 0%, #3b82f6 100%)",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                        }}>
                            <Play size={18} style={{ color: "white" }} />
                        </div>
                        <div>
                            <h3 style={{ color: "#e2e8f0", fontSize: "1rem", fontWeight: 600, margin: 0 }}>
                                Playground
                            </h3>
                            <p style={{ color: "#64748b", fontSize: "0.8rem", margin: 0 }}>
                                Testando: {agentName}
                            </p>
                        </div>
                    </div>
                    <div style={{ display: "flex", gap: "0.5rem" }}>
                        <button
                            onClick={clearMessages}
                            style={{
                                background: "none",
                                border: "none",
                                cursor: "pointer",
                                color: "#64748b",
                                padding: "0.25rem",
                            }}
                            title="Limpar conversa"
                        >
                            <Trash2 size={18} />
                        </button>
                        <button
                            onClick={onClose}
                            style={{
                                background: "none",
                                border: "none",
                                cursor: "pointer",
                                color: "#64748b",
                                padding: "0.25rem",
                            }}
                        >
                            <X size={20} />
                        </button>
                    </div>
                </div>

                {/* Messages */}
                <div style={{
                    flex: 1,
                    overflow: "auto",
                    padding: "1rem",
                    display: "flex",
                    flexDirection: "column",
                    gap: "0.75rem",
                }}>
                    {messages.length === 0 ? (
                        <div style={{
                            flex: 1,
                            display: "flex",
                            flexDirection: "column",
                            alignItems: "center",
                            justifyContent: "center",
                            color: "#64748b",
                            textAlign: "center",
                        }}>
                            <Bot size={48} style={{ opacity: 0.5, marginBottom: "1rem" }} />
                            <p style={{ margin: 0 }}>Envie uma mensagem para testar o agente</p>
                            <p style={{ fontSize: "0.8rem", marginTop: "0.5rem" }}>
                                Simula como o agente responderia a clientes
                            </p>
                        </div>
                    ) : (
                        messages.map(msg => (
                            <div
                                key={msg.id}
                                style={{
                                    display: "flex",
                                    justifyContent: msg.sender === "user" ? "flex-end" : "flex-start",
                                }}
                            >
                                <div style={{
                                    maxWidth: "80%",
                                    padding: "0.75rem 1rem",
                                    borderRadius: msg.sender === "user"
                                        ? "16px 16px 4px 16px"
                                        : "16px 16px 16px 4px",
                                    background: msg.sender === "user"
                                        ? "linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)"
                                        : "rgba(255,255,255,0.05)",
                                    border: msg.sender === "agent"
                                        ? "1px solid rgba(255,255,255,0.1)"
                                        : "none",
                                }}>
                                    <div style={{
                                        display: "flex",
                                        alignItems: "center",
                                        gap: "0.5rem",
                                        marginBottom: "0.25rem",
                                    }}>
                                        {msg.sender === "agent" ? (
                                            <Bot size={12} style={{ color: "#10b981" }} />
                                        ) : (
                                            <User size={12} style={{ color: "white" }} />
                                        )}
                                        <span style={{
                                            fontSize: "0.7rem",
                                            color: msg.sender === "user" ? "rgba(255,255,255,0.7)" : "#64748b",
                                        }}>
                                            {msg.sender === "agent" ? agentName : "Você"}
                                        </span>
                                    </div>
                                    <p style={{
                                        color: msg.sender === "user" ? "white" : "#e2e8f0",
                                        fontSize: "0.9rem",
                                        margin: 0,
                                        lineHeight: 1.5,
                                        whiteSpace: "pre-wrap",
                                    }}>
                                        {msg.content}
                                    </p>
                                </div>
                            </div>
                        ))
                    )}
                    {loading && (
                        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                            <div style={{
                                width: 8,
                                height: 8,
                                borderRadius: "50%",
                                background: "#10b981",
                                animation: "pulse 1s infinite",
                            }} />
                            <span style={{ color: "#64748b", fontSize: "0.85rem" }}>
                                {agentName} está digitando...
                            </span>
                        </div>
                    )}
                    <div ref={messagesEndRef} />
                </div>

                {/* Input */}
                <div style={{
                    padding: "1rem",
                    borderTop: "1px solid rgba(255,255,255,0.1)",
                }}>
                    <div style={{ display: "flex", gap: "0.5rem" }}>
                        <input
                            value={input}
                            onChange={e => setInput(e.target.value)}
                            onKeyDown={e => e.key === "Enter" && sendMessage()}
                            placeholder="Digite uma mensagem de teste..."
                            style={{
                                flex: 1,
                                padding: "0.75rem 1rem",
                                background: "rgba(255,255,255,0.05)",
                                border: "1px solid rgba(255,255,255,0.1)",
                                borderRadius: 8,
                                color: "#e2e8f0",
                                fontSize: "0.9rem",
                            }}
                            disabled={loading}
                        />
                        <button
                            onClick={sendMessage}
                            disabled={!input.trim() || loading}
                            className="dash-btn primary"
                            style={{ padding: "0 1rem" }}
                        >
                            <Send size={18} />
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
