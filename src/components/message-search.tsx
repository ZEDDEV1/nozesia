"use client";

import { useState, useEffect } from "react";
import { Search, X, MessageCircle, Clock } from "lucide-react";
import { useDebounce } from "@/hooks/use-debounce";

interface SearchResult {
    conversationId: string;
    customerName: string | null;
    customerPhone: string;
    messages: Array<{
        id: string;
        content: string;
        sender: string;
        createdAt: string;
    }>;
}

interface MessageSearchProps {
    onSelectConversation: (conversationId: string) => void;
    onClose: () => void;
}

export function MessageSearch({ onSelectConversation, onClose }: MessageSearchProps) {
    const [query, setQuery] = useState("");
    const [results, setResults] = useState<SearchResult[]>([]);
    const [loading, setLoading] = useState(false);
    const [total, setTotal] = useState(0);

    const debouncedQuery = useDebounce(query, 400);

    useEffect(() => {
        if (debouncedQuery.length >= 2) {
            searchMessages();
        } else {
            setResults([]);
            setTotal(0);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [debouncedQuery]);

    const searchMessages = async () => {
        setLoading(true);
        try {
            const res = await fetch(`/api/messages/search?q=${encodeURIComponent(debouncedQuery)}&limit=30`);
            const data = await res.json();

            if (data.success) {
                setResults(data.data.results);
                setTotal(data.data.total);
            }
        } catch (error) {
            console.error("Search error:", error);
        } finally {
            setLoading(false);
        }
    };

    const formatDate = (date: string) => {
        return new Date(date).toLocaleDateString("pt-BR", {
            day: "2-digit",
            month: "short",
            hour: "2-digit",
            minute: "2-digit",
        });
    };

    const highlightMatch = (text: string, query: string) => {
        if (!query) return text;
        const regex = new RegExp(`(${query})`, "gi");
        const parts = text.split(regex);
        return parts.map((part, i) =>
            regex.test(part) ? (
                <mark key={i} style={{ background: "#fbbf24", color: "#000", borderRadius: 2, padding: "0 2px" }}>
                    {part}
                </mark>
            ) : part
        );
    };

    return (
        <div style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.7)",
            backdropFilter: "blur(4px)",
            display: "flex",
            alignItems: "flex-start",
            justifyContent: "center",
            paddingTop: "10vh",
            zIndex: 9999,
        }}>
            <div className="dash-card" style={{
                width: "100%",
                maxWidth: 600,
                maxHeight: "70vh",
                display: "flex",
                flexDirection: "column",
                margin: "0 1rem",
            }}>
                {/* Header */}
                <div style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "0.75rem",
                    padding: "1rem",
                    borderBottom: "1px solid rgba(255,255,255,0.1)",
                }}>
                    <Search size={20} style={{ color: "#64748b" }} />
                    <input
                        autoFocus
                        value={query}
                        onChange={e => setQuery(e.target.value)}
                        placeholder="Buscar nas mensagens..."
                        style={{
                            flex: 1,
                            background: "transparent",
                            border: "none",
                            color: "#e2e8f0",
                            fontSize: "1rem",
                            outline: "none",
                        }}
                    />
                    {query && (
                        <button onClick={() => setQuery("")} style={{ background: "none", border: "none", cursor: "pointer", color: "#64748b" }}>
                            <X size={18} />
                        </button>
                    )}
                    <button onClick={onClose} className="dash-btn secondary sm">
                        Fechar
                    </button>
                </div>

                {/* Results */}
                <div style={{ flex: 1, overflow: "auto", padding: "0.5rem" }}>
                    {loading ? (
                        <div style={{ textAlign: "center", padding: "2rem", color: "#64748b" }}>
                            Buscando...
                        </div>
                    ) : query.length < 2 ? (
                        <div style={{ textAlign: "center", padding: "2rem", color: "#64748b" }}>
                            Digite pelo menos 2 caracteres
                        </div>
                    ) : results.length === 0 ? (
                        <div style={{ textAlign: "center", padding: "2rem", color: "#64748b" }}>
                            Nenhum resultado para &quot;{query}&quot;
                        </div>
                    ) : (
                        <>
                            <div style={{ padding: "0.5rem", color: "#64748b", fontSize: "0.85rem" }}>
                                {total} mensagens encontradas
                            </div>
                            {results.map(result => (
                                <button
                                    key={result.conversationId}
                                    onClick={() => {
                                        onSelectConversation(result.conversationId);
                                        onClose();
                                    }}
                                    style={{
                                        width: "100%",
                                        textAlign: "left",
                                        padding: "0.75rem",
                                        background: "rgba(255,255,255,0.02)",
                                        border: "1px solid rgba(255,255,255,0.05)",
                                        borderRadius: 8,
                                        marginBottom: "0.5rem",
                                        cursor: "pointer",
                                    }}
                                >
                                    <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.5rem" }}>
                                        <MessageCircle size={14} style={{ color: "#10b981" }} />
                                        <span style={{ color: "#e2e8f0", fontWeight: 500 }}>
                                            {result.customerName || result.customerPhone}
                                        </span>
                                        <span style={{ color: "#64748b", fontSize: "0.75rem" }}>
                                            {result.messages.length} resultado(s)
                                        </span>
                                    </div>
                                    {result.messages.slice(0, 2).map(msg => (
                                        <div key={msg.id} style={{
                                            padding: "0.5rem",
                                            background: "rgba(0,0,0,0.2)",
                                            borderRadius: 6,
                                            marginBottom: "0.25rem",
                                        }}>
                                            <p style={{ color: "#94a3b8", fontSize: "0.85rem", margin: 0 }}>
                                                {highlightMatch(msg.content.substring(0, 150), query)}
                                                {msg.content.length > 150 && "..."}
                                            </p>
                                            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginTop: "0.25rem" }}>
                                                <Clock size={10} style={{ color: "#475569" }} />
                                                <span style={{ color: "#475569", fontSize: "0.7rem" }}>
                                                    {formatDate(msg.createdAt)}
                                                </span>
                                            </div>
                                        </div>
                                    ))}
                                </button>
                            ))}
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}
