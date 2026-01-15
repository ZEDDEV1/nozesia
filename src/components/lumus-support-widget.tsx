"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { MessageCircle, X, Send, Bot, User, Loader2, Sparkles } from "lucide-react";

interface Message {
    id: string;
    sender: "USER" | "AI" | "ADMIN";
    content: string;
    createdAt: string;
    actionType?: string;
    actionData?: string;
}

export function LumusSupportWidget() {
    const [isOpen, setIsOpen] = useState(false);
    const [messages, setMessages] = useState<Message[]>([]);
    const [input, setInput] = useState("");
    const [loading, setLoading] = useState(false);
    const [ticketId, setTicketId] = useState<string | null>(null);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    // Scroll para última mensagem
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages]);

    // Carregar histórico se existir ticket
    const loadTicketHistory = useCallback(async () => {
        try {
            const res = await fetch("/api/support/chat");
            const data = await res.json();
            if (data.success && data.data) {
                setTicketId(data.data.ticketId);
                setMessages(data.data.messages || []);
            }
        } catch (error) {
            console.error("[LumusSupport] Failed to load history", error);
        }
    }, []);

    useEffect(() => {
        if (isOpen && messages.length === 0) {
            loadTicketHistory();
        }
    }, [isOpen, messages.length, loadTicketHistory]);

    const sendMessage = async () => {
        if (!input.trim() || loading) return;

        const userMessage: Message = {
            id: `temp-${Date.now()}`,
            sender: "USER",
            content: input.trim(),
            createdAt: new Date().toISOString(),
        };

        setMessages(prev => [...prev, userMessage]);
        setInput("");
        setLoading(true);

        try {
            const res = await fetch("/api/support/chat", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ message: input.trim(), ticketId }),
            });

            const data = await res.json();

            if (data.success) {
                setTicketId(data.data.ticketId);

                const aiMessage: Message = {
                    id: data.data.messageId || `ai-${Date.now()}`,
                    sender: "AI",
                    content: data.data.response,
                    createdAt: new Date().toISOString(),
                    actionType: data.data.actionType,
                    actionData: data.data.actionData,
                };

                setMessages(prev => [...prev, aiMessage]);

                // Executar ação se houver
                if (data.data.actionType) {
                    handleAction(data.data.actionType, data.data.actionData);
                }
            }
        } catch (error) {
            console.error("[LumusSupport] Send error", error);
            const errorMessage: Message = {
                id: `error-${Date.now()}`,
                sender: "AI",
                content: "Desculpe, tive um probleminha. Tenta de novo?",
                createdAt: new Date().toISOString(),
            };
            setMessages(prev => [...prev, errorMessage]);
        } finally {
            setLoading(false);
        }
    };

    const handleAction = (actionType: string, actionData?: string) => {
        switch (actionType) {
            case "OPEN_PAGE":
                if (actionData) {
                    window.location.href = actionData;
                }
                break;
            case "RECONNECT_WHATSAPP":
                window.location.href = "/dashboard/whatsapp";
                break;
            // Adicionar mais ações conforme necessário
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    };

    return (
        <>
            {/* External Close Button - Shows above floating button when open */}
            {isOpen && (
                <button
                    onClick={() => setIsOpen(false)}
                    className="lumus-support-close-external"
                    aria-label="Fechar suporte Lumus"
                >
                    <X size={16} />
                </button>
            )}

            {/* Floating Button */}
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="lumus-support-button"
                aria-label="Abrir suporte Lumus"
            >
                {isOpen ? (
                    <X size={24} />
                ) : (
                    <MessageCircle size={24} />
                )}
            </button>

            {/* Chat Window */}
            {isOpen && (
                <div className="lumus-support-window">
                    {/* Header */}
                    <div className="lumus-support-header">
                        <div className="lumus-support-header-info">
                            <div className="lumus-support-avatar">
                                <Sparkles size={20} />
                            </div>
                            <div>
                                <h3>Suporte Lumus</h3>
                                <span className="lumus-support-status">
                                    <span className="status-dot" />
                                    Online
                                </span>
                            </div>
                        </div>
                        <button onClick={() => setIsOpen(false)} className="lumus-support-close">
                            <X size={20} />
                        </button>
                    </div>

                    {/* Messages */}
                    <div className="lumus-support-messages">
                        {messages.length === 0 && !loading && (
                            <div className="lumus-support-welcome">
                                <Sparkles size={40} className="welcome-icon" />
                                <h4>Olá! Sou a Lumus 👋</h4>
                                <p>Como posso te ajudar hoje?</p>
                                <div className="quick-questions">
                                    {[
                                        "Como conectar o WhatsApp?",
                                        "Como criar um agente?",
                                        "Meu limite de tokens",
                                    ].map((q, i) => (
                                        <button
                                            key={i}
                                            onClick={() => {
                                                setInput(q);
                                                setTimeout(() => sendMessage(), 100);
                                            }}
                                            className="quick-question"
                                        >
                                            {q}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}

                        {messages.map((msg) => (
                            <div
                                key={msg.id}
                                className={`lumus-message ${msg.sender === "USER" ? "user" : "ai"}`}
                            >
                                <div className="message-avatar">
                                    {msg.sender === "USER" ? (
                                        <User size={16} />
                                    ) : (
                                        <Bot size={16} />
                                    )}
                                </div>
                                <div className="message-content">
                                    <p>{msg.content}</p>
                                    {msg.actionType && (
                                        <button
                                            className="message-action"
                                            onClick={() => handleAction(msg.actionType!, msg.actionData)}
                                        >
                                            Ir para página →
                                        </button>
                                    )}
                                </div>
                            </div>
                        ))}

                        {loading && (
                            <div className="lumus-message ai">
                                <div className="message-avatar">
                                    <Bot size={16} />
                                </div>
                                <div className="message-content typing">
                                    <Loader2 size={16} className="spin" />
                                    <span>Pensando...</span>
                                </div>
                            </div>
                        )}

                        <div ref={messagesEndRef} />
                    </div>

                    {/* Input */}
                    <div className="lumus-support-input">
                        <input
                            type="text"
                            placeholder="Digite sua dúvida..."
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            onKeyDown={handleKeyDown}
                            disabled={loading}
                        />
                        <button
                            onClick={sendMessage}
                            disabled={!input.trim() || loading}
                            className="send-button"
                        >
                            <Send size={18} />
                        </button>
                    </div>
                </div>
            )}

            <style jsx>{`
                .lumus-support-button {
                    position: fixed;
                    bottom: 24px;
                    right: 24px;
                    width: 56px;
                    height: 56px;
                    border-radius: 50%;
                    background: linear-gradient(135deg, #8b5cf6 0%, #6366f1 100%);
                    border: none;
                    color: white;
                    cursor: pointer;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    box-shadow: 0 4px 20px rgba(139, 92, 246, 0.4);
                    transition: all 0.3s ease;
                    z-index: 9999;
                }

                .lumus-support-button:hover {
                    transform: scale(1.1);
                    box-shadow: 0 6px 25px rgba(139, 92, 246, 0.5);
                }

                .lumus-support-close-external {
                    position: fixed;
                    bottom: 88px;
                    right: 24px;
                    width: 24px;
                    height: 24px;
                    border-radius: 50%;
                    background: rgba(239, 68, 68, 0.9);
                    border: 2px solid white;
                    color: white;
                    cursor: pointer;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    box-shadow: 0 2px 10px rgba(0, 0, 0, 0.3);
                    transition: all 0.2s ease;
                    z-index: 10000;
                }

                .lumus-support-close-external:hover {
                    transform: scale(1.1);
                    background: rgba(239, 68, 68, 1);
                }

                .lumus-support-window {
                    position: fixed;
                    bottom: 96px;
                    right: 24px;
                    width: 380px;
                    height: 520px;
                    background: #0f172a;
                    border-radius: 16px;
                    border: 1px solid rgba(255, 255, 255, 0.1);
                    display: flex;
                    flex-direction: column;
                    overflow: hidden;
                    box-shadow: 0 10px 40px rgba(0, 0, 0, 0.5);
                    z-index: 9999;
                    animation: slideUp 0.3s ease;
                }

                @keyframes slideUp {
                    from {
                        opacity: 0;
                        transform: translateY(20px);
                    }
                    to {
                        opacity: 1;
                        transform: translateY(0);
                    }
                }

                .lumus-support-header {
                    padding: 16px;
                    background: linear-gradient(135deg, #8b5cf6 0%, #6366f1 100%);
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                }

                .lumus-support-header-info {
                    display: flex;
                    align-items: center;
                    gap: 12px;
                }

                .lumus-support-avatar {
                    width: 40px;
                    height: 40px;
                    border-radius: 50%;
                    background: rgba(255, 255, 255, 0.2);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    color: white;
                }

                .lumus-support-header h3 {
                    color: white;
                    font-size: 16px;
                    font-weight: 600;
                    margin: 0;
                }

                .lumus-support-status {
                    display: flex;
                    align-items: center;
                    gap: 6px;
                    font-size: 12px;
                    color: rgba(255, 255, 255, 0.8);
                }

                .status-dot {
                    width: 8px;
                    height: 8px;
                    border-radius: 50%;
                    background: #10b981;
                }

                .lumus-support-close {
                    background: rgba(255, 255, 255, 0.2);
                    border: none;
                    border-radius: 8px;
                    padding: 8px;
                    color: white;
                    cursor: pointer;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                }

                .lumus-support-messages {
                    flex: 1;
                    overflow-y: auto;
                    padding: 16px;
                    display: flex;
                    flex-direction: column;
                    gap: 12px;
                }

                .lumus-support-welcome {
                    text-align: center;
                    padding: 24px;
                    color: #94a3b8;
                }

                .welcome-icon {
                    color: #8b5cf6;
                    margin-bottom: 16px;
                }

                .lumus-support-welcome h4 {
                    color: white;
                    font-size: 18px;
                    margin: 0 0 8px;
                }

                .lumus-support-welcome p {
                    margin: 0 0 20px;
                }

                .quick-questions {
                    display: flex;
                    flex-direction: column;
                    gap: 8px;
                }

                .quick-question {
                    padding: 10px 16px;
                    background: rgba(139, 92, 246, 0.1);
                    border: 1px solid rgba(139, 92, 246, 0.3);
                    border-radius: 8px;
                    color: #a78bfa;
                    font-size: 13px;
                    cursor: pointer;
                    transition: all 0.2s;
                    text-align: left;
                }

                .quick-question:hover {
                    background: rgba(139, 92, 246, 0.2);
                    border-color: rgba(139, 92, 246, 0.5);
                }

                .lumus-message {
                    display: flex;
                    gap: 8px;
                    max-width: 85%;
                }

                .lumus-message.user {
                    align-self: flex-end;
                    flex-direction: row-reverse;
                }

                .message-avatar {
                    width: 28px;
                    height: 28px;
                    border-radius: 50%;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    flex-shrink: 0;
                }

                .lumus-message.ai .message-avatar {
                    background: linear-gradient(135deg, #8b5cf6 0%, #6366f1 100%);
                    color: white;
                }

                .lumus-message.user .message-avatar {
                    background: #1e293b;
                    color: #94a3b8;
                }

                .message-content {
                    padding: 10px 14px;
                    border-radius: 12px;
                    font-size: 14px;
                    line-height: 1.5;
                }

                .lumus-message.ai .message-content {
                    background: #1e293b;
                    color: #e2e8f0;
                    border-bottom-left-radius: 4px;
                }

                .lumus-message.user .message-content {
                    background: linear-gradient(135deg, #8b5cf6 0%, #6366f1 100%);
                    color: white;
                    border-bottom-right-radius: 4px;
                }

                .message-content p {
                    margin: 0;
                    white-space: pre-wrap;
                }

                .message-content.typing {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    color: #94a3b8;
                }

                .spin {
                    animation: spin 1s linear infinite;
                }

                @keyframes spin {
                    from { transform: rotate(0deg); }
                    to { transform: rotate(360deg); }
                }

                .message-action {
                    margin-top: 8px;
                    padding: 6px 12px;
                    background: rgba(139, 92, 246, 0.2);
                    border: 1px solid rgba(139, 92, 246, 0.4);
                    border-radius: 6px;
                    color: #a78bfa;
                    font-size: 12px;
                    cursor: pointer;
                    transition: all 0.2s;
                }

                .message-action:hover {
                    background: rgba(139, 92, 246, 0.3);
                }

                .lumus-support-input {
                    padding: 12px 16px;
                    background: #1e293b;
                    display: flex;
                    gap: 8px;
                    border-top: 1px solid rgba(255, 255, 255, 0.1);
                }

                .lumus-support-input input {
                    flex: 1;
                    background: #0f172a;
                    border: 1px solid rgba(255, 255, 255, 0.1);
                    border-radius: 8px;
                    padding: 10px 14px;
                    color: white;
                    font-size: 14px;
                    outline: none;
                }

                .lumus-support-input input:focus {
                    border-color: #8b5cf6;
                }

                .lumus-support-input input::placeholder {
                    color: #64748b;
                }

                .send-button {
                    width: 40px;
                    height: 40px;
                    border-radius: 8px;
                    background: linear-gradient(135deg, #8b5cf6 0%, #6366f1 100%);
                    border: none;
                    color: white;
                    cursor: pointer;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    transition: all 0.2s;
                }

                .send-button:hover:not(:disabled) {
                    transform: scale(1.05);
                }

                .send-button:disabled {
                    opacity: 0.5;
                    cursor: not-allowed;
                }

                @media (max-width: 480px) {
                    .lumus-support-window {
                        width: calc(100vw - 32px);
                        height: calc(100vh - 120px);
                        bottom: 88px;
                        right: 16px;
                    }
                }
            `}</style>
        </>
    );
}
