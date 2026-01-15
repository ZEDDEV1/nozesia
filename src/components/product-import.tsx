"use client";

import { useState, useRef } from "react";
import { Upload, FileSpreadsheet, Check, X, AlertCircle } from "lucide-react";

interface ImportResult {
    created: number;
    updated: number;
    errors: string[];
    total: number;
}

interface ProductImportProps {
    onComplete?: () => void;
    onClose: () => void;
}

export function ProductImport({ onComplete, onClose }: ProductImportProps) {
    const [file, setFile] = useState<File | null>(null);
    const [preview, setPreview] = useState<Record<string, string>[]>([]);
    const [importing, setImporting] = useState(false);
    const [result, setResult] = useState<ImportResult | null>(null);
    const [error, setError] = useState("");
    const fileInputRef = useRef<HTMLInputElement>(null);

    const parseCSV = (text: string): Record<string, string>[] => {
        const lines = text.trim().split("\n");
        if (lines.length < 2) return [];

        // Parse header row
        const headers = lines[0].split(/[,;]/).map(h => h.trim().toLowerCase());

        // Parse data rows
        const rows: Record<string, string>[] = [];
        for (let i = 1; i < lines.length; i++) {
            const values = lines[i].split(/[,;]/);
            const row: Record<string, string> = {};
            headers.forEach((header, idx) => {
                row[header] = values[idx]?.trim() || "";
            });
            if (row.name || row.nome) { // Accept both
                rows.push(row);
            }
        }
        return rows;
    };

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const selectedFile = e.target.files?.[0];
        if (!selectedFile) return;

        setError("");
        setResult(null);
        setFile(selectedFile);

        try {
            const text = await selectedFile.text();
            const rows = parseCSV(text);

            if (rows.length === 0) {
                setError("Arquivo CSV vazio ou formato inválido");
                return;
            }

            setPreview(rows.slice(0, 5)); // Preview first 5
        } catch {
            setError("Erro ao ler arquivo");
        }
    };

    const handleImport = async () => {
        if (!file) return;

        setImporting(true);
        setError("");

        try {
            const text = await file.text();
            const rows = parseCSV(text);

            // Map CSV columns to API format
            const products = rows.map(row => ({
                name: row.name || row.nome || "",
                description: row.description || row.descricao || row.descrição || "",
                price: parseFloat(row.price || row.preco || row.preço || row.valor || "0"),
                category: row.category || row.categoria || "",
                imageUrl: row.imageurl || row.image || row.imagem || "",
            }));

            const response = await fetch("/api/products/import", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ products }),
            });

            const data = await response.json();

            if (data.success) {
                setResult(data.data);
                onComplete?.();
            } else {
                setError(data.error || "Erro na importação");
            }
        } catch {
            setError("Erro ao processar importação");
        } finally {
            setImporting(false);
        }
    };

    return (
        <div style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.7)",
            backdropFilter: "blur(4px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 9999,
        }}>
            <div className="dash-card" style={{
                width: "100%",
                maxWidth: 600,
                margin: "0 1rem",
                maxHeight: "80vh",
                overflow: "auto",
            }}>
                <div style={{ padding: "1.25rem" }}>
                    {/* Header */}
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1rem" }}>
                        <h2 style={{ color: "#e2e8f0", fontSize: "1.1rem", fontWeight: 600, margin: 0 }}>
                            <FileSpreadsheet size={20} style={{ marginRight: "0.5rem", verticalAlign: "middle" }} />
                            Importar Produtos (CSV)
                        </h2>
                        <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: "#64748b" }}>
                            <X size={20} />
                        </button>
                    </div>

                    {/* Success result */}
                    {result && (
                        <div style={{
                            padding: "1rem",
                            background: "rgba(16, 185, 129, 0.1)",
                            border: "1px solid rgba(16, 185, 129, 0.3)",
                            borderRadius: 8,
                            marginBottom: "1rem",
                        }}>
                            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.5rem" }}>
                                <Check size={18} style={{ color: "#10b981" }} />
                                <span style={{ color: "#10b981", fontWeight: 600 }}>Importação Concluída!</span>
                            </div>
                            <p style={{ color: "#94a3b8", margin: 0, fontSize: "0.9rem" }}>
                                {result.created} criados, {result.updated} atualizados
                                {result.errors.length > 0 && `, ${result.errors.length} erros`}
                            </p>
                            {result.errors.length > 0 && (
                                <ul style={{ color: "#f87171", fontSize: "0.8rem", margin: "0.5rem 0 0", paddingLeft: "1.25rem" }}>
                                    {result.errors.slice(0, 5).map((err, i) => (
                                        <li key={i}>{err}</li>
                                    ))}
                                    {result.errors.length > 5 && <li>...e mais {result.errors.length - 5} erros</li>}
                                </ul>
                            )}
                        </div>
                    )}

                    {/* Error */}
                    {error && (
                        <div style={{
                            padding: "0.75rem",
                            background: "rgba(239, 68, 68, 0.1)",
                            border: "1px solid rgba(239, 68, 68, 0.3)",
                            borderRadius: 8,
                            marginBottom: "1rem",
                            display: "flex",
                            alignItems: "center",
                            gap: "0.5rem",
                            color: "#f87171",
                            fontSize: "0.9rem",
                        }}>
                            <AlertCircle size={16} />
                            {error}
                        </div>
                    )}

                    {/* File upload */}
                    {!result && (
                        <>
                            <div
                                onClick={() => fileInputRef.current?.click()}
                                style={{
                                    border: "2px dashed rgba(255,255,255,0.2)",
                                    borderRadius: 8,
                                    padding: "2rem",
                                    textAlign: "center",
                                    cursor: "pointer",
                                    background: file ? "rgba(16,185,129,0.1)" : "rgba(255,255,255,0.02)",
                                    transition: "all 0.2s",
                                }}
                            >
                                <Upload size={32} style={{ color: "#64748b", marginBottom: "0.5rem" }} />
                                <p style={{ color: "#e2e8f0", margin: "0 0 0.25rem" }}>
                                    {file ? file.name : "Clique para selecionar CSV"}
                                </p>
                                <p style={{ color: "#64748b", fontSize: "0.8rem", margin: 0 }}>
                                    Colunas: name, description, price, category
                                </p>
                                <input
                                    ref={fileInputRef}
                                    type="file"
                                    accept=".csv,.txt"
                                    onChange={handleFileChange}
                                    style={{ display: "none" }}
                                />
                            </div>

                            {/* Preview */}
                            {preview.length > 0 && (
                                <div style={{ marginTop: "1rem" }}>
                                    <p style={{ color: "#94a3b8", fontSize: "0.85rem", marginBottom: "0.5rem" }}>
                                        Preview ({preview.length} de {preview.length} linhas):
                                    </p>
                                    <div style={{ overflowX: "auto" }}>
                                        <table style={{ width: "100%", fontSize: "0.8rem", borderCollapse: "collapse" }}>
                                            <thead>
                                                <tr>
                                                    {Object.keys(preview[0]).slice(0, 4).map(key => (
                                                        <th key={key} style={{ padding: "0.5rem", textAlign: "left", color: "#94a3b8", borderBottom: "1px solid rgba(255,255,255,0.1)" }}>
                                                            {key}
                                                        </th>
                                                    ))}
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {preview.map((row, i) => (
                                                    <tr key={i}>
                                                        {Object.values(row).slice(0, 4).map((val, j) => (
                                                            <td key={j} style={{ padding: "0.5rem", color: "#e2e8f0", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
                                                                {String(val).substring(0, 30)}
                                                            </td>
                                                        ))}
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            )}
                        </>
                    )}

                    {/* Actions */}
                    <div style={{ display: "flex", gap: "0.5rem", justifyContent: "flex-end", marginTop: "1rem" }}>
                        <button onClick={onClose} className="dash-btn secondary">
                            {result ? "Fechar" : "Cancelar"}
                        </button>
                        {!result && (
                            <button
                                onClick={handleImport}
                                disabled={!file || importing}
                                className="dash-btn primary"
                            >
                                {importing ? "Importando..." : "Importar"}
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
