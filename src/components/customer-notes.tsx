"use client";

import { useState, useEffect } from "react";
import { StickyNote, Plus, Trash2 } from "lucide-react";

interface Note {
    id: string;
    content: string;
    authorName: string | null;
    createdAt: string;
}

interface CustomerNotesProps {
    customerPhone: string;
    customerName?: string;
}

export function CustomerNotes({ customerPhone, customerName }: CustomerNotesProps) {
    const [notes, setNotes] = useState<Note[]>([]);
    const [loading, setLoading] = useState(true);
    const [showAdd, setShowAdd] = useState(false);
    const [newNote, setNewNote] = useState("");
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        fetchNotes();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [customerPhone]);

    const fetchNotes = async () => {
        try {
            const res = await fetch(`/api/customers/notes?phone=${encodeURIComponent(customerPhone)}`);
            const data = await res.json();
            if (data.success) {
                setNotes(data.data);
            }
        } catch (error) {
            console.error("Error fetching notes:", error);
        } finally {
            setLoading(false);
        }
    };

    const addNote = async () => {
        if (!newNote.trim() || saving) return;

        setSaving(true);
        try {
            const res = await fetch("/api/customers/notes", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    customerPhone,
                    customerName,
                    content: newNote,
                }),
            });

            const data = await res.json();
            if (data.success) {
                setNotes([data.data, ...notes]);
                setNewNote("");
                setShowAdd(false);
            }
        } catch (error) {
            console.error("Error adding note:", error);
        } finally {
            setSaving(false);
        }
    };

    const deleteNote = async (id: string) => {
        if (!confirm("Excluir esta nota?")) return;

        try {
            await fetch(`/api/customers/notes?id=${id}`, { method: "DELETE" });
            setNotes(notes.filter(n => n.id !== id));
        } catch (error) {
            console.error("Error deleting note:", error);
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

    return (
        <div className="customer-notes">
            <div style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                marginBottom: "0.75rem",
            }}>
                <h4 style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "0.5rem",
                    color: "#e2e8f0",
                    fontSize: "0.9rem",
                    fontWeight: 600,
                    margin: 0,
                }}>
                    <StickyNote size={16} />
                    Notas ({notes.length})
                </h4>
                <button
                    onClick={() => setShowAdd(!showAdd)}
                    style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "0.25rem",
                        padding: "0.25rem 0.5rem",
                        background: "rgba(16, 185, 129, 0.1)",
                        border: "1px solid rgba(16, 185, 129, 0.3)",
                        borderRadius: 6,
                        color: "#10b981",
                        cursor: "pointer",
                        fontSize: "0.75rem",
                    }}
                >
                    <Plus size={14} />
                    Nova
                </button>
            </div>

            {/* Add note form */}
            {showAdd && (
                <div style={{
                    marginBottom: "0.75rem",
                    padding: "0.75rem",
                    background: "rgba(255,255,255,0.03)",
                    borderRadius: 8,
                    border: "1px solid rgba(255,255,255,0.1)",
                }}>
                    <textarea
                        value={newNote}
                        onChange={e => setNewNote(e.target.value)}
                        placeholder="Escreva uma nota sobre este cliente..."
                        style={{
                            width: "100%",
                            minHeight: 80,
                            padding: "0.5rem",
                            background: "rgba(0,0,0,0.2)",
                            border: "1px solid rgba(255,255,255,0.1)",
                            borderRadius: 6,
                            color: "#e2e8f0",
                            fontSize: "0.85rem",
                            resize: "vertical",
                            marginBottom: "0.5rem",
                        }}
                    />
                    <div style={{ display: "flex", gap: "0.5rem", justifyContent: "flex-end" }}>
                        <button
                            onClick={() => { setShowAdd(false); setNewNote(""); }}
                            className="dash-btn secondary sm"
                        >
                            Cancelar
                        </button>
                        <button
                            onClick={addNote}
                            disabled={!newNote.trim() || saving}
                            className="dash-btn primary sm"
                        >
                            {saving ? "Salvando..." : "Salvar"}
                        </button>
                    </div>
                </div>
            )}

            {/* Notes list */}
            {loading ? (
                <div style={{ color: "#64748b", fontSize: "0.85rem" }}>Carregando...</div>
            ) : notes.length === 0 ? (
                <div style={{ color: "#64748b", fontSize: "0.85rem", fontStyle: "italic" }}>
                    Nenhuma nota registrada
                </div>
            ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                    {notes.map(note => (
                        <div
                            key={note.id}
                            style={{
                                padding: "0.75rem",
                                background: "rgba(255,255,255,0.02)",
                                borderRadius: 6,
                                border: "1px solid rgba(255,255,255,0.05)",
                            }}
                        >
                            <p style={{
                                color: "#e2e8f0",
                                fontSize: "0.85rem",
                                lineHeight: 1.5,
                                margin: "0 0 0.5rem",
                                whiteSpace: "pre-wrap",
                            }}>
                                {note.content}
                            </p>
                            <div style={{
                                display: "flex",
                                justifyContent: "space-between",
                                alignItems: "center",
                            }}>
                                <span style={{ color: "#64748b", fontSize: "0.75rem" }}>
                                    {note.authorName || "Atendente"} • {formatDate(note.createdAt)}
                                </span>
                                <button
                                    onClick={() => deleteNote(note.id)}
                                    style={{
                                        background: "none",
                                        border: "none",
                                        padding: "0.25rem",
                                        cursor: "pointer",
                                        color: "#ef4444",
                                        opacity: 0.6,
                                    }}
                                    title="Excluir nota"
                                >
                                    <Trash2 size={14} />
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
