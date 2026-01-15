"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import {
    Kanban, Plus, X, Phone, DollarSign, GripVertical,
    User, FileText, Trash2, CheckCircle, XCircle, MessageCircle, ShoppingBag, ExternalLink, ArrowLeft
} from "lucide-react";

interface Deal {
    id: string;
    customerPhone: string;
    customerName: string | null;
    title: string;
    value: number;
    stage: "LEAD" | "INTERESTED" | "NEGOTIATING" | "CLOSED_WON" | "CLOSED_LOST";
    notes: string | null;
    createdAt: string;
    // Customer stats (enriched)
    customerStats?: {
        totalMessages: number;
        totalOrders: number;
        totalSpent: number;
    };
}

interface DealSummary {
    count: number;
    total: number;
}

const STAGES = [
    { id: "LEAD", label: "Lead", color: "#3b82f6", icon: User },
    { id: "INTERESTED", label: "Interessado", color: "#f59e0b", icon: FileText },
    { id: "NEGOTIATING", label: "Negociando", color: "#a78bfa", icon: DollarSign },
    { id: "CLOSED_WON", label: "Fechado ✓", color: "#22c55e", icon: CheckCircle },
    { id: "CLOSED_LOST", label: "Perdido ✗", color: "#ef4444", icon: XCircle },
] as const;

export default function CRMPipelinePage() {
    const [deals, setDeals] = useState<Deal[]>([]);
    const [summary, setSummary] = useState<Record<string, DealSummary>>({});
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [draggedDeal, setDraggedDeal] = useState<Deal | null>(null);
    const [newDeal, setNewDeal] = useState({
        customerPhone: "",
        customerName: "",
        title: "",
        value: "",
    });

    const fetchDeals = useCallback(async () => {
        try {
            setLoading(true);
            const response = await fetch("/api/deals?enriched=true");
            const data = await response.json();
            if (data.success) {
                setDeals(data.data);
                setSummary(data.summary || {});
            }
        } catch (error) {
            console.error("Error:", error);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchDeals();
    }, [fetchDeals]);

    const createDeal = async () => {
        if (!newDeal.customerPhone || !newDeal.title) return;

        try {
            const response = await fetch("/api/deals", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    ...newDeal,
                    value: parseFloat(newDeal.value) || 0,
                }),
            });
            if (response.ok) {
                setNewDeal({ customerPhone: "", customerName: "", title: "", value: "" });
                setShowModal(false);
                fetchDeals();
            }
        } catch (error) {
            console.error("Error:", error);
        }
    };

    const updateDealStage = async (dealId: string, newStage: string) => {
        try {
            const response = await fetch(`/api/deals/${dealId}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ stage: newStage }),
            });
            if (response.ok) {
                fetchDeals();
            }
        } catch (error) {
            console.error("Error:", error);
        }
    };

    const deleteDeal = async (dealId: string) => {
        if (!confirm("Excluir este deal?")) return;
        try {
            await fetch(`/api/deals/${dealId}`, { method: "DELETE" });
            fetchDeals();
        } catch (error) {
            console.error("Error:", error);
        }
    };

    const handleDragStart = (e: React.DragEvent, deal: Deal) => {
        setDraggedDeal(deal);
        e.dataTransfer.effectAllowed = "move";
    };

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = "move";
    };

    const handleDrop = (e: React.DragEvent, targetStage: string) => {
        e.preventDefault();
        if (draggedDeal && draggedDeal.stage !== targetStage) {
            updateDealStage(draggedDeal.id, targetStage);
        }
        setDraggedDeal(null);
    };

    const formatCurrency = (value: number) => {
        return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
    };

    const formatDate = (dateStr: string) => {
        return new Date(dateStr).toLocaleDateString("pt-BR", {
            day: "2-digit",
            month: "short",
        });
    };

    if (loading && deals.length === 0) {
        return (
            <div className="dash-loading">
                <div className="dash-spinner" />
            </div>
        );
    }

    return (
        <div className="dash-fade-in">
            {/* Back to CRM */}
            <div style={{ marginBottom: "1rem" }}>
                <Link href="/dashboard/crm" className="dash-btn secondary" style={{ display: "inline-flex" }}>
                    <ArrowLeft style={{ width: 16, height: 16 }} />
                    Voltar ao CRM
                </Link>
            </div>

            {/* Header */}
            <div className="dash-page-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "1rem" }}>
                <div>
                    <h1 className="dash-page-title">
                        <Kanban style={{ width: 28, height: 28, marginRight: 8, color: "#a78bfa" }} />
                        Pipeline de Vendas
                    </h1>
                    <p className="dash-page-subtitle">
                        {deals.length} negociações | Total: {formatCurrency(Object.values(summary).reduce((sum, s) => sum + s.total, 0))}
                    </p>
                </div>
                <button onClick={() => setShowModal(true)} className="dash-btn primary">
                    <Plus style={{ width: 16, height: 16 }} />
                    Novo Deal
                </button>
            </div>

            {/* Kanban Board */}
            <div className="kanban-scroll">
                <div className="kanban-board">
                    {STAGES.map(stage => {
                        const stageDeals = deals.filter(d => d.stage === stage.id);
                        const stageSummary = summary[stage.id] || { count: 0, total: 0 };
                        const Icon = stage.icon;

                        return (
                            <div
                                key={stage.id}
                                className="kanban-column"
                                onDragOver={handleDragOver}
                                onDrop={(e) => handleDrop(e, stage.id)}
                                style={{
                                    border: `1px solid ${stage.color}30`,
                                }}
                            >
                                {/* Column Header */}
                                <div style={{
                                    padding: "0.75rem 1rem",
                                    borderBottom: `1px solid ${stage.color}30`,
                                    display: "flex",
                                    justifyContent: "space-between",
                                    alignItems: "center",
                                }}>
                                    <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                                        <Icon style={{ width: 16, height: 16, color: stage.color }} />
                                        <span style={{ color: "white", fontWeight: 500, fontSize: "0.9rem" }}>
                                            {stage.label}
                                        </span>
                                        <span style={{
                                            padding: "0.125rem 0.375rem",
                                            borderRadius: "999px",
                                            background: `${stage.color}20`,
                                            color: stage.color,
                                            fontSize: "0.7rem",
                                            fontWeight: 600,
                                        }}>
                                            {stageSummary.count}
                                        </span>
                                    </div>
                                    <span style={{ color: stage.color, fontSize: "0.75rem", fontWeight: 500 }}>
                                        {formatCurrency(stageSummary.total)}
                                    </span>
                                </div>

                                {/* Cards */}
                                <div style={{ padding: "0.5rem", display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                                    {stageDeals.map(deal => (
                                        <div
                                            key={deal.id}
                                            draggable
                                            onDragStart={(e) => handleDragStart(e, deal)}
                                            style={{
                                                padding: "0.75rem",
                                                background: "rgba(255,255,255,0.05)",
                                                borderRadius: "8px",
                                                cursor: "grab",
                                                border: "1px solid rgba(255,255,255,0.1)",
                                            }}
                                        >
                                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                                                <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                                                    <GripVertical style={{ width: 14, height: 14, color: "#475569" }} />
                                                    <div>
                                                        <div style={{ color: "white", fontSize: "0.85rem", fontWeight: 500 }}>
                                                            {deal.title}
                                                        </div>
                                                        <Link
                                                            href={`/dashboard/crm/${deal.customerPhone}`}
                                                            style={{ color: "#64748b", fontSize: "0.75rem", display: "flex", alignItems: "center", gap: "0.25rem", textDecoration: "none" }}
                                                        >
                                                            <Phone style={{ width: 10, height: 10 }} />
                                                            {deal.customerName || deal.customerPhone}
                                                            <ExternalLink style={{ width: 10, height: 10 }} />
                                                        </Link>
                                                    </div>
                                                </div>
                                                <button
                                                    onClick={() => deleteDeal(deal.id)}
                                                    style={{ background: "none", border: "none", cursor: "pointer", padding: "0.25rem" }}
                                                >
                                                    <Trash2 style={{ width: 14, height: 14, color: "#475569" }} />
                                                </button>
                                            </div>

                                            {/* Customer Stats */}
                                            {deal.customerStats && (
                                                <div style={{ display: "flex", gap: "0.75rem", marginTop: "0.5rem", paddingTop: "0.5rem", borderTop: "1px solid rgba(255,255,255,0.05)" }}>
                                                    <span style={{ display: "flex", alignItems: "center", gap: "0.25rem", color: "#64748b", fontSize: "0.7rem" }}>
                                                        <MessageCircle style={{ width: 10, height: 10 }} />
                                                        {deal.customerStats.totalMessages}
                                                    </span>
                                                    <span style={{ display: "flex", alignItems: "center", gap: "0.25rem", color: "#64748b", fontSize: "0.7rem" }}>
                                                        <ShoppingBag style={{ width: 10, height: 10 }} />
                                                        {deal.customerStats.totalOrders}
                                                    </span>
                                                    <span style={{ color: "#22c55e", fontSize: "0.7rem" }}>
                                                        {formatCurrency(deal.customerStats.totalSpent)}
                                                    </span>
                                                </div>
                                            )}

                                            <div style={{ display: "flex", justifyContent: "space-between", marginTop: "0.5rem" }}>
                                                <span style={{ color: "#22c55e", fontSize: "0.8rem", fontWeight: 500 }}>
                                                    {formatCurrency(deal.value)}
                                                </span>
                                                <span style={{ color: "#475569", fontSize: "0.7rem" }}>
                                                    {formatDate(deal.createdAt)}
                                                </span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* New Deal Modal */}
            {showModal && (
                <div style={{
                    position: "fixed",
                    inset: 0,
                    background: "rgba(0,0,0,0.7)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    zIndex: 1000,
                }}>
                    <div className="dash-card" style={{ width: "100%", maxWidth: 400, padding: "1.5rem" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
                            <h3 style={{ color: "white", fontSize: "1.1rem", fontWeight: 600 }}>Novo Deal</h3>
                            <button onClick={() => setShowModal(false)} style={{ background: "none", border: "none", cursor: "pointer" }}>
                                <X style={{ width: 20, height: 20, color: "#64748b" }} />
                            </button>
                        </div>

                        <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
                            <div>
                                <label style={{ color: "#94a3b8", fontSize: "0.8rem", display: "block", marginBottom: "0.25rem" }}>
                                    Telefone *
                                </label>
                                <input
                                    type="text"
                                    placeholder="5511999999999"
                                    value={newDeal.customerPhone}
                                    onChange={(e) => setNewDeal({ ...newDeal, customerPhone: e.target.value })}
                                    style={{
                                        width: "100%",
                                        padding: "0.625rem",
                                        background: "rgba(255,255,255,0.05)",
                                        border: "1px solid rgba(255,255,255,0.1)",
                                        borderRadius: "8px",
                                        color: "white",
                                        fontSize: "0.9rem",
                                    }}
                                />
                            </div>

                            <div>
                                <label style={{ color: "#94a3b8", fontSize: "0.8rem", display: "block", marginBottom: "0.25rem" }}>
                                    Nome do Cliente
                                </label>
                                <input
                                    type="text"
                                    placeholder="João Silva"
                                    value={newDeal.customerName}
                                    onChange={(e) => setNewDeal({ ...newDeal, customerName: e.target.value })}
                                    style={{
                                        width: "100%",
                                        padding: "0.625rem",
                                        background: "rgba(255,255,255,0.05)",
                                        border: "1px solid rgba(255,255,255,0.1)",
                                        borderRadius: "8px",
                                        color: "white",
                                        fontSize: "0.9rem",
                                    }}
                                />
                            </div>

                            <div>
                                <label style={{ color: "#94a3b8", fontSize: "0.8rem", display: "block", marginBottom: "0.25rem" }}>
                                    Descrição do Negócio *
                                </label>
                                <input
                                    type="text"
                                    placeholder="Pedido de 10 pizzas"
                                    value={newDeal.title}
                                    onChange={(e) => setNewDeal({ ...newDeal, title: e.target.value })}
                                    style={{
                                        width: "100%",
                                        padding: "0.625rem",
                                        background: "rgba(255,255,255,0.05)",
                                        border: "1px solid rgba(255,255,255,0.1)",
                                        borderRadius: "8px",
                                        color: "white",
                                        fontSize: "0.9rem",
                                    }}
                                />
                            </div>

                            <div>
                                <label style={{ color: "#94a3b8", fontSize: "0.8rem", display: "block", marginBottom: "0.25rem" }}>
                                    Valor Potencial (R$)
                                </label>
                                <input
                                    type="number"
                                    placeholder="500"
                                    value={newDeal.value}
                                    onChange={(e) => setNewDeal({ ...newDeal, value: e.target.value })}
                                    style={{
                                        width: "100%",
                                        padding: "0.625rem",
                                        background: "rgba(255,255,255,0.05)",
                                        border: "1px solid rgba(255,255,255,0.1)",
                                        borderRadius: "8px",
                                        color: "white",
                                        fontSize: "0.9rem",
                                    }}
                                />
                            </div>

                            <button onClick={createDeal} className="dash-btn primary" style={{ marginTop: "0.5rem" }}>
                                <Plus style={{ width: 16, height: 16 }} />
                                Criar Deal
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
