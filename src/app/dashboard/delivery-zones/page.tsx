"use client";

import { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
    MapPin, Plus, Trash2, Edit2, Save, X, Clock, DollarSign,
    ToggleRight, ToggleLeft, Loader2, TrendingUp, CheckCircle2
} from "lucide-react";
import { StatCard } from "@/components/stat-card";

interface DeliveryZone {
    id: string;
    name: string;
    fee: number;
    estimatedTime: string | null;
    isActive: boolean;
    order: number;
}

export default function DeliveryZonesPage() {
    const [zones, setZones] = useState<DeliveryZone[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState("");
    const [success, setSuccess] = useState("");

    // Modal state
    const [showModal, setShowModal] = useState(false);
    const [editingZone, setEditingZone] = useState<DeliveryZone | null>(null);
    const [form, setForm] = useState({ name: "", fee: "", estimatedTime: "" });

    useEffect(() => {
        fetchZones();
    }, []);

    const fetchZones = async () => {
        try {
            const response = await fetch("/api/delivery-zones");
            const data = await response.json();
            if (data.success) {
                setZones(data.data);
            }
        } catch (err) {
            console.error("Erro ao buscar bairros:", err);
            setError("Erro ao carregar bairros");
        } finally {
            setLoading(false);
        }
    };

    // Stats
    const stats = useMemo(() => {
        const activeZones = zones.filter(z => z.isActive);
        const fees = zones.map(z => z.fee);
        return {
            total: zones.length,
            active: activeZones.length,
            avgFee: zones.length > 0 ? fees.reduce((a, b) => a + b, 0) / zones.length : 0,
            maxFee: fees.length > 0 ? Math.max(...fees) : 0,
            freeDelivery: zones.filter(z => z.fee === 0).length,
        };
    }, [zones]);

    const formatCurrency = (value: number) => {
        return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
    };

    const openModal = (zone?: DeliveryZone) => {
        if (zone) {
            setEditingZone(zone);
            setForm({
                name: zone.name,
                fee: zone.fee.toString(),
                estimatedTime: zone.estimatedTime || "",
            });
        } else {
            setEditingZone(null);
            setForm({ name: "", fee: "", estimatedTime: "" });
        }
        setShowModal(true);
    };

    const closeModal = () => {
        setShowModal(false);
        setEditingZone(null);
        setForm({ name: "", fee: "", estimatedTime: "" });
    };

    const handleSaveZone = async () => {
        if (!form.name.trim() || !form.fee) return;

        setSaving(true);
        try {
            const url = editingZone
                ? `/api/delivery-zones/${editingZone.id}`
                : "/api/delivery-zones";
            const method = editingZone ? "PATCH" : "POST";

            const response = await fetch(url, {
                method,
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    name: form.name.trim(),
                    fee: parseFloat(form.fee),
                    estimatedTime: form.estimatedTime.trim() || null,
                }),
            });

            if (response.ok) {
                closeModal();
                fetchZones();
                setSuccess(editingZone ? "Bairro atualizado!" : "Bairro adicionado!");
                setTimeout(() => setSuccess(""), 2000);
            } else {
                setError("Erro ao salvar bairro");
            }
        } catch (err) {
            console.error("Erro ao salvar:", err);
            setError("Erro de conexão");
        } finally {
            setSaving(false);
        }
    };

    const handleToggleActive = async (zone: DeliveryZone) => {
        try {
            await fetch(`/api/delivery-zones/${zone.id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ isActive: !zone.isActive }),
            });
            fetchZones();
        } catch (err) {
            console.error("Erro ao alternar:", err);
        }
    };

    const handleDeleteZone = async (id: string) => {
        if (!confirm("Remover este bairro?")) return;

        try {
            await fetch(`/api/delivery-zones/${id}`, { method: "DELETE" });
            fetchZones();
            setSuccess("Bairro removido!");
            setTimeout(() => setSuccess(""), 2000);
        } catch (err) {
            console.error("Erro ao remover:", err);
        }
    };

    if (loading) {
        return (
            <div className="dash-loading">
                <div className="dash-spinner" />
            </div>
        );
    }

    return (
        <motion.div
            className="dash-fade-in"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.3 }}
        >
            {/* Header Premium */}
            <div className="dash-page-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "1rem" }}>
                <div>
                    <h1 className="dash-page-title" style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                        <span style={{
                            width: 42,
                            height: 42,
                            borderRadius: 12,
                            background: "linear-gradient(135deg, #a855f7 0%, #8b5cf6 100%)",
                            display: "inline-flex",
                            alignItems: "center",
                            justifyContent: "center",
                            boxShadow: "0 8px 24px rgba(168, 85, 247, 0.3)",
                        }}>
                            <MapPin style={{ width: 22, height: 22, color: "white" }} />
                        </span>
                        Zonas de Entrega
                        {stats.active > 0 && (
                            <span style={{
                                padding: "0.25rem 0.65rem",
                                borderRadius: 20,
                                background: "linear-gradient(135deg, rgba(52, 211, 153, 0.2), rgba(16, 185, 129, 0.1))",
                                border: "1px solid rgba(52, 211, 153, 0.3)",
                                color: "#34d399",
                                fontSize: "0.75rem",
                                fontWeight: 600,
                                display: "flex",
                                alignItems: "center",
                                gap: "0.35rem",
                            }}>
                                <CheckCircle2 style={{ width: 14, height: 14 }} />
                                {stats.active} bairros ativos
                            </span>
                        )}
                    </h1>
                    <p className="dash-page-subtitle">Configure as taxas de entrega para cada bairro da sua cidade</p>
                </div>
                <button className="dash-btn primary" onClick={() => openModal()}>
                    <Plus style={{ width: 18, height: 18 }} />
                    Adicionar Bairro
                </button>
            </div>

            {/* Alerts */}
            <AnimatePresence>
                {error && (
                    <motion.div
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        style={{
                            padding: "1rem",
                            background: "rgba(239, 68, 68, 0.1)",
                            border: "1px solid rgba(239, 68, 68, 0.2)",
                            borderRadius: "12px",
                            color: "#f87171",
                            marginBottom: "1.5rem",
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center",
                        }}
                    >
                        {error}
                        <button onClick={() => setError("")} style={{ background: "none", border: "none", color: "#f87171", cursor: "pointer" }}>
                            <X style={{ width: 16, height: 16 }} />
                        </button>
                    </motion.div>
                )}
                {success && (
                    <motion.div
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        style={{
                            padding: "1rem",
                            background: "rgba(34, 197, 94, 0.1)",
                            border: "1px solid rgba(34, 197, 94, 0.2)",
                            borderRadius: "12px",
                            color: "#22c55e",
                            marginBottom: "1.5rem",
                        }}
                    >
                        {success}
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Stats */}
            <div className="dash-stats-grid" style={{ marginBottom: "1.5rem" }}>
                <StatCard title="Total de Bairros" value={stats.total} icon={MapPin} color="purple" index={0} />
                <StatCard title="Bairros Ativos" value={stats.active} icon={ToggleRight} color="emerald" index={1} />
                <StatCard title="Taxa Média" value={formatCurrency(stats.avgFee)} icon={TrendingUp} color="cyan" index={2} />
                <StatCard title="Maior Taxa" value={formatCurrency(stats.maxFee)} icon={DollarSign} color="amber" index={3} />
            </div>

            {/* Zones Grid */}
            {zones.length === 0 ? (
                <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="dash-card"
                    style={{ textAlign: "center", padding: "3rem" }}
                >
                    <div style={{
                        width: 80,
                        height: 80,
                        borderRadius: 20,
                        background: "linear-gradient(135deg, rgba(168, 85, 247, 0.2), rgba(139, 92, 246, 0.1))",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        margin: "0 auto 1.5rem",
                    }}>
                        <MapPin style={{ width: 40, height: 40, color: "#a78bfa" }} />
                    </div>
                    <h3 style={{ color: "white", marginBottom: "0.5rem", fontSize: "1.25rem" }}>Nenhum bairro cadastrado</h3>
                    <p style={{ color: "#94a3b8", marginBottom: "1.5rem" }}>Adicione os bairros e suas taxas de entrega para começar</p>
                    <button className="dash-btn primary" onClick={() => openModal()}>
                        <Plus style={{ width: 18, height: 18 }} />
                        Adicionar Primeiro Bairro
                    </button>
                </motion.div>
            ) : (
                <div style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
                    gap: "1rem",
                    marginBottom: "1.5rem",
                }}>
                    <AnimatePresence>
                        {zones.map((zone, index) => (
                            <motion.div
                                key={zone.id}
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, scale: 0.95 }}
                                transition={{ delay: index * 0.05 }}
                                className="dash-card"
                                style={{
                                    padding: "1.25rem",
                                    borderLeft: `3px solid ${zone.isActive ? "#a855f7" : "#475569"}`,
                                    opacity: zone.isActive ? 1 : 0.6,
                                }}
                            >
                                {/* Header do Card */}
                                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "1rem" }}>
                                    <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                                        <div style={{
                                            width: 40,
                                            height: 40,
                                            borderRadius: 10,
                                            background: zone.isActive
                                                ? "linear-gradient(135deg, rgba(168, 85, 247, 0.2), rgba(139, 92, 246, 0.1))"
                                                : "rgba(71, 85, 105, 0.2)",
                                            display: "flex",
                                            alignItems: "center",
                                            justifyContent: "center",
                                        }}>
                                            <MapPin style={{ width: 20, height: 20, color: zone.isActive ? "#a78bfa" : "#64748b" }} />
                                        </div>
                                        <div>
                                            <h3 style={{ color: "white", fontWeight: 600, fontSize: "1rem", margin: 0 }}>{zone.name}</h3>
                                            {zone.estimatedTime && (
                                                <div style={{ display: "flex", alignItems: "center", gap: "0.25rem", color: "#64748b", fontSize: "0.8rem", marginTop: "0.25rem" }}>
                                                    <Clock style={{ width: 12, height: 12 }} />
                                                    {zone.estimatedTime}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                    <button
                                        onClick={() => handleToggleActive(zone)}
                                        style={{
                                            padding: "0.35rem 0.75rem",
                                            borderRadius: 20,
                                            background: zone.isActive ? "rgba(52, 211, 153, 0.15)" : "rgba(100, 116, 139, 0.15)",
                                            border: zone.isActive ? "1px solid rgba(52, 211, 153, 0.3)" : "1px solid rgba(100, 116, 139, 0.3)",
                                            color: zone.isActive ? "#34d399" : "#64748b",
                                            fontSize: "0.75rem",
                                            fontWeight: 500,
                                            cursor: "pointer",
                                            display: "flex",
                                            alignItems: "center",
                                            gap: "0.35rem",
                                        }}
                                    >
                                        {zone.isActive ? <ToggleRight style={{ width: 14, height: 14 }} /> : <ToggleLeft style={{ width: 14, height: 14 }} />}
                                        {zone.isActive ? "Ativo" : "Inativo"}
                                    </button>
                                </div>

                                {/* Taxa */}
                                <div style={{
                                    padding: "0.875rem",
                                    background: zone.fee > 0
                                        ? "linear-gradient(135deg, rgba(16, 185, 129, 0.08), rgba(52, 211, 153, 0.04))"
                                        : "linear-gradient(135deg, rgba(59, 130, 246, 0.08), rgba(96, 165, 250, 0.04))",
                                    borderRadius: 10,
                                    border: zone.fee > 0
                                        ? "1px solid rgba(16, 185, 129, 0.15)"
                                        : "1px solid rgba(59, 130, 246, 0.15)",
                                    marginBottom: "1rem",
                                }}>
                                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                                        <span style={{ color: "#94a3b8", fontSize: "0.85rem" }}>Taxa de Entrega</span>
                                        <span style={{
                                            color: zone.fee > 0 ? "#34d399" : "#60a5fa",
                                            fontWeight: 700,
                                            fontSize: "1.1rem",
                                        }}>
                                            {zone.fee > 0 ? formatCurrency(zone.fee) : "Grátis"}
                                        </span>
                                    </div>
                                </div>

                                {/* Actions */}
                                <div style={{ display: "flex", gap: "0.5rem" }}>
                                    <button
                                        onClick={() => openModal(zone)}
                                        className="dash-btn secondary"
                                        style={{ flex: 1, padding: "0.6rem", justifyContent: "center" }}
                                    >
                                        <Edit2 style={{ width: 16, height: 16 }} />
                                        Editar
                                    </button>
                                    <button
                                        onClick={() => handleDeleteZone(zone.id)}
                                        className="dash-btn secondary"
                                        style={{ padding: "0.6rem", color: "#f87171" }}
                                        title="Remover"
                                    >
                                        <Trash2 style={{ width: 16, height: 16 }} />
                                    </button>
                                </div>
                            </motion.div>
                        ))}
                    </AnimatePresence>
                </div>
            )}

            {/* Info Card */}
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                style={{
                    padding: "1.25rem",
                    background: "linear-gradient(135deg, rgba(167, 139, 250, 0.08), rgba(139, 92, 246, 0.04))",
                    border: "1px solid rgba(167, 139, 250, 0.2)",
                    borderRadius: "12px",
                }}
            >
                <div style={{ display: "flex", alignItems: "flex-start", gap: "1rem" }}>
                    <div style={{
                        width: 40,
                        height: 40,
                        borderRadius: 10,
                        background: "rgba(167, 139, 250, 0.15)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        flexShrink: 0,
                    }}>
                        <span style={{ fontSize: "1.25rem" }}>💡</span>
                    </div>
                    <div>
                        <h4 style={{ color: "#a78bfa", margin: "0 0 0.5rem", fontWeight: 600 }}>Como funciona?</h4>
                        <p style={{ color: "#94a3b8", margin: 0, fontSize: "0.875rem", lineHeight: 1.6 }}>
                            Quando um cliente solicitar entrega, a IA vai perguntar o bairro e calcular
                            automaticamente a taxa de entrega baseada na tabela acima.
                            Se o bairro não estiver cadastrado, a IA vai informar quais bairros são atendidos.
                        </p>
                    </div>
                </div>
            </motion.div>

            {/* Modal Premium */}
            <AnimatePresence>
                {showModal && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        style={{
                            position: "fixed",
                            top: 0,
                            left: 0,
                            right: 0,
                            bottom: 0,
                            background: "rgba(0, 0, 0, 0.85)",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            zIndex: 1000,
                            padding: "1rem",
                        }}
                        onClick={(e) => e.target === e.currentTarget && closeModal()}
                    >
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95, y: 20 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95, y: 20 }}
                            transition={{ type: "spring", damping: 25, stiffness: 300 }}
                            className="dash-card"
                            style={{ width: "100%", maxWidth: 450, overflow: "hidden" }}
                        >
                            {/* Header with Gradient */}
                            <div style={{
                                padding: "1.25rem",
                                background: "linear-gradient(135deg, rgba(168, 85, 247, 0.15), rgba(139, 92, 246, 0.08))",
                                borderBottom: "1px solid rgba(168, 85, 247, 0.2)",
                                display: "flex",
                                justifyContent: "space-between",
                                alignItems: "center",
                            }}>
                                <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                                    <span style={{
                                        width: 40,
                                        height: 40,
                                        borderRadius: 10,
                                        background: "linear-gradient(135deg, #a855f7, #8b5cf6)",
                                        display: "flex",
                                        alignItems: "center",
                                        justifyContent: "center",
                                        boxShadow: "0 4px 12px rgba(168, 85, 247, 0.3)",
                                    }}>
                                        {editingZone ? <Edit2 style={{ width: 20, height: 20, color: "white" }} /> : <Plus style={{ width: 20, height: 20, color: "white" }} />}
                                    </span>
                                    <div>
                                        <h3 style={{ color: "white", margin: 0, fontSize: "1.1rem", fontWeight: 600 }}>
                                            {editingZone ? "Editar Bairro" : "Novo Bairro"}
                                        </h3>
                                        <p style={{ color: "#94a3b8", margin: 0, fontSize: "0.8rem" }}>
                                            {editingZone ? "Atualize as informações" : "Adicione uma nova zona de entrega"}
                                        </p>
                                    </div>
                                </div>
                                <button
                                    onClick={closeModal}
                                    style={{
                                        width: 36,
                                        height: 36,
                                        borderRadius: 10,
                                        background: "rgba(255,255,255,0.05)",
                                        border: "1px solid rgba(255,255,255,0.1)",
                                        display: "flex",
                                        alignItems: "center",
                                        justifyContent: "center",
                                        cursor: "pointer",
                                        color: "#94a3b8",
                                    }}
                                >
                                    <X style={{ width: 18, height: 18 }} />
                                </button>
                            </div>

                            {/* Content */}
                            <div style={{ padding: "1.25rem" }}>
                                <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
                                    {/* Nome */}
                                    <div style={{
                                        padding: "1rem",
                                        background: "rgba(255,255,255,0.02)",
                                        borderRadius: 12,
                                        border: "1px solid rgba(255,255,255,0.06)",
                                    }}>
                                        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.75rem" }}>
                                            <MapPin style={{ width: 16, height: 16, color: "#a855f7" }} />
                                            <span style={{ color: "#e2e8f0", fontWeight: 600, fontSize: "0.9rem" }}>Nome do Bairro</span>
                                        </div>
                                        <input
                                            type="text"
                                            className="dash-input"
                                            placeholder="Ex: Centro, Jardim América..."
                                            value={form.name}
                                            onChange={(e) => setForm({ ...form, name: e.target.value })}
                                        />
                                    </div>

                                    {/* Taxa */}
                                    <div style={{
                                        padding: "1rem",
                                        background: "linear-gradient(135deg, rgba(16, 185, 129, 0.05), rgba(52, 211, 153, 0.02))",
                                        borderRadius: 12,
                                        border: "1px solid rgba(16, 185, 129, 0.15)",
                                    }}>
                                        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.75rem" }}>
                                            <DollarSign style={{ width: 16, height: 16, color: "#10b981" }} />
                                            <span style={{ color: "#e2e8f0", fontWeight: 600, fontSize: "0.9rem" }}>Taxa de Entrega</span>
                                            {form.fee && (
                                                <span style={{
                                                    marginLeft: "auto",
                                                    padding: "0.25rem 0.75rem",
                                                    borderRadius: 20,
                                                    background: "rgba(16, 185, 129, 0.15)",
                                                    color: "#34d399",
                                                    fontSize: "0.85rem",
                                                    fontWeight: 700,
                                                }}>
                                                    {formatCurrency(parseFloat(form.fee) || 0)}
                                                </span>
                                            )}
                                        </div>
                                        <input
                                            type="number"
                                            className="dash-input"
                                            placeholder="0.00"
                                            step="0.50"
                                            min="0"
                                            value={form.fee}
                                            onChange={(e) => setForm({ ...form, fee: e.target.value })}
                                        />
                                        <p style={{ color: "#64748b", fontSize: "0.75rem", margin: "0.5rem 0 0", fontStyle: "italic" }}>
                                            Use 0 para entrega grátis
                                        </p>
                                    </div>

                                    {/* Tempo */}
                                    <div style={{
                                        padding: "1rem",
                                        background: "rgba(255,255,255,0.02)",
                                        borderRadius: 12,
                                        border: "1px solid rgba(255,255,255,0.06)",
                                    }}>
                                        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.75rem" }}>
                                            <Clock style={{ width: 16, height: 16, color: "#60a5fa" }} />
                                            <span style={{ color: "#e2e8f0", fontWeight: 600, fontSize: "0.9rem" }}>Tempo Estimado</span>
                                            <span style={{ color: "#64748b", fontSize: "0.8rem" }}>(opcional)</span>
                                        </div>
                                        <input
                                            type="text"
                                            className="dash-input"
                                            placeholder="Ex: 20-30 min, 45 min..."
                                            value={form.estimatedTime}
                                            onChange={(e) => setForm({ ...form, estimatedTime: e.target.value })}
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* Footer */}
                            <div style={{
                                padding: "1rem 1.25rem",
                                borderTop: "1px solid rgba(255,255,255,0.08)",
                                display: "flex",
                                gap: "0.75rem",
                            }}>
                                <button
                                    className="dash-btn secondary"
                                    onClick={closeModal}
                                    style={{ flex: 1, padding: "0.75rem" }}
                                >
                                    Cancelar
                                </button>
                                <button
                                    className="dash-btn primary"
                                    onClick={handleSaveZone}
                                    disabled={saving || !form.name.trim() || !form.fee}
                                    style={{ flex: 2, padding: "0.75rem", display: "flex", alignItems: "center", justifyContent: "center", gap: "0.5rem" }}
                                >
                                    {saving ? (
                                        <Loader2 style={{ width: 18, height: 18, animation: "spin 1s linear infinite" }} />
                                    ) : (
                                        <Save style={{ width: 18, height: 18 }} />
                                    )}
                                    {saving ? "Salvando..." : (editingZone ? "Salvar Alterações" : "Criar Bairro")}
                                </button>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </motion.div>
    );
}
