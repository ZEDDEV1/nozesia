"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
    Package,
    Plus,
    Search,
    Edit2,
    Trash2,
    Image as ImageIcon,
    DollarSign,
    Tag,
    X,
    Save,
    ToggleLeft,
    ToggleRight,
    Box,
    Upload,
    Loader2,
    FolderPlus,
    Star,
    Percent,
    AlertTriangle,
    Check,
    Sparkles,
    Eye,
} from "lucide-react";
import { StatCard } from "@/components/stat-card";
import ProductModal from "@/components/product-modal";

// Types
interface Category {
    id: string;
    name: string;
    color: string | null;
    _count?: { products: number };
}

interface Product {
    id: string;
    name: string;
    description: string | null;
    price: number;
    imageUrl: string | null;
    imagePublicId: string | null;
    categoryId: string | null;
    category: { id: string; name: string; color: string | null } | null;
    stockEnabled: boolean;
    stockQuantity: number;
    isActive: boolean;
    isFeatured?: boolean;       // Em destaque
    isPromo?: boolean;          // Em promoção
    promoPrice?: number | null; // Preço promocional
    extractedFromAI?: boolean;
    needsReview?: boolean;
    createdAt: string;
    // Campos de moda
    sizes?: string[];
    colors?: string[];
    material?: string | null;
    sku?: string | null;
    gender?: string | null;
}

interface ProductForm {
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
    // Campos de moda
    sizes: string[];
    colors: string[];
    material: string;
    sku: string;
    gender: string;
}

const initialForm: ProductForm = {
    name: "",
    description: "",
    price: "",
    imageUrl: "",
    imagePublicId: "",
    categoryId: "",
    stockEnabled: false,
    stockQuantity: "0",
    isActive: true,
    isFeatured: false,
    isPromo: false,
    promoPrice: "",
    // Campos de moda
    sizes: [],
    colors: [],
    material: "",
    sku: "",
    gender: "",
};

export default function ProductsPage() {
    const [products, setProducts] = useState<Product[]>([]);
    const [categories, setCategories] = useState<Category[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [success, setSuccess] = useState("");

    // Filters
    const [search, setSearch] = useState("");
    const [filterCategory, setFilterCategory] = useState("");
    const [filterStatus, setFilterStatus] = useState<"all" | "active" | "inactive">("all");

    // Pagination
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [totalProducts, setTotalProducts] = useState(0);
    const PRODUCTS_PER_PAGE = 20;

    // Modal
    const [showModal, setShowModal] = useState(false);
    const [editingProduct, setEditingProduct] = useState<Product | null>(null);
    const [form, setForm] = useState<ProductForm>(initialForm);
    const [saving, setSaving] = useState(false);

    // Image upload
    const [uploading, setUploading] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Category modal
    const [showCategoryModal, setShowCategoryModal] = useState(false);
    const [newCategoryName, setNewCategoryName] = useState("");
    const [newCategoryColor, setNewCategoryColor] = useState("#a855f7");
    const [savingCategory, setSavingCategory] = useState(false);

    // Review panel
    const [pendingReviewProducts, setPendingReviewProducts] = useState<Product[]>([]);
    const [showReviewPanel, setShowReviewPanel] = useState(true);
    const [reviewingProduct, setReviewingProduct] = useState<string | null>(null);

    // Dynamic fields for modal
    const [newCustomSize, setNewCustomSize] = useState("");
    const [newCustomColor, setNewCustomColor] = useState("");
    const [showCustomSizeInput, setShowCustomSizeInput] = useState(false);
    const [showCustomColorInput, setShowCustomColorInput] = useState(false);
    const [dragActive, setDragActive] = useState(false);

    // Fetch products
    const fetchProducts = useCallback(async () => {
        try {
            const params = new URLSearchParams();
            if (search) params.set("search", search);
            if (filterCategory) params.set("categoryId", filterCategory);
            if (filterStatus !== "all") params.set("status", filterStatus);
            params.set("page", page.toString());
            params.set("limit", PRODUCTS_PER_PAGE.toString());

            const response = await fetch(`/api/products?${params}`);
            const data = await response.json();

            if (data.success) {
                setProducts(data.data.products);
                setTotalPages(data.data.pagination?.pages || 1);
                setTotalProducts(data.data.pagination?.total || 0);
            } else {
                setError(data.error || "Erro ao carregar produtos");
            }
        } catch {
            setError("Erro de conexão");
        } finally {
            setLoading(false);
        }
    }, [search, filterCategory, filterStatus, page]);

    // Reset page when filters change
    useEffect(() => {
        setPage(1);
    }, [search, filterCategory, filterStatus]);

    // Fetch categories
    const fetchCategories = useCallback(async () => {
        try {
            const response = await fetch("/api/categories");
            const data = await response.json();
            if (data.success) {
                setCategories(data.data);
            }
        } catch {
            console.error("Erro ao carregar categorias");
        }
    }, []);

    // Fetch pending review products
    const fetchPendingReview = useCallback(async () => {
        try {
            const response = await fetch("/api/products?needsReview=true&limit=50");
            const data = await response.json();
            if (data.success) {
                const pending = data.data.products?.filter((p: Product) => p.needsReview) || [];
                setPendingReviewProducts(pending);
            }
        } catch {
            console.error("Erro ao buscar produtos para revisão");
        }
    }, []);

    useEffect(() => {
        fetchProducts();
        fetchCategories();
        fetchPendingReview();
    }, [fetchProducts, fetchCategories, fetchPendingReview]);

    // Format currency
    const formatCurrency = (value: number) => {
        return new Intl.NumberFormat("pt-BR", {
            style: "currency",
            currency: "BRL",
        }).format(value);
    };

    // Handle image upload
    const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        // Validate file type
        const allowedTypes = ["image/jpeg", "image/png", "image/webp", "image/gif"];
        if (!allowedTypes.includes(file.type)) {
            setError("Tipo de arquivo não permitido. Use JPG, PNG, WebP ou GIF.");
            return;
        }

        // Validate file size (max 5MB)
        if (file.size > 5 * 1024 * 1024) {
            setError("Arquivo muito grande. Máximo 5MB.");
            return;
        }

        setUploading(true);
        setError("");

        try {
            // Convert to base64
            const reader = new FileReader();
            reader.onloadend = async () => {
                const base64 = reader.result as string;

                const response = await fetch("/api/upload", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        file: base64,
                        type: "base64",
                        folder: "products",
                        filename: file.name,
                    }),
                });

                const data = await response.json();

                if (data.success) {
                    setForm({
                        ...form,
                        imageUrl: data.data.url,
                        imagePublicId: data.data.publicId,
                    });
                    setSuccess("Imagem enviada!");
                    setTimeout(() => setSuccess(""), 2000);
                } else {
                    setError(data.error || "Erro ao enviar imagem");
                }
                setUploading(false);
            };
            reader.readAsDataURL(file);
        } catch {
            setError("Erro ao enviar imagem");
            setUploading(false);
        }
    };

    // Open modal for create/edit
    const openModal = (product?: Product) => {
        if (product) {
            setEditingProduct(product);
            setForm({
                name: product.name,
                description: product.description || "",
                price: product.price.toString(),
                imageUrl: product.imageUrl || "",
                imagePublicId: product.imagePublicId || "",
                categoryId: product.categoryId || "",
                stockEnabled: product.stockEnabled,
                stockQuantity: product.stockQuantity.toString(),
                isActive: product.isActive,
                isFeatured: product.isFeatured || false,
                isPromo: product.isPromo || false,
                promoPrice: product.promoPrice?.toString() || "",
                // Campos de moda
                sizes: product.sizes || [],
                colors: product.colors || [],
                material: product.material || "",
                sku: product.sku || "",
                gender: product.gender || "",
            });
        } else {
            setEditingProduct(null);
            setForm(initialForm);
        }
        setShowModal(true);
    };

    // Close modal
    const closeModal = () => {
        setShowModal(false);
        setEditingProduct(null);
        setForm(initialForm);
    };

    // Save product
    const saveProduct = async () => {
        if (!form.name.trim()) {
            setError("Nome do produto é obrigatório");
            return;
        }
        if (!form.price || isNaN(parseFloat(form.price)) || parseFloat(form.price) < 0) {
            setError("Preço deve ser um número válido");
            return;
        }

        setSaving(true);
        setError("");

        try {
            const url = editingProduct
                ? `/api/products/${editingProduct.id}`
                : "/api/products";
            const method = editingProduct ? "PATCH" : "POST";

            const response = await fetch(url, {
                method,
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    name: form.name.trim(),
                    description: form.description.trim() || null,
                    price: parseFloat(form.price),
                    imageUrl: form.imageUrl || null,
                    imagePublicId: form.imagePublicId || null,
                    categoryId: form.categoryId || null,
                    stockEnabled: form.stockEnabled,
                    stockQuantity: parseInt(form.stockQuantity) || 0,
                    isActive: form.isActive,
                    // Campos de moda
                    sizes: form.sizes,
                    colors: form.colors,
                    material: form.material.trim() || null,
                    sku: form.sku.trim() || null,
                    gender: form.gender || null,
                }),
            });

            const data = await response.json();

            if (data.success) {
                setSuccess(editingProduct ? "Produto atualizado!" : "Produto criado!");
                closeModal();
                fetchProducts();
                setTimeout(() => setSuccess(""), 3000);
            } else {
                setError(data.error || "Erro ao salvar produto");
            }
        } catch {
            setError("Erro de conexão");
        } finally {
            setSaving(false);
        }
    };

    // Delete product
    const deleteProduct = async (id: string) => {
        if (!confirm("Tem certeza que deseja excluir este produto?")) return;

        try {
            const response = await fetch(`/api/products/${id}`, { method: "DELETE" });
            const data = await response.json();

            if (data.success) {
                setProducts(products.filter((p) => p.id !== id));
                setSuccess("Produto excluído!");
                setTimeout(() => setSuccess(""), 3000);
            } else {
                setError(data.error || "Erro ao excluir produto");
            }
        } catch {
            setError("Erro de conexão");
        }
    };

    // Toggle active status
    const toggleActive = async (product: Product) => {
        try {
            const response = await fetch(`/api/products/${product.id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ isActive: !product.isActive }),
            });

            const data = await response.json();
            if (data.success) {
                setProducts(products.map((p) =>
                    p.id === product.id ? { ...p, isActive: !p.isActive } : p
                ));
            }
        } catch {
            setError("Erro ao atualizar produto");
        }
    };

    // Create category
    const createCategory = async () => {
        if (!newCategoryName.trim()) {
            setError("Nome da categoria é obrigatório");
            return;
        }

        setSavingCategory(true);
        try {
            const response = await fetch("/api/categories", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    name: newCategoryName.trim(),
                    color: newCategoryColor,
                }),
            });

            const data = await response.json();

            if (data.success) {
                setCategories([...categories, data.data]);
                setForm({ ...form, categoryId: data.data.id });
                setShowCategoryModal(false);
                setNewCategoryName("");
                setSuccess("Categoria criada!");
                setTimeout(() => setSuccess(""), 2000);
            } else {
                setError(data.error || "Erro ao criar categoria");
            }
        } catch {
            setError("Erro de conexão");
        } finally {
            setSavingCategory(false);
        }
    };

    // Review product (approve/reject)
    const reviewProduct = async (productId: string, action: "approve" | "reject") => {
        setReviewingProduct(productId);
        try {
            const response = await fetch("/api/products/review", {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    actions: [{ productId, action }],
                }),
            });

            const data = await response.json();
            if (data.success) {
                setPendingReviewProducts(prev => prev.filter(p => p.id !== productId));
                if (action === "approve") {
                    setSuccess("Produto aprovado!");
                    fetchProducts();
                } else {
                    setSuccess("Produto removido!");
                }
                setTimeout(() => setSuccess(""), 2000);
            } else {
                setError(data.error || "Erro ao revisar produto");
            }
        } catch {
            setError("Erro de conexão");
        } finally {
            setReviewingProduct(null);
        }
    };

    // Approve all pending products
    const approveAllPending = async () => {
        if (pendingReviewProducts.length === 0) return;
        if (!confirm(`Aprovar todos os ${pendingReviewProducts.length} produtos?`)) return;

        try {
            const actions = pendingReviewProducts.map(p => ({ productId: p.id, action: "approve" as const }));
            const response = await fetch("/api/products/review", {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ actions }),
            });

            const data = await response.json();
            if (data.success) {
                setPendingReviewProducts([]);
                setSuccess(`${data.data.approved} produtos aprovados!`);
                fetchProducts();
                setTimeout(() => setSuccess(""), 3000);
            }
        } catch {
            setError("Erro ao aprovar produtos");
        }
    };

    // Stats with useMemo
    const stats = useMemo(() => ({
        total: totalProducts,
        active: products.filter((p) => p.isActive).length,
        withStock: products.filter((p) => p.stockEnabled && p.stockQuantity > 0).length,
        totalValue: products.reduce((acc, p) => acc + p.price, 0),
        pendingReview: pendingReviewProducts.length,
        featured: products.filter((p) => p.isFeatured).length,
        promo: products.filter((p) => p.isPromo).length,
    }), [products, totalProducts, pendingReviewProducts]);

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
                            background: "linear-gradient(135deg, #8b5cf6 0%, #a855f7 100%)",
                            display: "inline-flex",
                            alignItems: "center",
                            justifyContent: "center",
                            boxShadow: "0 8px 24px rgba(139, 92, 246, 0.3)",
                        }}>
                            <Package style={{ width: 22, height: 22, color: "white" }} />
                        </span>
                        Produtos
                        {stats.pendingReview > 0 && (
                            <span style={{
                                padding: "0.25rem 0.65rem",
                                borderRadius: 20,
                                background: "linear-gradient(135deg, rgba(251, 191, 36, 0.2), rgba(245, 158, 11, 0.1))",
                                border: "1px solid rgba(251, 191, 36, 0.3)",
                                color: "#fbbf24",
                                fontSize: "0.75rem",
                                fontWeight: 600,
                                display: "flex",
                                alignItems: "center",
                                gap: "0.35rem",
                            }}>
                                <AlertTriangle style={{ width: 14, height: 14 }} />
                                {stats.pendingReview} para revisar
                            </span>
                        )}
                    </h1>
                    <p className="dash-page-subtitle">Gerencie seu catálogo de produtos e serviços</p>
                </div>
                <button className="dash-btn primary" onClick={() => openModal()}>
                    <Plus />
                    Adicionar Produto
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
                <StatCard title="Total de Produtos" value={stats.total} icon={Package} color="purple" index={0} />
                <StatCard title="Produtos Ativos" value={stats.active} icon={ToggleRight} color="emerald" index={1} />
                <StatCard title="Valor Médio" value={formatCurrency(stats.total > 0 ? stats.totalValue / stats.total : 0)} icon={DollarSign} color="amber" index={2} />
                <StatCard title="Em Destaque" value={stats.featured} icon={Star} color="cyan" index={3} />
            </div>

            {/* Review Panel */}
            <AnimatePresence>
                {pendingReviewProducts.length > 0 && showReviewPanel && (
                    <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        exit={{ opacity: 0, height: 0 }}
                        className="dash-card"
                        style={{
                            marginBottom: "1.5rem",
                            border: "1px solid rgba(251, 191, 36, 0.3)",
                            background: "linear-gradient(135deg, rgba(251, 191, 36, 0.05), rgba(245, 158, 11, 0.02))",
                        }}
                    >
                        <div className="dash-card-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                            <h3 className="dash-card-title" style={{ display: "flex", alignItems: "center", gap: "0.5rem", color: "#fbbf24" }}>
                                <AlertTriangle style={{ width: 20, height: 20 }} />
                                {pendingReviewProducts.length} Produto{pendingReviewProducts.length > 1 ? "s" : ""} Aguardando Revisão
                            </h3>
                            <div style={{ display: "flex", gap: "0.5rem" }}>
                                <button
                                    className="dash-btn primary"
                                    onClick={approveAllPending}
                                    style={{ padding: "0.5rem 1rem", fontSize: "0.8rem" }}
                                >
                                    <Check style={{ width: 14, height: 14 }} />
                                    Aprovar Todos
                                </button>
                                <button
                                    className="dash-btn secondary"
                                    onClick={() => setShowReviewPanel(false)}
                                    style={{ padding: "0.5rem" }}
                                >
                                    <X style={{ width: 14, height: 14 }} />
                                </button>
                            </div>
                        </div>
                        <div className="dash-card-content" style={{ padding: "0.5rem 1rem 1rem" }}>
                            <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                                {pendingReviewProducts.slice(0, 5).map((product) => (
                                    <motion.div
                                        key={product.id}
                                        initial={{ opacity: 0, x: -20 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        exit={{ opacity: 0, x: 20 }}
                                        style={{
                                            display: "flex",
                                            alignItems: "center",
                                            gap: "1rem",
                                            padding: "0.75rem",
                                            background: "rgba(255,255,255,0.03)",
                                            borderRadius: 10,
                                            border: "1px solid rgba(255,255,255,0.08)",
                                        }}
                                    >
                                        {/* Image */}
                                        <div style={{
                                            width: 50,
                                            height: 50,
                                            borderRadius: 8,
                                            overflow: "hidden",
                                            background: "linear-gradient(135deg, rgba(168, 85, 247, 0.2), rgba(59, 130, 246, 0.2))",
                                            display: "flex",
                                            alignItems: "center",
                                            justifyContent: "center",
                                            flexShrink: 0,
                                        }}>
                                            {product.imageUrl ? (
                                                <img src={product.imageUrl} alt={product.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                                            ) : (
                                                <ImageIcon style={{ width: 24, height: 24, color: "#64748b" }} />
                                            )}
                                        </div>

                                        {/* Info */}
                                        <div style={{ flex: 1, minWidth: 0 }}>
                                            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.25rem" }}>
                                                <span style={{ color: "white", fontWeight: 600, fontSize: "0.95rem" }}>{product.name}</span>
                                                <span style={{
                                                    padding: "0.15rem 0.5rem",
                                                    borderRadius: 4,
                                                    background: "rgba(139, 92, 246, 0.2)",
                                                    color: "#a78bfa",
                                                    fontSize: "0.65rem",
                                                    fontWeight: 600,
                                                }}>
                                                    <Sparkles style={{ width: 10, height: 10, display: "inline", marginRight: 3 }} />
                                                    IA
                                                </span>
                                            </div>
                                            <div style={{ color: "#94a3b8", fontSize: "0.85rem" }}>
                                                {formatCurrency(product.price)}
                                                {product.category && <span> • {product.category.name}</span>}
                                            </div>
                                        </div>

                                        {/* Actions */}
                                        <div style={{ display: "flex", gap: "0.5rem", flexShrink: 0 }}>
                                            <button
                                                className="dash-btn secondary"
                                                onClick={() => openModal(product)}
                                                disabled={reviewingProduct === product.id}
                                                style={{ padding: "0.5rem" }}
                                                title="Editar e aprovar"
                                            >
                                                <Eye style={{ width: 16, height: 16 }} />
                                            </button>
                                            <button
                                                className="dash-btn"
                                                onClick={() => reviewProduct(product.id, "approve")}
                                                disabled={reviewingProduct === product.id}
                                                style={{
                                                    padding: "0.5rem",
                                                    background: "rgba(34, 197, 94, 0.15)",
                                                    border: "1px solid rgba(34, 197, 94, 0.3)",
                                                    color: "#22c55e",
                                                }}
                                                title="Aprovar produto"
                                            >
                                                {reviewingProduct === product.id ? (
                                                    <Loader2 style={{ width: 16, height: 16, animation: "spin 1s linear infinite" }} />
                                                ) : (
                                                    <Check style={{ width: 16, height: 16 }} />
                                                )}
                                            </button>
                                            <button
                                                className="dash-btn"
                                                onClick={() => reviewProduct(product.id, "reject")}
                                                disabled={reviewingProduct === product.id}
                                                style={{
                                                    padding: "0.5rem",
                                                    background: "rgba(239, 68, 68, 0.15)",
                                                    border: "1px solid rgba(239, 68, 68, 0.3)",
                                                    color: "#ef4444",
                                                }}
                                                title="Rejeitar produto"
                                            >
                                                <Trash2 style={{ width: 16, height: 16 }} />
                                            </button>
                                        </div>
                                    </motion.div>
                                ))}
                                {pendingReviewProducts.length > 5 && (
                                    <p style={{ color: "#94a3b8", fontSize: "0.85rem", textAlign: "center", margin: 0 }}>
                                        E mais {pendingReviewProducts.length - 5} produto(s)...
                                    </p>
                                )}
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Filters */}
            <div className="dash-card" style={{ marginBottom: "1.5rem" }}>
                <div className="dash-card-content" style={{ display: "flex", gap: "1rem", flexWrap: "wrap" }}>
                    <div style={{ flex: 1, minWidth: 200 }}>
                        <div className="dash-input-wrapper">
                            <Search className="dash-input-icon" />
                            <input
                                type="text"
                                className="dash-input"
                                placeholder="Buscar produtos..."
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                style={{ paddingLeft: "2.5rem" }}
                            />
                        </div>
                    </div>
                    <select
                        className="dash-select"
                        value={filterCategory}
                        onChange={(e) => setFilterCategory(e.target.value)}
                        style={{ minWidth: 150 }}
                    >
                        <option value="">Todas categorias</option>
                        {categories.map((cat) => (
                            <option key={cat.id} value={cat.id}>{cat.name}</option>
                        ))}
                    </select>
                    <select
                        className="dash-select"
                        value={filterStatus}
                        onChange={(e) => setFilterStatus(e.target.value as "all" | "active" | "inactive")}
                        style={{ minWidth: 120 }}
                    >
                        <option value="all">Todos</option>
                        <option value="active">Ativos</option>
                        <option value="inactive">Inativos</option>
                    </select>
                </div>
            </div>

            {/* Products Grid */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: "1rem" }}>
                {products.map((product) => (
                    <div
                        key={product.id}
                        className="dash-card"
                        style={{
                            opacity: product.isActive ? 1 : 0.6,
                            transition: "all 0.2s ease",
                        }}
                        onMouseEnter={(e) => {
                            e.currentTarget.style.transform = "translateY(-4px)";
                            e.currentTarget.style.boxShadow = "0 12px 30px rgba(0, 0, 0, 0.35)";
                        }}
                        onMouseLeave={(e) => {
                            e.currentTarget.style.transform = "translateY(0)";
                            e.currentTarget.style.boxShadow = "";
                        }}
                    >
                        <div className="dash-card-content">
                            {/* Image */}
                            <div style={{
                                width: "100%",
                                height: 160,
                                borderRadius: 12,
                                overflow: "hidden",
                                background: "linear-gradient(135deg, rgba(168, 85, 247, 0.2), rgba(59, 130, 246, 0.2))",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                marginBottom: "1rem",
                                position: "relative",
                            }}>
                                {product.imageUrl ? (
                                    <img
                                        src={product.imageUrl}
                                        alt={product.name}
                                        loading="lazy"
                                        style={{
                                            width: "100%",
                                            height: "100%",
                                            objectFit: "cover",
                                        }}
                                    />
                                ) : (
                                    <ImageIcon style={{ width: 48, height: 48, color: "#64748b" }} />
                                )}
                                {/* Badges */}
                                {(product.isFeatured || product.isPromo) && (
                                    <div style={{ position: "absolute", top: 8, right: 8, display: "flex", gap: 4 }}>
                                        {product.isFeatured && (
                                            <span style={{ background: "#fbbf24", color: "#000", padding: "2px 6px", borderRadius: 4, fontSize: "0.7rem", fontWeight: 600, display: "flex", alignItems: "center", gap: 2 }}>
                                                <Star size={10} /> Destaque
                                            </span>
                                        )}
                                        {product.isPromo && (
                                            <span style={{ background: "#ef4444", color: "#fff", padding: "2px 6px", borderRadius: 4, fontSize: "0.7rem", fontWeight: 600, display: "flex", alignItems: "center", gap: 2 }}>
                                                <Percent size={10} /> Promo
                                            </span>
                                        )}
                                    </div>
                                )}
                            </div>

                            {/* Info */}
                            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: "0.5rem" }}>
                                <h3 style={{ fontSize: "1.1rem", fontWeight: 600, color: "white", margin: 0 }}>
                                    {product.name}
                                </h3>
                                <span style={{
                                    fontSize: "1rem",
                                    fontWeight: 700,
                                    color: "#34d399",
                                }}>
                                    {formatCurrency(product.price)}
                                </span>
                            </div>

                            {product.description && (
                                <p style={{ color: "#94a3b8", fontSize: "0.85rem", marginBottom: "0.75rem", lineHeight: 1.4 }}>
                                    {product.description.length > 80
                                        ? product.description.substring(0, 80) + "..."
                                        : product.description}
                                </p>
                            )}

                            {/* Tags */}
                            <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", marginBottom: "1rem" }}>
                                {product.category && (
                                    <span
                                        className="dash-list-badge"
                                        style={{
                                            background: product.category.color ? `${product.category.color}20` : undefined,
                                            color: product.category.color || undefined,
                                        }}
                                    >
                                        <Tag style={{ width: 12, height: 12 }} />
                                        {product.category.name}
                                    </span>
                                )}
                                {product.stockEnabled && (
                                    <span className={`dash-list-badge ${product.stockQuantity > 0 ? "success" : "warning"}`}>
                                        <Box style={{ width: 12, height: 12 }} />
                                        {product.stockQuantity} un
                                    </span>
                                )}
                                {!product.isActive && (
                                    <span className="dash-list-badge warning">Inativo</span>
                                )}
                                {product.needsReview && (
                                    <span className="dash-list-badge" style={{
                                        background: "rgba(251, 191, 36, 0.2)",
                                        color: "#fbbf24",
                                        border: "1px solid rgba(251, 191, 36, 0.3)",
                                    }}>
                                        ⚠️ Revisar
                                    </span>
                                )}
                                {product.extractedFromAI && !product.needsReview && (
                                    <span className="dash-list-badge" style={{
                                        background: "rgba(139, 92, 246, 0.2)",
                                        color: "#a78bfa",
                                        border: "1px solid rgba(139, 92, 246, 0.3)",
                                    }}>
                                        🤖 IA
                                    </span>
                                )}
                            </div>

                            {/* Actions */}
                            <div style={{ display: "flex", gap: "0.5rem" }}>
                                <button
                                    onClick={() => toggleActive(product)}
                                    className="dash-btn secondary sm"
                                    style={{ flex: 1 }}
                                    title={product.isActive ? "Desativar" : "Ativar"}
                                >
                                    {product.isActive ? <ToggleRight /> : <ToggleLeft />}
                                </button>
                                <button
                                    onClick={() => openModal(product)}
                                    className="dash-btn secondary sm"
                                    style={{ flex: 1 }}
                                >
                                    <Edit2 />
                                </button>
                                <button
                                    onClick={() => deleteProduct(product.id)}
                                    className="dash-btn secondary sm"
                                    style={{ flex: 1, color: "#f87171" }}
                                >
                                    <Trash2 />
                                </button>
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            {/* Pagination Controls */}
            {totalPages > 1 && (
                <div style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "1rem",
                    marginTop: "1rem",
                    background: "rgba(255,255,255,0.03)",
                    borderRadius: "12px",
                    border: "1px solid rgba(255,255,255,0.08)",
                }}>
                    <span style={{ color: "#64748b", fontSize: "0.85rem" }}>
                        Mostrando {((page - 1) * PRODUCTS_PER_PAGE) + 1}-{Math.min(page * PRODUCTS_PER_PAGE, totalProducts)} de {totalProducts} produtos
                    </span>
                    <div style={{ display: "flex", gap: "0.5rem" }}>
                        <button
                            onClick={() => setPage(p => Math.max(1, p - 1))}
                            disabled={page === 1}
                            className="dash-btn secondary"
                            style={{
                                padding: "0.5rem 1rem",
                                opacity: page === 1 ? 0.5 : 1,
                            }}
                        >
                            Anterior
                        </button>
                        <span style={{
                            padding: "0.5rem 1rem",
                            background: "rgba(167, 139, 250, 0.2)",
                            borderRadius: "8px",
                            color: "#a78bfa",
                            fontWeight: 600,
                        }}>
                            {page} / {totalPages}
                        </span>
                        <button
                            onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                            disabled={page === totalPages}
                            className="dash-btn secondary"
                            style={{
                                padding: "0.5rem 1rem",
                                opacity: page === totalPages ? 0.5 : 1,
                            }}
                        >
                            Próximo
                        </button>
                    </div>
                </div>
            )}

            {/* Empty State */}
            {products.length === 0 && (
                <div className="dash-card">
                    <div className="dash-empty">
                        <Package className="dash-empty-icon" />
                        <h4 className="dash-empty-title">Nenhum produto cadastrado</h4>
                        <p className="dash-empty-text" style={{ marginBottom: "1.5rem" }}>
                            Adicione seus produtos para que a IA possa informar preços e enviar imagens.
                        </p>
                        <button className="dash-btn primary" onClick={() => openModal()}>
                            <Plus />
                            Adicionar Primeiro Produto
                        </button>
                    </div>
                </div>
            )}

            {/* Hidden file input */}
            <input
                type="file"
                ref={fileInputRef}
                onChange={handleImageUpload}
                accept="image/jpeg,image/png,image/webp,image/gif"
                style={{ display: "none" }}
            />

            {/* Product Modal - Premium Component */}
            <ProductModal
                isOpen={showModal}
                onClose={closeModal}
                onSave={async (data) => {
                    setSaving(true);
                    setError("");
                    try {
                        const url = editingProduct ? `/api/products/${editingProduct.id}` : "/api/products";
                        const method = editingProduct ? "PATCH" : "POST";
                        const response = await fetch(url, {
                            method,
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({
                                name: data.name.trim(),
                                description: data.description.trim() || null,
                                price: parseFloat(data.price),
                                imageUrl: data.imageUrl || null,
                                imagePublicId: data.imagePublicId || null,
                                categoryId: data.categoryId || null,
                                stockEnabled: data.stockEnabled,
                                stockQuantity: parseInt(data.stockQuantity) || 0,
                                isActive: data.isActive,
                                sizes: data.sizes,
                                colors: data.colors,
                                material: data.material.trim() || null,
                                sku: data.sku.trim() || null,
                                gender: data.gender || null,
                            }),
                        });
                        const result = await response.json();
                        if (result.success) {
                            setSuccess(editingProduct ? "Produto atualizado!" : "Produto criado!");
                            closeModal();
                            fetchProducts();
                            setTimeout(() => setSuccess(""), 3000);
                        } else {
                            setError(result.error || "Erro ao salvar produto");
                        }
                    } catch {
                        setError("Erro de conexão");
                    } finally {
                        setSaving(false);
                    }
                }}
                onImageUpload={async (e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    if (!file.type.startsWith("image/")) {
                        setError("Apenas imagens são permitidas");
                        return;
                    }
                    if (file.size > 5 * 1024 * 1024) {
                        setError("Imagem muito grande (máx 5MB)");
                        return;
                    }
                    setUploading(true);
                    try {
                        const reader = new FileReader();
                        reader.onloadend = async () => {
                            const base64 = reader.result as string;
                            const res = await fetch("/api/upload", {
                                method: "POST",
                                headers: { "Content-Type": "application/json" },
                                body: JSON.stringify({ file: base64, type: "base64", folder: "products" }),
                            });
                            const data = await res.json();
                            if (data.success) {
                                setForm(f => ({ ...f, imageUrl: data.data.url, imagePublicId: data.data.publicId }));
                            } else {
                                setError(data.error || "Erro ao enviar imagem");
                            }
                            setUploading(false);
                        };
                        reader.readAsDataURL(file);
                    } catch {
                        setError("Erro ao enviar imagem");
                        setUploading(false);
                    }
                }}
                categories={categories}
                onCreateCategory={() => setShowCategoryModal(true)}
                initialData={form}
                isEditing={!!editingProduct}
                saving={saving}
                uploading={uploading}
            />

            {/* Category Modal */}
            {showCategoryModal && (
                <div style={{
                    position: "fixed",
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    background: "rgba(0, 0, 0, 0.8)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    zIndex: 1001,
                }}>
                    <div className="dash-card" style={{ width: "100%", maxWidth: 400 }}>
                        <div className="dash-card-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                            <h3 className="dash-card-title">Nova Categoria</h3>
                            <button onClick={() => setShowCategoryModal(false)} style={{ background: "none", border: "none", color: "#94a3b8", cursor: "pointer" }}>
                                <X />
                            </button>
                        </div>
                        <div className="dash-card-content">
                            <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
                                <div>
                                    <label className="dash-label">Nome da Categoria *</label>
                                    <input
                                        type="text"
                                        className="dash-input"
                                        placeholder="Ex: Camisetas, Calças, etc"
                                        value={newCategoryName}
                                        onChange={(e) => setNewCategoryName(e.target.value)}
                                    />
                                </div>
                                <div>
                                    <label className="dash-label">Cor</label>
                                    <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
                                        {["#ec4899", "#a855f7", "#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#6b7280"].map((color) => (
                                            <button
                                                key={color}
                                                type="button"
                                                onClick={() => setNewCategoryColor(color)}
                                                style={{
                                                    width: 32,
                                                    height: 32,
                                                    borderRadius: 8,
                                                    background: color,
                                                    border: newCategoryColor === color ? "2px solid white" : "none",
                                                    cursor: "pointer",
                                                }}
                                            />
                                        ))}
                                    </div>
                                </div>
                                <div style={{ display: "flex", gap: "1rem" }}>
                                    <button className="dash-btn secondary" onClick={() => setShowCategoryModal(false)} style={{ flex: 1 }}>
                                        Cancelar
                                    </button>
                                    <button
                                        className="dash-btn primary"
                                        onClick={createCategory}
                                        disabled={savingCategory}
                                        style={{ flex: 1 }}
                                    >
                                        {savingCategory ? "Salvando..." : "Criar"}
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </motion.div>
    );
}
