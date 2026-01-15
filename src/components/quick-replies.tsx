"use client";

import { useState, useEffect, useRef } from "react";
import { FileText, Search, X } from "lucide-react";

interface Template {
    id: string;
    name: string;
    content: string;
    category: string;
    variables: string[];
}

interface QuickRepliesProps {
    onSelect: (content: string) => void;
    customerName?: string;
    disabled?: boolean;
}

const CATEGORY_LABELS: Record<string, string> = {
    WELCOME: "Boas-vindas",
    FOLLOW_UP: "Acompanhamento",
    PROMO: "Promoções",
    RECOVERY: "Recuperação",
    REMINDER: "Lembretes",
    THANKS: "Agradecimentos",
    CUSTOM: "Personalizado",
};

export function QuickReplies({ onSelect, customerName, disabled }: QuickRepliesProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [templates, setTemplates] = useState<Template[]>([]);
    const [loading, setLoading] = useState(false);
    const [search, setSearch] = useState("");
    const [selectedCategory, setSelectedCategory] = useState<string>("all");
    const dropdownRef = useRef<HTMLDivElement>(null);

    // Fetch templates when opened
    useEffect(() => {
        if (isOpen && templates.length === 0) {
            fetchTemplates();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isOpen]);

    // Close on click outside
    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        }

        if (isOpen) {
            document.addEventListener("mousedown", handleClickOutside);
        }

        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, [isOpen]);

    const fetchTemplates = async () => {
        setLoading(true);
        try {
            const res = await fetch("/api/templates");
            const data = await res.json();
            if (data.success) {
                setTemplates(data.data);
            }
        } catch (error) {
            console.error("Error fetching templates:", error);
        } finally {
            setLoading(false);
        }
    };

    const replaceVariables = (content: string): string => {
        let result = content;

        // Replace common variables
        result = result.replace(/\{nome\}/gi, customerName || "Cliente");
        result = result.replace(/\{empresa\}/gi, ""); // Will be filled by user
        result = result.replace(/\{data\}/gi, new Date().toLocaleDateString("pt-BR"));
        result = result.replace(/\{produto\}/gi, "[produto]");
        result = result.replace(/\{valor\}/gi, "[valor]");

        return result;
    };

    const handleSelect = (template: Template) => {
        const content = replaceVariables(template.content);
        onSelect(content);
        setIsOpen(false);
        setSearch("");
    };

    const filteredTemplates = templates.filter(t => {
        const matchesSearch = t.name.toLowerCase().includes(search.toLowerCase()) ||
            t.content.toLowerCase().includes(search.toLowerCase());
        const matchesCategory = selectedCategory === "all" || t.category === selectedCategory;
        return matchesSearch && matchesCategory;
    });

    const categories = ["all", ...new Set(templates.map(t => t.category))];

    return (
        <div className="quick-replies-container" ref={dropdownRef}>
            <button
                type="button"
                className="quick-replies-trigger"
                onClick={() => setIsOpen(!isOpen)}
                disabled={disabled}
                title="Respostas rápidas"
            >
                <FileText size={18} />
            </button>

            {isOpen && (
                <div className="quick-replies-dropdown">
                    <div className="quick-replies-header">
                        <h4>Respostas Rápidas</h4>
                        <button onClick={() => setIsOpen(false)} className="quick-replies-close">
                            <X size={16} />
                        </button>
                    </div>

                    <div className="quick-replies-search">
                        <Search size={14} />
                        <input
                            type="text"
                            placeholder="Buscar template..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            autoFocus
                        />
                    </div>

                    <div className="quick-replies-categories">
                        {categories.map(cat => (
                            <button
                                key={cat}
                                className={`quick-replies-category ${selectedCategory === cat ? "active" : ""}`}
                                onClick={() => setSelectedCategory(cat)}
                            >
                                {cat === "all" ? "Todos" : CATEGORY_LABELS[cat] || cat}
                            </button>
                        ))}
                    </div>

                    <div className="quick-replies-list">
                        {loading ? (
                            <div className="quick-replies-loading">Carregando...</div>
                        ) : filteredTemplates.length === 0 ? (
                            <div className="quick-replies-empty">
                                {templates.length === 0
                                    ? "Nenhum template criado. Crie em Templates."
                                    : "Nenhum resultado encontrado"}
                            </div>
                        ) : (
                            filteredTemplates.map(template => (
                                <button
                                    key={template.id}
                                    className="quick-replies-item"
                                    onClick={() => handleSelect(template)}
                                >
                                    <div className="quick-replies-item-header">
                                        <span className="quick-replies-item-name">{template.name}</span>
                                        <span className="quick-replies-item-category">
                                            {CATEGORY_LABELS[template.category] || template.category}
                                        </span>
                                    </div>
                                    <p className="quick-replies-item-preview">
                                        {template.content.substring(0, 80)}
                                        {template.content.length > 80 ? "..." : ""}
                                    </p>
                                </button>
                            ))
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
