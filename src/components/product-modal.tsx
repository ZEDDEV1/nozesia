"use client";

import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
    Package, X, Upload, Loader2, FolderPlus, Plus, Save,
    Tag, DollarSign, Palette, Ruler, Check, Box, Star,
    Percent, ToggleLeft, ToggleRight, Sparkles, Trash2
} from "lucide-react";

interface Category {
    id: string;
    name: string;
    color: string | null;
}

interface ProductFormData {
    name: string;
    description: string;
    price: string;
    imageUrl: string;
    imagePublicId: string;
    categoryId: string;
    stockEnabled: boolean;
    stockQuantity: string;
    isActive: boolean;
    isFeatured: boolean;
    isPromo: boolean;
    promoPrice: string;
    sizes: string[];
    colors: string[];
    material: string;
    sku: string;
    gender: string;
}

interface ProductModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (data: ProductFormData) => Promise<void>;
    onImageUpload: (e: React.ChangeEvent<HTMLInputElement>) => Promise<void>;
    categories: Category[];
    onCreateCategory: () => void;
    initialData?: ProductFormData;
    isEditing?: boolean;
    saving?: boolean;
    uploading?: boolean;
}

const DEFAULT_SIZES = ["PP", "P", "M", "G", "GG", "XG"];
const DEFAULT_COLORS = [
    { name: "Preto", hex: "#1a1a1a" },
    { name: "Branco", hex: "#ffffff" },
    { name: "Azul", hex: "#3b82f6" },
    { name: "Vermelho", hex: "#ef4444" },
    { name: "Verde", hex: "#22c55e" },
    { name: "Rosa", hex: "#ec4899" },
    { name: "Cinza", hex: "#6b7280" },
    { name: "Bege", hex: "#d4b896" },
];

const initialForm: ProductFormData = {
    name: "", description: "", price: "", imageUrl: "", imagePublicId: "",
    categoryId: "", stockEnabled: false, stockQuantity: "0", isActive: true,
    isFeatured: false, isPromo: false, promoPrice: "",
    sizes: [], colors: [], material: "", sku: "", gender: "",
};

// Reusable Toggle Component
const Toggle = ({ enabled, onToggle, label, icon: Icon, color = "#ec4899" }: {
    enabled: boolean;
    onToggle: () => void;
    label: string;
    icon: React.ElementType;
    color?: string;
}) => (
    <button
        type="button"
        onClick={onToggle}
        style={{
            display: "flex",
            alignItems: "center",
            gap: "0.75rem",
            padding: "0.875rem 1rem",
            borderRadius: 12,
            background: enabled ? `linear-gradient(135deg, ${color}15, ${color}08)` : "rgba(255,255,255,0.02)",
            border: `1px solid ${enabled ? color + "40" : "rgba(255,255,255,0.08)"}`,
            cursor: "pointer",
            transition: "all 0.2s",
            flex: 1,
        }}
    >
        <Icon style={{ width: 18, height: 18, color: enabled ? color : "#64748b" }} />
        <span style={{ flex: 1, textAlign: "left", color: enabled ? "#e2e8f0" : "#94a3b8", fontWeight: 500, fontSize: "0.9rem" }}>
            {label}
        </span>
        {enabled ? (
            <ToggleRight style={{ width: 24, height: 24, color }} />
        ) : (
            <ToggleLeft style={{ width: 24, height: 24, color: "#64748b" }} />
        )}
    </button>
);

// Section Header Component
const SectionHeader = ({ icon: Icon, title, color = "#ec4899", badge }: {
    icon: React.ElementType;
    title: string;
    color?: string;
    badge?: React.ReactNode;
}) => (
    <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "1rem" }}>
        <Icon style={{ width: 16, height: 16, color }} />
        <span style={{ color: "#e2e8f0", fontWeight: 600, fontSize: "0.9rem" }}>{title}</span>
        {badge}
    </div>
);

export default function ProductModal({
    isOpen, onClose, onSave, onImageUpload, categories,
    onCreateCategory, initialData, isEditing = false, saving = false, uploading = false,
}: ProductModalProps) {
    const [form, setForm] = useState<ProductFormData>(() => initialData || initialForm);
    const [customSize, setCustomSize] = useState("");
    const [customColor, setCustomColor] = useState("");
    const [showSizeInput, setShowSizeInput] = useState(false);
    const [showColorInput, setShowColorInput] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Reset form when modal opens with initial data
    // eslint-disable-next-line react-hooks/exhaustive-deps, react-hooks/set-state-in-effect
    useEffect(() => {
        if (isOpen) {
            setForm(initialData || initialForm);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isOpen, JSON.stringify(initialData)]);

    const toggleSize = (size: string) => {
        setForm(f => ({
            ...f,
            sizes: f.sizes.includes(size) ? f.sizes.filter(s => s !== size) : [...f.sizes, size]
        }));
    };

    const addCustomSize = () => {
        if (customSize.trim() && !form.sizes.includes(customSize.trim())) {
            setForm(f => ({ ...f, sizes: [...f.sizes, customSize.trim()] }));
            setCustomSize("");
            setShowSizeInput(false);
        }
    };

    const toggleColor = (color: string) => {
        setForm(f => ({
            ...f,
            colors: f.colors.includes(color) ? f.colors.filter(c => c !== color) : [...f.colors, color]
        }));
    };

    const addCustomColor = () => {
        if (customColor.trim() && !form.colors.includes(customColor.trim())) {
            setForm(f => ({ ...f, colors: [...f.colors, customColor.trim()] }));
            setCustomColor("");
            setShowColorInput(false);
        }
    };

    const clearImage = () => {
        setForm(f => ({ ...f, imageUrl: "", imagePublicId: "" }));
    };

    const handleSubmit = () => onSave(form);

    // Calculate discount percentage
    const discountPercent = form.price && form.promoPrice
        ? Math.round((1 - parseFloat(form.promoPrice) / parseFloat(form.price)) * 100)
        : 0;

    if (!isOpen) return null;

    return (
        <AnimatePresence>
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={(e) => e.target === e.currentTarget && onClose()}
                style={{
                    position: "fixed", inset: 0, zIndex: 1000,
                    background: "linear-gradient(135deg, rgba(0,0,0,0.92), rgba(15,10,25,0.95))",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    padding: "1rem", backdropFilter: "blur(8px)",
                }}
            >
                <motion.div
                    initial={{ opacity: 0, scale: 0.95, y: 30 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    transition={{ type: "spring", damping: 28, stiffness: 350 }}
                    style={{
                        width: "100%", maxWidth: 720, maxHeight: "94vh",
                        background: "linear-gradient(145deg, rgba(20,15,35,0.98), rgba(12,10,20,0.99))",
                        borderRadius: 20, border: "1px solid rgba(236,72,153,0.15)",
                        boxShadow: "0 25px 80px rgba(0,0,0,0.6), 0 0 60px rgba(236,72,153,0.08)",
                        display: "flex", flexDirection: "column", overflow: "hidden",
                    }}
                >
                    {/* HEADER */}
                    <div style={{
                        padding: "1.5rem",
                        background: "linear-gradient(135deg, rgba(236,72,153,0.08), rgba(168,85,247,0.05))",
                        borderBottom: "1px solid rgba(236,72,153,0.12)",
                        display: "flex", justifyContent: "space-between", alignItems: "center",
                    }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
                            <div style={{
                                width: 48, height: 48, borderRadius: 14,
                                background: "linear-gradient(135deg, #ec4899, #a855f7)",
                                display: "flex", alignItems: "center", justifyContent: "center",
                                boxShadow: "0 8px 25px rgba(236,72,153,0.35)",
                            }}>
                                <Package style={{ width: 24, height: 24, color: "white" }} />
                            </div>
                            <div>
                                <h2 style={{ margin: 0, fontSize: "1.25rem", fontWeight: 700, color: "white", letterSpacing: "-0.02em" }}>
                                    {isEditing ? "Editar Produto" : "Novo Produto"}
                                </h2>
                                <p style={{ margin: "4px 0 0", fontSize: "0.85rem", color: "#94a3b8" }}>
                                    {isEditing ? "Atualize os detalhes do produto" : "Cadastre um novo produto no catálogo"}
                                </p>
                            </div>
                        </div>
                        <button onClick={onClose} style={{
                            width: 40, height: 40, borderRadius: 10,
                            background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)",
                            display: "flex", alignItems: "center", justifyContent: "center",
                            cursor: "pointer", color: "#64748b", transition: "all 0.2s",
                        }}>
                            <X style={{ width: 20, height: 20 }} />
                        </button>
                    </div>

                    {/* CONTENT */}
                    <div style={{ flex: 1, overflow: "auto", padding: "1.25rem" }}>
                        <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>

                            {/* IMAGE UPLOAD */}
                            <div style={{ padding: "1rem", background: "rgba(255,255,255,0.02)", borderRadius: 16, border: "1px solid rgba(255,255,255,0.06)" }}>
                                <SectionHeader icon={Upload} title="Foto do Produto" />
                                <input type="file" ref={fileInputRef} onChange={onImageUpload} accept="image/*" style={{ display: "none" }} />
                                <div
                                    onClick={() => !uploading && fileInputRef.current?.click()}
                                    style={{
                                        height: 180, borderRadius: 14,
                                        border: form.imageUrl ? "2px solid rgba(236,72,153,0.3)" : "2px dashed rgba(236,72,153,0.25)",
                                        background: form.imageUrl ? `url(${form.imageUrl}) center/cover` : "linear-gradient(135deg, rgba(236,72,153,0.03), rgba(168,85,247,0.02))",
                                        display: "flex", alignItems: "center", justifyContent: "center",
                                        cursor: "pointer", transition: "all 0.2s", position: "relative",
                                    }}
                                >
                                    {uploading ? (
                                        <Loader2 style={{ width: 36, height: 36, color: "#ec4899", animation: "spin 1s linear infinite" }} />
                                    ) : !form.imageUrl ? (
                                        <div style={{ textAlign: "center", color: "#64748b" }}>
                                            <Upload style={{ width: 32, height: 32, color: "#ec4899", marginBottom: "0.5rem" }} />
                                            <p style={{ margin: 0, fontSize: "0.9rem", color: "#94a3b8" }}>Clique para enviar</p>
                                            <p style={{ margin: "0.25rem 0 0", fontSize: "0.75rem", opacity: 0.6 }}>PNG, JPG ou WebP até 5MB</p>
                                        </div>
                                    ) : (
                                        <button
                                            onClick={(e) => { e.stopPropagation(); clearImage(); }}
                                            style={{
                                                position: "absolute", top: 8, right: 8,
                                                width: 32, height: 32, borderRadius: 8,
                                                background: "rgba(239,68,68,0.9)", border: "none",
                                                display: "flex", alignItems: "center", justifyContent: "center",
                                                cursor: "pointer", color: "white",
                                            }}
                                        >
                                            <Trash2 style={{ width: 16, height: 16 }} />
                                        </button>
                                    )}
                                </div>
                            </div>

                            {/* IDENTIFICATION */}
                            <div style={{ padding: "1rem", background: "rgba(255,255,255,0.02)", borderRadius: 16, border: "1px solid rgba(255,255,255,0.06)" }}>
                                <SectionHeader icon={Tag} title="Identificação" />
                                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.875rem" }}>
                                    <div style={{ gridColumn: "span 2" }}>
                                        <label className="dash-label">Nome do Produto *</label>
                                        <input className="dash-input" placeholder="Ex: Camiseta Básica, Calça Jeans..." value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
                                    </div>
                                    <div>
                                        <label className="dash-label">Categoria</label>
                                        <div style={{ display: "flex", gap: "0.5rem" }}>
                                            <select className="dash-select" value={form.categoryId} onChange={(e) => setForm({ ...form, categoryId: e.target.value })} style={{ flex: 1 }}>
                                                <option value="">Selecione...</option>
                                                {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                                            </select>
                                            <button onClick={onCreateCategory} className="dash-btn secondary" style={{ padding: "0.5rem" }}>
                                                <FolderPlus style={{ width: 16, height: 16 }} />
                                            </button>
                                        </div>
                                    </div>
                                    <div>
                                        <label className="dash-label">Gênero</label>
                                        <select className="dash-select" value={form.gender} onChange={(e) => setForm({ ...form, gender: e.target.value })}>
                                            <option value="">Selecione...</option>
                                            <option value="Masculino">Masculino</option>
                                            <option value="Feminino">Feminino</option>
                                            <option value="Unissex">Unissex</option>
                                            <option value="Infantil">Infantil</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label className="dash-label">SKU / Código</label>
                                        <input className="dash-input" placeholder="CAM-001" value={form.sku} onChange={(e) => setForm({ ...form, sku: e.target.value })} />
                                    </div>
                                    <div>
                                        <label className="dash-label">Material</label>
                                        <input className="dash-input" placeholder="100% Algodão" value={form.material} onChange={(e) => setForm({ ...form, material: e.target.value })} />
                                    </div>
                                    <div style={{ gridColumn: "span 2" }}>
                                        <label className="dash-label">Descrição</label>
                                        <textarea className="dash-input" rows={2} placeholder="Tecido, caimento, estilo..." value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} style={{ resize: "none", minHeight: 70 }} />
                                    </div>
                                </div>
                            </div>

                            {/* PRODUCT SETTINGS */}
                            <div style={{ padding: "1rem", background: "linear-gradient(135deg, rgba(139,92,246,0.04), rgba(168,85,247,0.02))", borderRadius: 16, border: "1px solid rgba(139,92,246,0.12)" }}>
                                <SectionHeader icon={Sparkles} title="Configurações do Produto" color="#8b5cf6" />
                                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
                                    <Toggle
                                        enabled={form.isActive}
                                        onToggle={() => setForm({ ...form, isActive: !form.isActive })}
                                        label="Produto Ativo"
                                        icon={ToggleRight}
                                        color="#22c55e"
                                    />
                                    <Toggle
                                        enabled={form.isFeatured}
                                        onToggle={() => setForm({ ...form, isFeatured: !form.isFeatured })}
                                        label="Em Destaque"
                                        icon={Star}
                                        color="#f59e0b"
                                    />
                                    <Toggle
                                        enabled={form.stockEnabled}
                                        onToggle={() => setForm({ ...form, stockEnabled: !form.stockEnabled })}
                                        label="Controle de Estoque"
                                        icon={Box}
                                        color="#3b82f6"
                                    />
                                    <Toggle
                                        enabled={form.isPromo}
                                        onToggle={() => setForm({ ...form, isPromo: !form.isPromo })}
                                        label="Em Promoção"
                                        icon={Percent}
                                        color="#ec4899"
                                    />
                                </div>

                                {/* Stock Quantity (when enabled) */}
                                {form.stockEnabled && (
                                    <div style={{ marginTop: "1rem", padding: "0.875rem", background: "rgba(59,130,246,0.08)", borderRadius: 12, border: "1px solid rgba(59,130,246,0.2)" }}>
                                        <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
                                            <Box style={{ width: 20, height: 20, color: "#3b82f6" }} />
                                            <div style={{ flex: 1 }}>
                                                <label style={{ color: "#e2e8f0", fontSize: "0.85rem", fontWeight: 500 }}>Quantidade em Estoque</label>
                                            </div>
                                            <input
                                                type="number"
                                                min="0"
                                                value={form.stockQuantity}
                                                onChange={(e) => setForm({ ...form, stockQuantity: e.target.value })}
                                                style={{
                                                    width: 100, padding: "0.5rem 0.75rem", borderRadius: 8,
                                                    background: "rgba(255,255,255,0.05)", border: "1px solid rgba(59,130,246,0.3)",
                                                    color: "white", fontSize: "0.95rem", textAlign: "center",
                                                }}
                                            />
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* PRICING */}
                            <div style={{ padding: "1rem", background: "linear-gradient(135deg, rgba(16,185,129,0.04), rgba(52,211,153,0.02))", borderRadius: 16, border: "1px solid rgba(16,185,129,0.12)" }}>
                                <SectionHeader
                                    icon={DollarSign}
                                    title="Preço"
                                    color="#10b981"
                                    badge={form.price && (
                                        <span style={{ marginLeft: "auto", padding: "0.2rem 0.6rem", borderRadius: 20, background: "rgba(16,185,129,0.15)", color: "#34d399", fontSize: "0.85rem", fontWeight: 700 }}>
                                            R$ {parseFloat(form.price || "0").toFixed(2)}
                                        </span>
                                    )}
                                />
                                <div style={{ display: "grid", gridTemplateColumns: form.isPromo ? "1fr 1fr" : "1fr", gap: "0.875rem" }}>
                                    <div>
                                        <label className="dash-label">Preço (R$) *</label>
                                        <input type="number" className="dash-input" placeholder="0.00" step="0.01" min="0" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} />
                                    </div>
                                    {form.isPromo && (
                                        <div>
                                            <label className="dash-label" style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                                                Preço Promocional
                                                {discountPercent > 0 && (
                                                    <span style={{ padding: "0.15rem 0.5rem", borderRadius: 12, background: "rgba(236,72,153,0.2)", color: "#f472b6", fontSize: "0.7rem", fontWeight: 600 }}>
                                                        -{discountPercent}%
                                                    </span>
                                                )}
                                            </label>
                                            <input type="number" className="dash-input" placeholder="0.00" step="0.01" min="0" value={form.promoPrice} onChange={(e) => setForm({ ...form, promoPrice: e.target.value })} />
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* SIZES */}
                            <div style={{ padding: "1rem", background: "linear-gradient(135deg, rgba(236,72,153,0.04), rgba(168,85,247,0.02))", borderRadius: 16, border: "1px solid rgba(236,72,153,0.1)" }}>
                                <SectionHeader icon={Ruler} title="Tamanhos Disponíveis" />
                                <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
                                    {DEFAULT_SIZES.map((size) => (
                                        <button key={size} type="button" onClick={() => toggleSize(size)} style={{
                                            padding: "0.5rem 1rem", borderRadius: 8, cursor: "pointer", fontWeight: 600, fontSize: "0.85rem",
                                            background: form.sizes.includes(size) ? "linear-gradient(135deg, #ec4899, #a855f7)" : "rgba(255,255,255,0.03)",
                                            border: form.sizes.includes(size) ? "none" : "1px solid rgba(255,255,255,0.1)",
                                            color: form.sizes.includes(size) ? "white" : "#94a3b8",
                                            transition: "all 0.2s",
                                        }}>{size}</button>
                                    ))}
                                    {form.sizes.filter(s => !DEFAULT_SIZES.includes(s)).map((size) => (
                                        <button key={size} type="button" onClick={() => toggleSize(size)} style={{
                                            padding: "0.5rem 1rem", borderRadius: 8, cursor: "pointer", fontWeight: 600, fontSize: "0.85rem",
                                            background: "linear-gradient(135deg, #ec4899, #a855f7)", border: "none", color: "white",
                                            display: "flex", alignItems: "center", gap: "0.4rem",
                                        }}>
                                            {size} <X style={{ width: 12, height: 12 }} />
                                        </button>
                                    ))}
                                    {showSizeInput ? (
                                        <div style={{ display: "flex", gap: "0.4rem" }}>
                                            <input type="text" value={customSize} onChange={(e) => setCustomSize(e.target.value)} placeholder="Ex: 42" style={{
                                                width: 70, padding: "0.5rem", borderRadius: 8, background: "rgba(255,255,255,0.05)", border: "1px solid rgba(236,72,153,0.3)", color: "white", fontSize: "0.85rem",
                                            }} onKeyDown={(e) => e.key === "Enter" && addCustomSize()} autoFocus />
                                            <button onClick={addCustomSize} style={{ padding: "0.5rem", borderRadius: 8, background: "#ec4899", border: "none", cursor: "pointer" }}>
                                                <Check style={{ width: 14, height: 14, color: "white" }} />
                                            </button>
                                        </div>
                                    ) : (
                                        <button onClick={() => setShowSizeInput(true)} style={{
                                            padding: "0.5rem 0.875rem", borderRadius: 8, background: "transparent", border: "1px dashed rgba(236,72,153,0.4)", color: "#ec4899", cursor: "pointer", fontSize: "0.8rem", display: "flex", alignItems: "center", gap: "0.3rem",
                                        }}><Plus style={{ width: 12, height: 12 }} /> Outro</button>
                                    )}
                                </div>
                            </div>

                            {/* COLORS */}
                            <div style={{ padding: "1rem", background: "linear-gradient(135deg, rgba(168,85,247,0.04), rgba(236,72,153,0.02))", borderRadius: 16, border: "1px solid rgba(168,85,247,0.1)" }}>
                                <SectionHeader icon={Palette} title="Cores Disponíveis" color="#a855f7" />
                                <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
                                    {DEFAULT_COLORS.map((c) => (
                                        <button key={c.name} type="button" onClick={() => toggleColor(c.name)} style={{
                                            width: 40, height: 40, borderRadius: 10, cursor: "pointer",
                                            background: c.hex, border: form.colors.includes(c.name) ? "3px solid #ec4899" : "2px solid rgba(255,255,255,0.15)",
                                            boxShadow: form.colors.includes(c.name) ? "0 0 12px rgba(236,72,153,0.5)" : "none",
                                            display: "flex", alignItems: "center", justifyContent: "center", transition: "all 0.2s",
                                        }} title={c.name}>
                                            {form.colors.includes(c.name) && <Check style={{ width: 16, height: 16, color: c.name === "Branco" ? "#1a1a1a" : "white" }} />}
                                        </button>
                                    ))}
                                    {showColorInput ? (
                                        <div style={{ display: "flex", gap: "0.4rem", alignItems: "center" }}>
                                            <input type="text" value={customColor} onChange={(e) => setCustomColor(e.target.value)} placeholder="Nome da cor" style={{
                                                width: 100, padding: "0.5rem", borderRadius: 8, background: "rgba(255,255,255,0.05)", border: "1px solid rgba(168,85,247,0.3)", color: "white", fontSize: "0.85rem",
                                            }} onKeyDown={(e) => e.key === "Enter" && addCustomColor()} autoFocus />
                                            <button onClick={addCustomColor} style={{ padding: "0.5rem", borderRadius: 8, background: "#a855f7", border: "none", cursor: "pointer" }}>
                                                <Check style={{ width: 14, height: 14, color: "white" }} />
                                            </button>
                                        </div>
                                    ) : (
                                        <button onClick={() => setShowColorInput(true)} style={{
                                            width: 40, height: 40, borderRadius: 10, background: "transparent", border: "2px dashed rgba(168,85,247,0.4)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
                                        }}><Plus style={{ width: 16, height: 16, color: "#a855f7" }} /></button>
                                    )}
                                </div>
                                {form.colors.filter(c => !DEFAULT_COLORS.map(dc => dc.name).includes(c)).length > 0 && (
                                    <div style={{ marginTop: "0.75rem", display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
                                        {form.colors.filter(c => !DEFAULT_COLORS.map(dc => dc.name).includes(c)).map((c) => (
                                            <span key={c} onClick={() => toggleColor(c)} style={{
                                                padding: "0.35rem 0.7rem", borderRadius: 6, background: "rgba(168,85,247,0.2)", border: "1px solid rgba(168,85,247,0.4)", color: "#c084fc", fontSize: "0.8rem", cursor: "pointer", display: "flex", alignItems: "center", gap: "0.35rem",
                                            }}>{c} <X style={{ width: 10, height: 10 }} /></span>
                                        ))}
                                    </div>
                                )}
                            </div>

                        </div>
                    </div>

                    {/* FOOTER */}
                    <div style={{
                        padding: "1rem 1.25rem",
                        background: "rgba(0,0,0,0.3)",
                        borderTop: "1px solid rgba(255,255,255,0.06)",
                        display: "flex", gap: "0.875rem",
                    }}>
                        <button onClick={onClose} style={{
                            flex: 1, padding: "0.875rem", borderRadius: 12, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.1)", color: "#94a3b8", fontWeight: 600, fontSize: "0.9rem", cursor: "pointer",
                        }}>Cancelar</button>
                        <button onClick={handleSubmit} disabled={saving} style={{
                            flex: 2, padding: "0.875rem", borderRadius: 12, background: "linear-gradient(135deg, #ec4899, #a855f7)", border: "none", color: "white", fontWeight: 700, fontSize: "0.9rem", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: "0.5rem", boxShadow: "0 8px 25px rgba(236,72,153,0.35)",
                            opacity: saving ? 0.7 : 1,
                        }}>
                            {saving ? <Loader2 style={{ width: 18, height: 18, animation: "spin 1s linear infinite" }} /> : <Save style={{ width: 18, height: 18 }} />}
                            {saving ? "Salvando..." : (isEditing ? "Salvar Alterações" : "Criar Produto")}
                        </button>
                    </div>
                </motion.div>
            </motion.div>
        </AnimatePresence>
    );
}
