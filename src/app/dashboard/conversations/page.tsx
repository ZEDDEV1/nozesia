"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useConversationsListSocket, useConversationSocket } from "@/lib/socket-client";
import { notifyNewMessage, initNotifications } from "@/lib/notifications";
import { NotificationPermissionBanner } from "@/components/notification-permission-banner";
import { QuickReplies } from "@/components/quick-replies";
import { ConversationTags } from "@/components/conversation-tags";
import { AssignConversation } from "@/components/assign-conversation";
import { MediaUploader } from "@/components/media-uploader";
import { AudioRecorder } from "@/components/audio-recorder";
import { ErrorBoundary } from "@/components/error-boundary";
import { logger } from "@/lib/logger";
import { formatRelativeDate } from "@/lib/date-utils";
import { MessageBubble } from "./message-bubble";
import {
    Message,
    Conversation,
    FilterType,
    ConversationAction,
    FILTER_OPTIONS,
    ACTION_STATUS_MAP,
    STATUS_CONFIG,
    ERROR_MESSAGES,
    ACTION_CONFIRMATIONS,
    getErrorMessage,
    NOTIFICATION_BEEP_FREQUENCY,
    NOTIFICATION_VOLUME,
    NOTIFICATION_BEEP_DURATION,
    POLLING_INTERVAL_DISCONNECTED,
    MESSAGES_POLLING_INTERVAL,
    SCROLL_BOTTOM_THRESHOLD,
} from "./conversations-types";
import {
    Search,
    Send,
    Bot,
    MessageCircle,
    ArrowLeft,
    RefreshCw,
    X,
    Paperclip,
    Power,
} from "lucide-react";

import "./conversations.css";

// Cache do AudioContext para reutilização
let cachedAudioContext: AudioContext | null = null;
const playNotificationSound = () => {
    try {
        const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof window.AudioContext }).webkitAudioContext;
        if (!AudioContextClass) return;

        if (!cachedAudioContext || cachedAudioContext.state === "closed") {
            cachedAudioContext = new AudioContextClass();
        }

        if (cachedAudioContext.state === "suspended") {
            cachedAudioContext.resume();
        }

        const oscillator = cachedAudioContext.createOscillator();
        const gainNode = cachedAudioContext.createGain();
        oscillator.connect(gainNode);
        gainNode.connect(cachedAudioContext.destination);
        oscillator.frequency.value = NOTIFICATION_BEEP_FREQUENCY;
        gainNode.gain.value = NOTIFICATION_VOLUME;
        oscillator.start();
        oscillator.stop(cachedAudioContext.currentTime + NOTIFICATION_BEEP_DURATION);
    } catch {
        // Silently fail if audio not available
    }
};

export default function ConversationsPage() {
    const [conversations, setConversations] = useState<Conversation[]>([]);
    const [selectedConv, setSelectedConv] = useState<Conversation | null>(null);
    const [messages, setMessages] = useState<Message[]>([]);
    const [loading, setLoading] = useState(true);
    const [loadingMsgs, setLoadingMsgs] = useState(false);
    const [search, setSearch] = useState("");
    const [filter, setFilter] = useState<FilterType>("all");
    const [newMessage, setNewMessage] = useState("");
    const [sending, setSending] = useState(false);
    const [error, setError] = useState("");
    const [companyId, setCompanyId] = useState<string>("");
    const [isTyping, setIsTyping] = useState(false);
    const [showMediaUploader, setShowMediaUploader] = useState(false);
    const [hasMoreMessages, setHasMoreMessages] = useState(false);
    const [messagesCursor, setMessagesCursor] = useState<string | null>(null);
    const [loadingMoreMsgs, setLoadingMoreMsgs] = useState(false);

    // AI Toggle state
    const [aiEnabled, setAiEnabled] = useState(true);
    const [togglingAi, setTogglingAi] = useState(false);

    // Content search state
    const [searchMode, setSearchMode] = useState<"name" | "content">("name");
    const [contentSearchResults, setContentSearchResults] = useState<Array<{
        conversationId: string;
        customerName: string | null;
        customerPhone: string;
        messages: Array<{ id: string; content: string; sender: string; createdAt: string }>;
    }>>([]);
    const [searchingContent, setSearchingContent] = useState(false);

    // Bulk selection state
    const [bulkMode, setBulkMode] = useState(false);

    // Session filter state
    const [sessions, setSessions] = useState<Array<{ id: string; sessionName: string; phoneNumber: string | null }>>([]);
    const [sessionFilter, setSessionFilter] = useState<string>("all");
    const [selectedConvIds, setSelectedConvIds] = useState<Set<string>>(new Set());
    const [bulkActionLoading, setBulkActionLoading] = useState(false);

    const messagesEndRef = useRef<HTMLDivElement>(null);
    const messagesContainerRef = useRef<HTMLDivElement>(null);
    const isAtBottomRef = useRef(true);
    const listConnectedRef = useRef(false);
    const chatConnectedRef = useRef(false);

    // Refs para evitar stale closures nos callbacks WebSocket
    const conversationsRef = useRef<Conversation[]>([]);
    const selectedConvRef = useRef<Conversation | null>(null);

    // Buscar companyId, aiEnabled e sessões
    useEffect(() => {
        fetch("/api/auth/me")
            .then(res => res.json())
            .then(data => {
                if (data.success && data.data.companyId) {
                    setCompanyId(data.data.companyId);
                    // Fetch AI toggle status
                    fetch("/api/company")
                        .then(res => res.json())
                        .then(companyData => {
                            if (companyData.success && companyData.data) {
                                setAiEnabled(companyData.data.aiEnabled ?? true);
                            }
                        })
                        .catch(err => logger.error("[Conversations] Failed to fetch company", { error: err }));
                    // Fetch WhatsApp sessions for filter
                    fetch("/api/whatsapp/sessions")
                        .then(res => res.json())
                        .then(sessionsData => {
                            if (sessionsData.success && sessionsData.data) {
                                setSessions(sessionsData.data);
                            }
                        })
                        .catch(err => logger.error("[Conversations] Failed to fetch sessions", { error: err }));
                }
            })
            .catch(err => logger.error("[Conversations] Failed to fetch user", { error: err }));

        // Initialize notifications on mount
        initNotifications().then(result => {
            logger.info("[Notifications] Initialized", { result });
        });
    }, []);

    // Toggle AI enabled/disabled
    const handleToggleAi = async () => {
        setTogglingAi(true);
        try {
            const res = await fetch("/api/company", {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ aiEnabled: !aiEnabled }),
            });
            const data = await res.json();
            if (data.success) {
                setAiEnabled(!aiEnabled);
            }
        } catch (err) {
            logger.error("[Conversations] Failed to toggle AI", { error: err });
        } finally {
            setTogglingAi(false);
        }
    };

    // Manter refs sincronizadas com estado para evitar stale closures
    useEffect(() => {
        conversationsRef.current = conversations;
    }, [conversations]);

    useEffect(() => {
        selectedConvRef.current = selectedConv;
    }, [selectedConv]);

    // Manter selectedConv sincronizado com conversations para evitar dados stale
    useEffect(() => {
        if (selectedConv) {
            const updated = conversations.find(c => c.id === selectedConv.id);
            if (updated && (
                updated.status !== selectedConv.status ||
                updated.unreadCount !== selectedConv.unreadCount ||
                updated.lastMessageAt !== selectedConv.lastMessageAt ||
                updated.assignedToId !== selectedConv.assignedToId
            )) {
                setSelectedConv(prev => prev ? { ...prev, ...updated } : null);
            }
        }
    }, [conversations, selectedConv]);

    // ========================================
    // WEBSOCKET - Lista de conversas
    // ========================================
    const { isConnected: listConnected } = useConversationsListSocket({
        companyId,
        onNewConversation: (conv) => {
            // Nova conversa chegou - adiciona no topo da lista
            setConversations(prev => {
                // Verificar se já existe
                if (prev.some(c => c.id === conv.id)) return prev;
                return [{
                    ...conv,
                    agent: null,
                    session: null,
                    messages: [],
                } as Conversation, ...prev];
            });
        },
        onConversationUpdate: (convId, updates) => {
            // Atualiza conversa existente (mantendo tipo de status)
            setConversations(prev => prev.map(c =>
                c.id === convId ? { ...c, ...updates, status: c.status } : c
            ));
        },
        onNewMessage: (convId, message) => {
            // Atualiza preview na lista
            setConversations(prev => prev.map(c => {
                if (c.id === convId) {
                    return {
                        ...c,
                        lastMessageAt: message.createdAt,
                        unreadCount: selectedConvRef.current?.id === convId ? c.unreadCount : c.unreadCount + 1,
                        messages: [...(c.messages || []), message as Message],
                    };
                }
                return c;
            }));

            // Se é a conversa selecionada, adiciona na lista de mensagens
            if (selectedConvRef.current?.id === convId) {
                setMessages(prev => {
                    // Evita duplicatas
                    if (prev.some(m => m.id === message.id)) return prev;
                    return [...prev, message as Message];
                });
            }

            // Desktop notification for ALL customer messages
            if (message.sender === "CUSTOMER") {
                const conv = conversationsRef.current.find(c => c.id === convId);
                logger.info("[Notifications] Customer message received", { convId });

                // Play notification sound
                playNotificationSound();

                // Show notification (even if same conversation is open)
                notifyNewMessage({
                    customerName: conv?.customerName || conv?.customerPhone || "Cliente",
                    messagePreview: message.content || "Nova mensagem",
                    conversationId: convId,
                });
            }
        },
    });

    // ========================================
    // WEBSOCKET - Conversa selecionada
    // ========================================
    const { isConnected: chatConnected, startTyping: _startTyping, stopTyping: _stopTyping } = useConversationSocket({
        conversationId: selectedConv?.id || "",
        companyId,
        onNewMessage: (message) => {
            setMessages(prev => {
                if (prev.some(m => m.id === message.id)) return prev;
                return [...prev, message as Message];
            });
            setIsTyping(false);
        },
        onTypingStart: () => setIsTyping(true),
        onTypingStop: () => setIsTyping(false),
    });

    const [hasMoreConvs, setHasMoreConvs] = useState(false);
    const [nextConvCursor, setNextConvCursor] = useState<string | undefined>();
    const [loadingMoreConvs, setLoadingMoreConvs] = useState(false);

    const fetchConversations = useCallback(async (cursor?: string, append = false) => {
        try {
            if (append) setLoadingMoreConvs(true);
            const url = cursor
                ? `/api/conversations?cursor=${cursor}&limit=20`
                : "/api/conversations?limit=20";
            const res = await fetch(url);
            const data = await res.json();
            if (data.success) {
                const { data: convData, pagination } = data.data;
                if (append) {
                    setConversations(prev => [...prev, ...convData]);
                } else {
                    setConversations(convData);
                }
                setHasMoreConvs(pagination?.hasMore || false);
                setNextConvCursor(pagination?.nextCursor);
            }
        } catch (e) { logger.error("[Conversations] Failed to fetch conversations", { error: e }); }
        finally {
            setLoading(false);
            setLoadingMoreConvs(false);
        }
    }, []);

    const fetchMessages = useCallback(async (id: string, cursor?: string | null, prepend = false) => {
        try {
            if (prepend) setLoadingMoreMsgs(true);
            const url = cursor
                ? `/api/conversations/${id}?cursor=${cursor}&limit=30`
                : `/api/conversations/${id}?limit=30`;
            const res = await fetch(url);
            const data = await res.json();
            if (data.success) {
                const { messages: newMsgs, pagination } = data.data;
                if (prepend) {
                    // Mensagens antigas vão no início (manter scroll position)
                    setMessages(prev => [...newMsgs, ...prev]);
                } else {
                    setMessages(newMsgs);
                }
                setHasMoreMessages(pagination?.hasMore || false);
                setMessagesCursor(pagination?.nextCursor || null);
            }
        } catch (e) { logger.error("[Conversations] Failed to fetch messages", { error: e }); }
        finally {
            setLoadingMsgs(false);
            setLoadingMoreMsgs(false);
        }
    }, []);

    // Sync refs para evitar recriação de intervalos
    useEffect(() => { listConnectedRef.current = listConnected; }, [listConnected]);
    useEffect(() => { chatConnectedRef.current = chatConnected; }, [chatConnected]);

    // Fetch inicial - polling otimizado (não recria intervalo quando conexão muda)
    useEffect(() => {
        fetchConversations();
        // Polling com intervalo fixo (5s) - checa conexão dinamicamente
        const interval = setInterval(() => {
            // Se WebSocket conectado, usa intervalo maior (pula algumas chamadas)
            if (listConnectedRef.current) return;
            fetchConversations();
        }, POLLING_INTERVAL_DISCONNECTED);
        return () => clearInterval(interval);
    }, [fetchConversations]);

    // Fetch mensagens ao selecionar conversa + polling
    useEffect(() => {
        if (selectedConv) {
            setLoadingMsgs(true);
            fetchMessages(selectedConv.id);

            // Polling de mensagens - checa conexão dinamicamente
            const interval = setInterval(() => {
                if (chatConnectedRef.current) return;
                fetchMessages(selectedConv.id);
            }, MESSAGES_POLLING_INTERVAL);
            return () => clearInterval(interval);
        }
    }, [selectedConv?.id, fetchMessages]);

    // Scroll inteligente - só rola se usuário estava no final
    useEffect(() => {
        if (isAtBottomRef.current) {
            messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
        }
    }, [messages]);

    // Detectar se usuário está no final do scroll
    const handleMessagesScroll = useCallback(() => {
        const container = messagesContainerRef.current;
        if (!container) return;
        isAtBottomRef.current = container.scrollHeight - container.scrollTop - container.clientHeight < SCROLL_BOTTOM_THRESHOLD;
    }, []);

    const handleSend = async () => {
        if (!selectedConv || !newMessage.trim() || sending) return;
        if (selectedConv.status === "AI_HANDLING") { setError(ERROR_MESSAGES.AI_HANDLING); return; }
        setSending(true); setError("");
        try {
            const res = await fetch(`/api/conversations/${selectedConv.id}`, {
                method: "POST", headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ content: newMessage }),
            });
            const data = await res.json();
            if (data.success) { setMessages(p => [...p, data.data]); setNewMessage(""); }
            else setError(getErrorMessage(data.error));
        } catch (e) { setError(getErrorMessage(e)); }
        finally { setSending(false); }
    };

    const handleAction = async (action: ConversationAction) => {
        if (!selectedConv) return;

        // Verificar se precisa confirmação
        const confirmMsg = ACTION_CONFIRMATIONS[action];
        if (confirmMsg && !window.confirm(confirmMsg)) return;

        const newStatus = ACTION_STATUS_MAP[action];
        await fetch(`/api/conversations/${selectedConv.id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: newStatus }) });
        setSelectedConv(p => p ? { ...p, status: newStatus } : null);
        fetchConversations();
    };



    const filtered = conversations.filter(c => {
        if (filter !== "all" && c.status !== filter) return false;
        if (sessionFilter !== "all" && c.session?.id !== sessionFilter) return false;
        if (search && searchMode === "name") {
            return c.customerName?.toLowerCase().includes(search.toLowerCase()) || c.customerPhone.includes(search);
        }
        return true;
    });

    // Content search effect
    useEffect(() => {
        if (searchMode === "content" && search.length >= 2) {
            const timer = setTimeout(async () => {
                setSearchingContent(true);
                try {
                    const res = await fetch(`/api/messages/search?q=${encodeURIComponent(search)}&limit=30`);
                    const data = await res.json();
                    if (data.success) {
                        setContentSearchResults(data.data.results || []);
                    }
                } catch (err) {
                    logger.error("[Conversations] Content search failed", { error: err });
                } finally {
                    setSearchingContent(false);
                }
            }, 300); // Debounce
            return () => clearTimeout(timer);
        } else {
            setContentSearchResults([]);
        }
    }, [search, searchMode]);

    const getStatus = (s: string) => {
        const config = STATUS_CONFIG[s] || STATUS_CONFIG.OPEN;
        return { l: config.label, c: config.color };
    };

    // Bulk actions
    const toggleSelectConv = (convId: string) => {
        setSelectedConvIds(prev => {
            const newSet = new Set(prev);
            if (newSet.has(convId)) {
                newSet.delete(convId);
            } else {
                newSet.add(convId);
            }
            return newSet;
        });
    };

    const selectAllFiltered = () => {
        const allIds = filtered.map(c => c.id);
        setSelectedConvIds(new Set(allIds));
    };

    const clearSelection = () => {
        setSelectedConvIds(new Set());
        setBulkMode(false);
    };

    const executeBulkAction = async (action: "close" | "archive" | "markRead" | "delete") => {
        if (selectedConvIds.size === 0) return;

        const actionLabel = action === "delete" ? "EXCLUIR" : "executar ação em";
        const confirm = window.confirm(`${actionLabel} ${selectedConvIds.size} conversa(s)? ${action === "delete" ? "Esta ação não pode ser desfeita!" : ""}`);
        if (!confirm) return;

        setBulkActionLoading(true);
        try {
            const promises = Array.from(selectedConvIds).map(async (convId) => {
                if (action === "close") {
                    await fetch(`/api/conversations/${convId}`, {
                        method: "PUT",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ status: "CLOSED" }),
                    });
                } else if (action === "archive") {
                    await fetch(`/api/conversations/${convId}`, {
                        method: "PUT",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ status: "ARCHIVED" }),
                    });
                } else if (action === "markRead") {
                    await fetch(`/api/conversations/${convId}/read`, {
                        method: "POST",
                    });
                } else if (action === "delete") {
                    await fetch(`/api/conversations/${convId}`, {
                        method: "DELETE",
                    });
                }
            });

            await Promise.all(promises);
            fetchConversations();
            clearSelection();
        } catch (err) {
            logger.error("[Conversations] Bulk action failed", { error: err });
            setError("Erro ao executar ação em lote");
        } finally {
            setBulkActionLoading(false);
        }
    };

    if (loading) return <div className="dash-loading"><div className="dash-spinner" /></div>;

    return (
        <>
            {/* Notification Permission Banner */}
            <NotificationPermissionBanner />

            <div className="wa-chat-container">
                <ErrorBoundary>
                    {/* Lista de Conversas - Sidebar */}
                    <div className={`wa-sidebar ${selectedConv ? "hidden" : ""}`}>
                        <div className="chat-sidebar-header">
                            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", flex: 1 }}>
                                <h2 className="chat-sidebar-title">Conversas</h2>
                                <span
                                    title={listConnected ? "Tempo real ativo" : "Modo polling (atualizações a cada 5s)"}
                                    style={{
                                        width: 8,
                                        height: 8,
                                        borderRadius: "50%",
                                        background: listConnected ? "#10b981" : "#f59e0b",
                                        boxShadow: listConnected ? "0 0 6px #10b981" : "0 0 6px #f59e0b",
                                    }}
                                />
                            </div>
                            {/* AI Global Toggle */}
                            <button
                                onClick={handleToggleAi}
                                disabled={togglingAi}
                                title={aiEnabled ? "IA Ativada - Clique para desativar" : "IA Desativada - Clique para ativar"}
                                style={{
                                    display: "flex",
                                    alignItems: "center",
                                    gap: "6px",
                                    padding: "6px 12px",
                                    borderRadius: "20px",
                                    border: "none",
                                    cursor: togglingAi ? "wait" : "pointer",
                                    fontSize: "12px",
                                    fontWeight: 500,
                                    transition: "all 0.2s ease",
                                    background: aiEnabled ? "rgba(16, 185, 129, 0.2)" : "rgba(239, 68, 68, 0.2)",
                                    color: aiEnabled ? "#10b981" : "#ef4444",
                                }}
                            >
                                {aiEnabled ? <Bot size={14} /> : <Power size={14} />}
                                <span>{aiEnabled ? "IA Ativa" : "IA Off"}</span>
                            </button>
                            <div className="chat-filters">
                                {FILTER_OPTIONS.map(f => {
                                    const count = f.value === "all"
                                        ? conversations.length
                                        : conversations.filter(c => c.status === f.value).length;
                                    return (
                                        <button
                                            key={f.value}
                                            onClick={() => setFilter(f.value)}
                                            className={`chat-filter-btn ${filter === f.value ? "active" : ""}`}
                                            title={`${f.label}: ${count} conversas`}
                                        >
                                            <span className="filter-icon">{f.icon}</span>
                                            <span className="filter-label">{f.label}</span>
                                            <span className="filter-count">{count}</span>
                                        </button>
                                    );
                                })}
                            </div>
                            <div className="chat-search">
                                <Search className="chat-search-icon" />
                                <input
                                    placeholder={searchMode === "name" ? "Buscar por nome ou telefone..." : "Buscar no conteúdo das mensagens..."}
                                    value={search}
                                    onChange={e => setSearch(e.target.value)}
                                />
                                {search && (
                                    <button
                                        onClick={() => setSearch("")}
                                        className="chat-search-clear"
                                        title="Limpar busca"
                                    >
                                        <X size={14} />
                                    </button>
                                )}
                            </div>
                            {/* Search mode toggle */}
                            <div style={{ display: "flex", gap: 4, marginTop: 8, marginBottom: 8 }}>
                                <button
                                    onClick={() => { setSearchMode("name"); setContentSearchResults([]); }}
                                    style={{
                                        flex: 1,
                                        padding: "6px 10px",
                                        fontSize: "11px",
                                        borderRadius: 6,
                                        border: "none",
                                        background: searchMode === "name" ? "rgba(167, 139, 250, 0.3)" : "rgba(255,255,255,0.05)",
                                        color: searchMode === "name" ? "#a78bfa" : "#64748b",
                                        cursor: "pointer",
                                        fontWeight: searchMode === "name" ? 600 : 400,
                                    }}
                                >
                                    Por Nome
                                </button>
                                <button
                                    onClick={() => setSearchMode("content")}
                                    style={{
                                        flex: 1,
                                        padding: "6px 10px",
                                        fontSize: "11px",
                                        borderRadius: 6,
                                        border: "none",
                                        background: searchMode === "content" ? "rgba(52, 211, 153, 0.3)" : "rgba(255,255,255,0.05)",
                                        color: searchMode === "content" ? "#34d399" : "#64748b",
                                        cursor: "pointer",
                                        fontWeight: searchMode === "content" ? 600 : 400,
                                    }}
                                >
                                    Por Conteúdo
                                </button>
                                <button
                                    onClick={() => setBulkMode(!bulkMode)}
                                    style={{
                                        padding: "6px 10px",
                                        fontSize: "11px",
                                        borderRadius: 6,
                                        border: "none",
                                        background: bulkMode ? "rgba(245, 158, 11, 0.3)" : "rgba(255,255,255,0.05)",
                                        color: bulkMode ? "#fbbf24" : "#64748b",
                                        cursor: "pointer",
                                        fontWeight: bulkMode ? 600 : 400,
                                    }}
                                    title="Modo seleção múltipla"
                                >
                                    ☑️
                                </button>
                            </div>

                            {/* Session filter dropdown - only show if multiple sessions */}
                            {sessions.length > 1 && (
                                <div style={{ marginBottom: 8 }}>
                                    <select
                                        value={sessionFilter}
                                        onChange={(e) => setSessionFilter(e.target.value)}
                                        style={{
                                            width: "100%",
                                            padding: "8px 12px",
                                            fontSize: "12px",
                                            borderRadius: 8,
                                            border: "1px solid rgba(255,255,255,0.1)",
                                            background: sessionFilter !== "all" ? "rgba(34, 211, 238, 0.15)" : "rgba(255,255,255,0.05)",
                                            color: sessionFilter !== "all" ? "#22d3ee" : "#94a3b8",
                                            cursor: "pointer",
                                            appearance: "none",
                                            backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%2394a3b8' stroke-width='2'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E")`,
                                            backgroundRepeat: "no-repeat",
                                            backgroundPosition: "right 12px center",
                                        }}
                                    >
                                        <option value="all">📱 Todos os WhatsApps ({conversations.length})</option>
                                        {sessions.map(s => {
                                            const count = conversations.filter(c => c.session?.id === s.id).length;
                                            return (
                                                <option key={s.id} value={s.id}>
                                                    📱 {s.sessionName || s.phoneNumber || "Sem nome"} ({count})
                                                </option>
                                            );
                                        })}
                                    </select>
                                </div>
                            )}
                            {/* Bulk actions bar */}
                            {bulkMode && (
                                <div style={{
                                    display: "flex",
                                    alignItems: "center",
                                    gap: 8,
                                    padding: "8px 12px",
                                    background: "rgba(245, 158, 11, 0.1)",
                                    borderRadius: 8,
                                    marginBottom: 8,
                                    flexWrap: "wrap",
                                }}>
                                    <span style={{ fontSize: 11, color: "#fbbf24", fontWeight: 600 }}>
                                        {selectedConvIds.size} selecionada(s)
                                    </span>
                                    <div style={{ display: "flex", gap: 4, marginLeft: "auto" }}>
                                        <button
                                            onClick={selectAllFiltered}
                                            disabled={bulkActionLoading}
                                            style={{
                                                padding: "4px 8px",
                                                fontSize: 10,
                                                borderRadius: 4,
                                                border: "none",
                                                background: "rgba(255,255,255,0.1)",
                                                color: "#94a3b8",
                                                cursor: "pointer",
                                            }}
                                        >
                                            Selecionar Todas
                                        </button>
                                        <button
                                            onClick={() => executeBulkAction("markRead")}
                                            disabled={bulkActionLoading || selectedConvIds.size === 0}
                                            style={{
                                                padding: "4px 8px",
                                                fontSize: 10,
                                                borderRadius: 4,
                                                border: "none",
                                                background: "rgba(52, 211, 153, 0.2)",
                                                color: "#34d399",
                                                cursor: selectedConvIds.size === 0 ? "not-allowed" : "pointer",
                                                opacity: selectedConvIds.size === 0 ? 0.5 : 1,
                                            }}
                                        >
                                            ✓ Lidas
                                        </button>
                                        <button
                                            onClick={() => executeBulkAction("close")}
                                            disabled={bulkActionLoading || selectedConvIds.size === 0}
                                            style={{
                                                padding: "4px 8px",
                                                fontSize: 10,
                                                borderRadius: 4,
                                                border: "none",
                                                background: "rgba(239, 68, 68, 0.2)",
                                                color: "#f87171",
                                                cursor: selectedConvIds.size === 0 ? "not-allowed" : "pointer",
                                                opacity: selectedConvIds.size === 0 ? 0.5 : 1,
                                            }}
                                        >
                                            ✕ Fechar
                                        </button>
                                        <button
                                            onClick={() => executeBulkAction("delete")}
                                            disabled={bulkActionLoading || selectedConvIds.size === 0}
                                            style={{
                                                padding: "4px 8px",
                                                fontSize: 10,
                                                borderRadius: 4,
                                                border: "none",
                                                background: "rgba(220, 38, 38, 0.3)",
                                                color: "#ef4444",
                                                cursor: selectedConvIds.size === 0 ? "not-allowed" : "pointer",
                                                opacity: selectedConvIds.size === 0 ? 0.5 : 1,
                                                fontWeight: 600,
                                            }}
                                        >
                                            🗑️ Excluir
                                        </button>
                                        <button
                                            onClick={clearSelection}
                                            disabled={bulkActionLoading}
                                            style={{
                                                padding: "4px 8px",
                                                fontSize: 10,
                                                borderRadius: 4,
                                                border: "none",
                                                background: "rgba(255,255,255,0.05)",
                                                color: "#64748b",
                                                cursor: "pointer",
                                            }}
                                        >
                                            Cancelar
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                        <div className="chat-list">
                            {/* Content search results */}
                            {searchMode === "content" && search.length >= 2 ? (
                                searchingContent ? (
                                    <div className="chat-empty-state">
                                        <RefreshCw size={24} className="chat-empty-state-icon" style={{ animation: "spin 1s linear infinite" }} />
                                        <p>Buscando...</p>
                                    </div>
                                ) : contentSearchResults.length === 0 ? (
                                    <div className="chat-empty-state">
                                        <Search size={48} className="chat-empty-state-icon" />
                                        <p>Nenhuma mensagem encontrada</p>
                                    </div>
                                ) : (
                                    contentSearchResults.map(result => (
                                        <div key={result.conversationId} style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
                                            <button
                                                onClick={() => {
                                                    const conv = conversations.find(c => c.id === result.conversationId);
                                                    if (conv) {
                                                        setSelectedConv(conv);
                                                        setLoadingMsgs(true);
                                                    }
                                                }}
                                                className="chat-item"
                                                style={{ width: "100%" }}
                                            >
                                                <div className="chat-item-avatar">
                                                    <div className="chat-avatar">{(result.customerName || result.customerPhone)[0].toUpperCase()}</div>
                                                </div>
                                                <div className="chat-item-content">
                                                    <div className="chat-item-header">
                                                        <h4 className="chat-item-name">{result.customerName || result.customerPhone}</h4>
                                                        <span style={{ fontSize: 10, color: "#64748b" }}>{result.messages.length} resultado(s)</span>
                                                    </div>
                                                    {result.messages.slice(0, 2).map((msg, i) => (
                                                        <p key={i} style={{
                                                            fontSize: 11,
                                                            color: "#94a3b8",
                                                            margin: "4px 0",
                                                            overflow: "hidden",
                                                            textOverflow: "ellipsis",
                                                            whiteSpace: "nowrap",
                                                        }}>
                                                            <span style={{ color: msg.sender === "CUSTOMER" ? "#60a5fa" : "#34d399" }}>
                                                                {msg.sender === "CUSTOMER" ? "←" : "→"}
                                                            </span>
                                                            {" "}
                                                            {msg.content.length > 60 ? msg.content.substring(0, 60) + "..." : msg.content}
                                                        </p>
                                                    ))}
                                                </div>
                                            </button>
                                        </div>
                                    ))
                                )
                            ) : filtered.length === 0 ? (
                                <div className="chat-empty-state">
                                    <MessageCircle size={48} className="chat-empty-state-icon" />
                                    <p>Nenhuma conversa</p>
                                </div>
                            ) : filtered.map(c => (
                                <button
                                    key={c.id}
                                    onClick={() => {
                                        if (bulkMode) {
                                            toggleSelectConv(c.id);
                                        } else {
                                            setSelectedConv(c);
                                            setLoadingMsgs(true);
                                        }
                                    }}
                                    className={`chat-item ${selectedConv?.id === c.id ? "active" : ""} ${selectedConvIds.has(c.id) ? "selected" : ""}`}
                                    style={{
                                        background: selectedConvIds.has(c.id) ? "rgba(245, 158, 11, 0.15)" : undefined,
                                        borderLeft: selectedConvIds.has(c.id) ? "3px solid #fbbf24" : undefined,
                                    }}
                                >
                                    {bulkMode && (
                                        <div style={{
                                            width: 20,
                                            height: 20,
                                            borderRadius: 4,
                                            border: selectedConvIds.has(c.id) ? "none" : "2px solid #64748b",
                                            background: selectedConvIds.has(c.id) ? "#fbbf24" : "transparent",
                                            display: "flex",
                                            alignItems: "center",
                                            justifyContent: "center",
                                            marginRight: 8,
                                            flexShrink: 0,
                                        }}>
                                            {selectedConvIds.has(c.id) && <span style={{ color: "#000", fontSize: 12 }}>✓</span>}
                                        </div>
                                    )}
                                    <div className="chat-item-avatar">
                                        <div className="chat-avatar">{(c.customerName || c.customerPhone)[0].toUpperCase()}</div>
                                        {c.unreadCount > 0 && <span className="chat-unread-badge">{c.unreadCount}</span>}
                                    </div>
                                    <div className="chat-item-content">
                                        <div className="chat-item-header">
                                            <h4 className="chat-item-name">{c.customerName || c.customerPhone}</h4>
                                            <span className="chat-item-time">{formatRelativeDate(c.lastMessageAt)}</span>
                                        </div>
                                        {c.agent && (
                                            <p className="chat-item-agent">
                                                <Bot size={10} /> {c.agent.name}
                                            </p>
                                        )}
                                        {/* Session badge - show which WhatsApp */}
                                        {sessions.length > 1 && c.session && (
                                            <p style={{
                                                display: "flex",
                                                alignItems: "center",
                                                gap: 4,
                                                fontSize: "10px",
                                                color: "#22d3ee",
                                                margin: "2px 0",
                                            }}>
                                                📱 {c.session.sessionName || c.session.phoneNumber || "WhatsApp"}
                                            </p>
                                        )}
                                        <p className="chat-item-preview">{c.messages?.[c.messages.length - 1]?.content?.substring(0, 30) || "..."}</p>
                                        <div className="chat-item-tags">
                                            <span className={`chat-tag ${c.status === "AI_HANDLING" ? "ai" : c.status === "HUMAN_HANDLING" ? "human" : "closed"}`}>
                                                {getStatus(c.status).l}
                                            </span>
                                        </div>
                                    </div>
                                </button>
                            ))}
                            {/* Botão Carregar Mais */}
                            {hasMoreConvs && (
                                <button
                                    onClick={() => fetchConversations(nextConvCursor, true)}
                                    disabled={loadingMoreConvs}
                                    style={{
                                        width: '100%',
                                        padding: '12px',
                                        margin: '8px 0',
                                        background: 'rgba(255,255,255,0.05)',
                                        border: '1px solid rgba(255,255,255,0.1)',
                                        borderRadius: '8px',
                                        color: '#94a3b8',
                                        cursor: 'pointer',
                                        fontSize: '13px',
                                    }}
                                >
                                    {loadingMoreConvs ? 'Carregando...' : 'Carregar mais'}
                                </button>
                            )}
                        </div>
                    </div>

                    {/* Chat Panel */}
                    <div className={`wa-chat-panel ${!selectedConv ? "hidden-mobile" : ""}`}>
                        {selectedConv ? (
                            <>
                                <div className="chat-header">
                                    <button onClick={() => { setSelectedConv(null); setMessages([]); }} className="chat-back-btn"><ArrowLeft /></button>
                                    <div className="chat-avatar" style={{ width: 40, height: 40 }}>{(selectedConv.customerName || "C")[0].toUpperCase()}</div>
                                    <div className="chat-header-info">
                                        <div className="chat-header-top">
                                            <h3 className="chat-header-name">{selectedConv.customerName || selectedConv.customerPhone}</h3>
                                            {selectedConv.agent && (
                                                <span className="chat-header-agent">
                                                    <Bot size={12} /> {selectedConv.agent.name}
                                                </span>
                                            )}
                                        </div>
                                        <div className="chat-header-meta">
                                            <span className="chat-status-badge" style={{
                                                background: `${getStatus(selectedConv.status).c}20`,
                                                color: getStatus(selectedConv.status).c,
                                                border: `1px solid ${getStatus(selectedConv.status).c}40`
                                            }}>
                                                {getStatus(selectedConv.status).l}
                                            </span>
                                            <ConversationTags
                                                conversationId={selectedConv.id}
                                                initialTags={selectedConv.tags || []}
                                                compact
                                            />
                                            <AssignConversation
                                                conversationId={selectedConv.id}
                                                currentAssignedId={selectedConv.assignedToId}
                                                currentAssignedName={selectedConv.assignedTo?.name}
                                                onAssign={(userId, name) => {
                                                    setSelectedConv(prev => prev ? {
                                                        ...prev,
                                                        assignedToId: userId,
                                                        assignedTo: userId && name ? { id: userId, name, email: "" } : null,
                                                    } : null);
                                                }}
                                            />
                                        </div>
                                    </div>
                                    <div className="chat-header-actions">
                                        {selectedConv.status === "AI_HANDLING" && <button onClick={() => handleAction("takeOver")} className="dash-btn primary sm">Assumir</button>}
                                        {selectedConv.status === "HUMAN_HANDLING" && (
                                            <>
                                                <button onClick={() => handleAction("returnAI")} className="dash-btn sm">Devolver</button>
                                                <button onClick={() => handleAction("close")} className="dash-btn danger sm"><X size={16} /></button>
                                            </>
                                        )}
                                        {selectedConv.status === "CLOSED" && <button onClick={() => handleAction("reopen")} className="dash-btn primary sm">Reabrir</button>}
                                    </div>
                                </div>

                                <div className="chat-messages" ref={messagesContainerRef} onScroll={handleMessagesScroll}>
                                    {loadingMsgs ? (
                                        <div className="chat-loading-center"><div className="dash-spinner" /></div>
                                    ) : messages.length === 0 ? (
                                        <div className="chat-empty-state">Nenhuma mensagem</div>
                                    ) : (
                                        <>
                                            {/* Load More Button */}
                                            {hasMoreMessages && (
                                                <div className="chat-loading-center">
                                                    <button
                                                        onClick={() => fetchMessages(selectedConv.id, messagesCursor, true)}
                                                        disabled={loadingMoreMsgs}
                                                        className="dash-btn sm"
                                                    >
                                                        {loadingMoreMsgs ? "Carregando..." : "Carregar mensagens anteriores"}
                                                    </button>
                                                </div>
                                            )}
                                            {messages.map(m => (
                                                <MessageBubble key={m.id} message={m} />
                                            ))}
                                            {/* Indicador de digitando */}
                                            {isTyping && (
                                                <div className="chat-message incoming">
                                                    <div className="chat-bubble" style={{ padding: '0.5rem 1rem' }}>
                                                        <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                                                            <span style={{
                                                                width: 6, height: 6, borderRadius: '50%',
                                                                background: '#64748b', animation: 'pulse 1s infinite'
                                                            }} />
                                                            <span style={{
                                                                width: 6, height: 6, borderRadius: '50%',
                                                                background: '#64748b', animation: 'pulse 1s infinite 0.2s'
                                                            }} />
                                                            <span style={{
                                                                width: 6, height: 6, borderRadius: '50%',
                                                                background: '#64748b', animation: 'pulse 1s infinite 0.4s'
                                                            }} />
                                                        </div>
                                                    </div>
                                                </div>
                                            )}
                                            <div ref={messagesEndRef} />
                                        </>
                                    )}
                                </div>

                                {selectedConv.status !== "CLOSED" ? (
                                    <div className="chat-input-area">
                                        {error && <div style={{ color: "#ef4444", fontSize: "0.85rem", marginBottom: "0.5rem" }}>{error}</div>}
                                        <div style={{ display: "flex", gap: "0.5rem", alignItems: "center", flex: 1 }}>
                                            <QuickReplies
                                                onSelect={(content) => setNewMessage(content)}
                                                customerName={selectedConv.customerName || undefined}
                                                disabled={selectedConv.status === "AI_HANDLING"}
                                            />
                                            <button
                                                className="chat-attach-btn"
                                                title="Enviar arquivo"
                                                disabled={selectedConv.status === "AI_HANDLING"}
                                                onClick={() => setShowMediaUploader(true)}
                                            >
                                                <Paperclip size={20} />
                                            </button>
                                            <input
                                                value={newMessage}
                                                onChange={e => setNewMessage(e.target.value)}
                                                onKeyDown={e => e.key === "Enter" && handleSend()}
                                                placeholder={selectedConv.status === "AI_HANDLING" ? "Clique em Assumir..." : "Escreva uma mensagem..."}
                                                disabled={selectedConv.status === "AI_HANDLING"}
                                                className="chat-input"
                                            />
                                            {newMessage.trim() ? (
                                                <button onClick={handleSend} disabled={sending} className="dash-btn primary">
                                                    {sending ? <RefreshCw size={18} className="dash-spin" /> : <Send size={18} />}
                                                </button>
                                            ) : (
                                                <AudioRecorder
                                                    disabled={selectedConv.status === "AI_HANDLING"}
                                                    onSend={async (audioBlob) => {
                                                        if (!selectedConv?.session?.id) {
                                                            setError("Sessão não encontrada");
                                                            return;
                                                        }
                                                        const formData = new FormData();
                                                        formData.append("file", audioBlob, "audio.webm");
                                                        formData.append("customerPhone", selectedConv.customerPhone);
                                                        formData.append("sessionId", selectedConv.session.id);
                                                        const res = await fetch(`/api/conversations/${selectedConv.id}/media`, {
                                                            method: "POST",
                                                            body: formData,
                                                        });
                                                        if (!res.ok) throw new Error("Falha ao enviar áudio");
                                                        fetchMessages(selectedConv.id);
                                                    }}
                                                />
                                            )}
                                        </div>
                                    </div>
                                ) : (
                                    <div style={{ padding: "1rem", textAlign: "center", color: "#64748b", borderTop: "1px solid var(--dash-border)" }}>Encerrada</div>
                                )}
                            </>
                        ) : (
                            <div className="wa-empty-state">
                                <MessageCircle size={90} style={{ color: "var(--wa-accent)", opacity: 0.3, marginBottom: "2rem" }} />
                                <h2 className="wa-empty-state-title">NozesIA</h2>
                                <p className="wa-empty-state-text">
                                    Selecione uma conversa para começar a atender.<br />
                                    Suas mensagens são sincronizadas em tempo real.
                                </p>
                            </div>
                        )}
                    </div>
                </ErrorBoundary >
            </div >

            {/* Media Uploader Modal */}
            {
                showMediaUploader && selectedConv && (
                    <MediaUploader
                        conversationId={selectedConv.id}
                        customerPhone={selectedConv.customerPhone}
                        sessionId={selectedConv.session?.id || null}
                        onClose={() => setShowMediaUploader(false)}
                        onSent={() => {
                            setShowMediaUploader(false);
                            fetchMessages(selectedConv.id);
                        }}
                        disabled={selectedConv.status === "AI_HANDLING"}
                    />
                )
            }
        </>
    );
}
