"use client";

import { useState, useEffect } from "react";
import { UserPlus, Users, X, Check, Loader2 } from "lucide-react";

interface TeamMember {
    id: string;
    name: string;
    email: string;
    role: string;
}

interface AssignConversationProps {
    conversationId: string;
    currentAssignedId?: string | null;
    currentAssignedName?: string | null;
    onAssign?: (userId: string | null, userName: string | null) => void;
}

export function AssignConversation({
    conversationId,
    currentAssignedId,
    currentAssignedName,
    onAssign,
}: AssignConversationProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
    const [loading, setLoading] = useState(false);
    const [assigning, setAssigning] = useState(false);

    useEffect(() => {
        if (isOpen && teamMembers.length === 0) {
            fetchTeamMembers();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isOpen]);

    const fetchTeamMembers = async () => {
        setLoading(true);
        try {
            const res = await fetch(`/api/conversations/${conversationId}/assign`);
            const data = await res.json();
            if (data.success) {
                setTeamMembers(data.data);
            }
        } catch (error) {
            console.error("Error fetching team:", error);
        } finally {
            setLoading(false);
        }
    };

    const handleAssign = async (userId: string | null) => {
        setAssigning(true);
        try {
            const res = await fetch(`/api/conversations/${conversationId}/assign`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ userId }),
            });
            const data = await res.json();
            if (data.success) {
                const member = userId ? teamMembers.find(m => m.id === userId) : null;
                onAssign?.(userId, member?.name || null);
                setIsOpen(false);
            }
        } catch (error) {
            console.error("Error assigning:", error);
        } finally {
            setAssigning(false);
        }
    };

    return (
        <div style={{ position: "relative" }}>
            {/* Trigger Button */}
            <button
                onClick={() => setIsOpen(!isOpen)}
                style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "0.5rem",
                    padding: "0.5rem 0.75rem",
                    background: currentAssignedId ? "rgba(59, 130, 246, 0.1)" : "rgba(255,255,255,0.05)",
                    border: `1px solid ${currentAssignedId ? "rgba(59, 130, 246, 0.3)" : "rgba(255,255,255,0.1)"}`,
                    borderRadius: 6,
                    color: currentAssignedId ? "#3b82f6" : "#94a3b8",
                    cursor: "pointer",
                    fontSize: "0.85rem",
                }}
                title="Atribuir para membro da equipe"
            >
                <UserPlus size={14} />
                {currentAssignedName || "Atribuir"}
            </button>

            {/* Dropdown */}
            {isOpen && (
                <>
                    {/* Backdrop */}
                    <div
                        style={{
                            position: "fixed",
                            inset: 0,
                            zIndex: 40,
                        }}
                        onClick={() => setIsOpen(false)}
                    />

                    {/* Menu */}
                    <div style={{
                        position: "absolute",
                        top: "calc(100% + 4px)",
                        right: 0,
                        zIndex: 50,
                        minWidth: 220,
                        background: "#1e293b",
                        border: "1px solid rgba(255,255,255,0.1)",
                        borderRadius: 8,
                        boxShadow: "0 10px 25px rgba(0,0,0,0.5)",
                        overflow: "hidden",
                    }}>
                        {/* Header */}
                        <div style={{
                            padding: "0.75rem",
                            borderBottom: "1px solid rgba(255,255,255,0.1)",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                        }}>
                            <span style={{ color: "#e2e8f0", fontWeight: 600, fontSize: "0.85rem" }}>
                                <Users size={14} style={{ display: "inline", marginRight: 6 }} />
                                Atribuir para
                            </span>
                            <button
                                onClick={() => setIsOpen(false)}
                                style={{ background: "none", border: "none", cursor: "pointer", color: "#64748b" }}
                            >
                                <X size={14} />
                            </button>
                        </div>

                        {/* Content */}
                        <div style={{ maxHeight: 200, overflowY: "auto" }}>
                            {loading ? (
                                <div style={{ padding: "1rem", textAlign: "center", color: "#64748b" }}>
                                    <Loader2 className="animate-spin" size={18} style={{ margin: "0 auto" }} />
                                </div>
                            ) : (
                                <>
                                    {/* Unassign option */}
                                    {currentAssignedId && (
                                        <button
                                            onClick={() => handleAssign(null)}
                                            disabled={assigning}
                                            style={{
                                                width: "100%",
                                                padding: "0.75rem",
                                                background: "rgba(239, 68, 68, 0.1)",
                                                border: "none",
                                                borderBottom: "1px solid rgba(255,255,255,0.05)",
                                                color: "#f87171",
                                                cursor: "pointer",
                                                textAlign: "left",
                                                fontSize: "0.85rem",
                                            }}
                                        >
                                            <X size={12} style={{ display: "inline", marginRight: 6 }} />
                                            Remover atribuição
                                        </button>
                                    )}

                                    {/* Team members */}
                                    {teamMembers.map(member => (
                                        <button
                                            key={member.id}
                                            onClick={() => handleAssign(member.id)}
                                            disabled={assigning || member.id === currentAssignedId}
                                            style={{
                                                width: "100%",
                                                padding: "0.75rem",
                                                background: member.id === currentAssignedId ? "rgba(59, 130, 246, 0.1)" : "transparent",
                                                border: "none",
                                                borderBottom: "1px solid rgba(255,255,255,0.05)",
                                                color: "#e2e8f0",
                                                cursor: member.id === currentAssignedId ? "default" : "pointer",
                                                textAlign: "left",
                                                display: "flex",
                                                alignItems: "center",
                                                justifyContent: "space-between",
                                            }}
                                        >
                                            <div>
                                                <span style={{ fontSize: "0.85rem" }}>{member.name}</span>
                                                <span style={{ color: "#64748b", fontSize: "0.75rem", marginLeft: 8 }}>
                                                    {member.role === "OWNER" ? "👑" : member.role === "ADMIN" ? "🔑" : ""}
                                                </span>
                                            </div>
                                            {member.id === currentAssignedId && (
                                                <Check size={14} style={{ color: "#3b82f6" }} />
                                            )}
                                        </button>
                                    ))}

                                    {teamMembers.length === 0 && !loading && (
                                        <p style={{ padding: "1rem", color: "#64748b", textAlign: "center", fontSize: "0.85rem" }}>
                                            Nenhum membro encontrado
                                        </p>
                                    )}
                                </>
                            )}
                        </div>
                    </div>
                </>
            )}
        </div>
    );
}
