"use client";

import { useState, useMemo } from "react";
import { Smartphone, User, Bot } from "lucide-react";

interface TemplatePreviewProps {
    content: string;
    variables?: string[];
}

export function TemplatePreview({ content, variables = [] }: TemplatePreviewProps) {
    const [variableValues, setVariableValues] = useState<Record<string, string>>({});

    // Parse variables from content (format: {{variable}})
    const extractedVariables = useMemo(() => {
        return content.match(/\{\{(\w+)\}\}/g)?.map(v => v.replace(/[{}]/g, "")) || [];
    }, [content]);

    const allVariables = useMemo(() => {
        return [...new Set([...variables, ...extractedVariables])];
    }, [variables, extractedVariables]);

    // Compute preview content as derived state using useMemo
    const previewContent = useMemo(() => {
        let preview = content;

        // Replace variables with values
        allVariables.forEach(variable => {
            const value = variableValues[variable] || `[${variable}]`;
            preview = preview.replace(new RegExp(`\\{\\{${variable}\\}\\}`, "g"), value);
        });

        return preview;
    }, [content, variableValues, allVariables]);

    const handleVariableChange = (variable: string, value: string) => {
        setVariableValues(prev => ({ ...prev, [variable]: value }));
    };

    return (
        <div className="template-preview" style={{ display: "flex", gap: "1rem", flexDirection: "column" }}>
            {/* Variable inputs */}
            {allVariables.length > 0 && (
                <div style={{
                    padding: "0.75rem",
                    background: "rgba(255,255,255,0.03)",
                    borderRadius: 8,
                    border: "1px solid rgba(255,255,255,0.1)",
                }}>
                    <p style={{ color: "#94a3b8", fontSize: "0.8rem", margin: "0 0 0.5rem" }}>
                        Variáveis ({allVariables.length}):
                    </p>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem" }}>
                        {allVariables.map(variable => (
                            <input
                                key={variable}
                                type="text"
                                placeholder={variable}
                                value={variableValues[variable] || ""}
                                onChange={e => handleVariableChange(variable, e.target.value)}
                                style={{
                                    padding: "0.4rem 0.6rem",
                                    background: "rgba(0,0,0,0.3)",
                                    border: "1px solid rgba(255,255,255,0.1)",
                                    borderRadius: 6,
                                    color: "#e2e8f0",
                                    fontSize: "0.8rem",
                                    width: "auto",
                                    minWidth: 100,
                                }}
                            />
                        ))}
                    </div>
                </div>
            )}

            {/* Phone preview */}
            <div style={{
                background: "#0b141a",
                borderRadius: 16,
                border: "3px solid #1f2937",
                padding: "0.5rem",
                maxWidth: 320,
                margin: "0 auto",
            }}>
                {/* Phone header */}
                <div style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "0.5rem",
                    padding: "0.5rem",
                    borderBottom: "1px solid rgba(255,255,255,0.1)",
                    marginBottom: "0.5rem",
                }}>
                    <Smartphone size={14} style={{ color: "#64748b" }} />
                    <span style={{ color: "#64748b", fontSize: "0.75rem" }}>Preview WhatsApp</span>
                </div>

                {/* Chat area */}
                <div style={{
                    background: "#0b141a",
                    minHeight: 200,
                    padding: "0.5rem",
                    display: "flex",
                    flexDirection: "column",
                    gap: "0.5rem",
                }}>
                    {/* Customer message (simulated) */}
                    <div style={{
                        alignSelf: "flex-start",
                        background: "#1f2c34",
                        padding: "0.5rem 0.75rem",
                        borderRadius: "8px 8px 8px 0",
                        maxWidth: "80%",
                    }}>
                        <span style={{ fontSize: "0.75rem", color: "#64748b" }}>
                            <User size={10} style={{ display: "inline", marginRight: 4 }} />
                            Cliente
                        </span>
                        <p style={{ color: "#e2e8f0", fontSize: "0.85rem", margin: "0.25rem 0 0" }}>
                            Olá, gostaria de informações
                        </p>
                    </div>

                    {/* Bot response (template) */}
                    <div style={{
                        alignSelf: "flex-end",
                        background: "#005c4b",
                        padding: "0.5rem 0.75rem",
                        borderRadius: "8px 8px 0 8px",
                        maxWidth: "80%",
                    }}>
                        <span style={{ fontSize: "0.75rem", color: "rgba(255,255,255,0.6)" }}>
                            <Bot size={10} style={{ display: "inline", marginRight: 4 }} />
                            Atendente
                        </span>
                        <p style={{
                            color: "white",
                            fontSize: "0.85rem",
                            margin: "0.25rem 0 0",
                            whiteSpace: "pre-wrap",
                            wordBreak: "break-word",
                        }}>
                            {previewContent || "Digite algo para ver o preview..."}
                        </p>
                        <span style={{
                            display: "block",
                            textAlign: "right",
                            fontSize: "0.65rem",
                            color: "rgba(255,255,255,0.5)",
                            marginTop: "0.25rem",
                        }}>
                            {new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })} ✓✓
                        </span>
                    </div>
                </div>
            </div>
        </div>
    );
}
