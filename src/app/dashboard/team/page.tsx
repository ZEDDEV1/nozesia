"use client";

import { useState, useEffect } from "react";
import {
    Users,
    UserPlus,
    Mail,
    Shield,
    MoreVertical,
    Trash2,
    Edit3,
    X,
    Check,
    RefreshCw,
    Crown,
    User
} from "lucide-react";

interface TeamMember {
    id: string;
    name: string;
    email: string;
    role: "COMPANY_ADMIN" | "COMPANY_USER";
    avatar?: string;
    lastLoginAt: string | null;
    createdAt: string;
}

interface InviteForm {
    email: string;
    name: string;
    role: "COMPANY_ADMIN" | "COMPANY_USER";
}

export default function TeamPage() {
    const [loading, setLoading] = useState(true);
    const [members, setMembers] = useState<TeamMember[]>([]);
    const [showInviteModal, setShowInviteModal] = useState(false);
    const [inviteForm, setInviteForm] = useState<InviteForm>({
        email: "",
        name: "",
        role: "COMPANY_USER",
    });
    const [sending, setSending] = useState(false);
    const [error, setError] = useState("");
    const [success, setSuccess] = useState("");
    const [openMenu, setOpenMenu] = useState<string | null>(null);

    useEffect(() => {
        fetchTeamMembers();
    }, []);

    const fetchTeamMembers = async () => {
        try {
            const response = await fetch("/api/team");
            const data = await response.json();

            if (data.success) {
                setMembers(data.data);
            } else {
                setError(data.error || "Erro ao carregar equipe");
            }
        } catch {
            setError("Erro ao carregar equipe");
        } finally {
            setLoading(false);
        }
    };

    const handleInvite = async (e: React.FormEvent) => {
        e.preventDefault();
        setSending(true);
        setError("");

        try {
            const response = await fetch("/api/team", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(inviteForm),
            });
            const data = await response.json();

            if (data.success) {
                // Add new member to list
                setMembers([...members, data.data]);
                setInviteForm({ email: "", name: "", role: "COMPANY_USER" });
                setShowInviteModal(false);

                // Show success with temp password info
                if (data.data.tempPassword) {
                    setSuccess(`Membro criado! Senha temporária: ${data.data.tempPassword}`);
                } else {
                    setSuccess(data.message || "Membro convidado com sucesso!");
                }
                setTimeout(() => setSuccess(""), 8000);
            } else {
                setError(data.error || "Erro ao convidar membro");
            }
        } catch {
            setError("Erro ao enviar convite");
        } finally {
            setSending(false);
        }
    };

    const handleRemoveMember = async (memberId: string) => {
        if (!confirm("Tem certeza que deseja remover este membro?")) return;

        try {
            const response = await fetch(`/api/team/${memberId}`, {
                method: "DELETE",
            });
            const data = await response.json();

            if (data.success) {
                setMembers(members.filter(m => m.id !== memberId));
                setSuccess(data.message || "Membro removido com sucesso");
                setTimeout(() => setSuccess(""), 3000);
            } else {
                setError(data.error || "Erro ao remover membro");
            }
        } catch {
            setError("Erro ao remover membro");
        }
        setOpenMenu(null);
    };

    const getRoleBadge = (role: string) => {
        switch (role) {
            case "COMPANY_ADMIN":
                return { label: "Administrador", color: "#a855f7", bg: "rgba(168, 85, 247, 0.15)" };
            case "COMPANY_USER":
                return { label: "Usuário", color: "#22d3ee", bg: "rgba(6, 182, 212, 0.15)" };
            default:
                return { label: role, color: "#94a3b8", bg: "rgba(148, 163, 184, 0.15)" };
        }
    };

    const formatDate = (date: string | null) => {
        if (!date) return "Nunca";
        return new Date(date).toLocaleDateString("pt-BR", {
            day: "2-digit",
            month: "short",
            year: "numeric",
        });
    };

    if (loading) {
        return (
            <div className="dash-loading">
                <div className="dash-spinner" />
            </div>
        );
    }

    return (
        <div className="dash-fade-in">
            {/* Page Header */}
            <div className="dash-page-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
                <div>
                    <h1 className="dash-page-title">Equipe</h1>
                    <p className="dash-page-subtitle">Gerencie os membros da sua equipe</p>
                </div>
                <button className="dash-btn primary" onClick={() => setShowInviteModal(true)}>
                    <UserPlus />
                    Convidar Membro
                </button>
            </div>

            {/* Alerts */}
            {success && (
                <div style={{
                    padding: '1rem',
                    background: 'rgba(16, 185, 129, 0.1)',
                    border: '1px solid rgba(16, 185, 129, 0.2)',
                    borderRadius: '12px',
                    color: '#34d399',
                    marginBottom: '1.5rem',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem'
                }}>
                    <Check style={{ width: 18, height: 18 }} />
                    {success}
                </div>
            )}

            {error && (
                <div style={{
                    padding: '1rem',
                    background: 'rgba(239, 68, 68, 0.1)',
                    border: '1px solid rgba(239, 68, 68, 0.2)',
                    borderRadius: '12px',
                    color: '#f87171',
                    marginBottom: '1.5rem'
                }}>
                    {error}
                </div>
            )}

            {/* Stats */}
            <div className="dash-stats-grid-auto" style={{ marginBottom: '1.5rem' }}>
                <div className="dash-stat-card">
                    <div className="dash-stat-header">
                        <div>
                            <div className="dash-stat-label">Total de Membros</div>
                            <div className="dash-stat-value">{members.length}</div>
                        </div>
                        <div className="dash-stat-icon emerald"><Users /></div>
                    </div>
                </div>
                <div className="dash-stat-card">
                    <div className="dash-stat-header">
                        <div>
                            <div className="dash-stat-label">Administradores</div>
                            <div className="dash-stat-value">{members.filter(m => m.role === "COMPANY_ADMIN").length}</div>
                        </div>
                        <div className="dash-stat-icon purple"><Crown /></div>
                    </div>
                </div>
                <div className="dash-stat-card">
                    <div className="dash-stat-header">
                        <div>
                            <div className="dash-stat-label">Ativos Hoje</div>
                            <div className="dash-stat-value">{members.filter(m => m.lastLoginAt).length}</div>
                        </div>
                        <div className="dash-stat-icon cyan"><User /></div>
                    </div>
                </div>
            </div>

            {/* Team List */}
            <div className="dash-card">
                <div className="dash-card-header">
                    <h3 className="dash-card-title">
                        <Users style={{ color: '#34d399' }} />
                        Membros da Equipe
                    </h3>
                </div>
                <div className="dash-card-content" style={{ padding: 0 }}>
                    {members.length === 0 ? (
                        <div className="dash-empty">
                            <Users className="dash-empty-icon" />
                            <h4 className="dash-empty-title">Nenhum membro</h4>
                            <p className="dash-empty-text">Convide membros para colaborar</p>
                        </div>
                    ) : (
                        <div className="dash-table-wrapper">
                            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '600px' }}>
                                <thead>
                                    <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
                                        <th style={{ padding: '1rem', textAlign: 'left', color: '#94a3b8', fontSize: '0.85rem', fontWeight: 500 }}>
                                            Membro
                                        </th>
                                        <th style={{ padding: '1rem', textAlign: 'left', color: '#94a3b8', fontSize: '0.85rem', fontWeight: 500 }}>
                                            Função
                                        </th>
                                        <th style={{ padding: '1rem', textAlign: 'left', color: '#94a3b8', fontSize: '0.85rem', fontWeight: 500 }}>
                                            Último Acesso
                                        </th>
                                        <th style={{ padding: '1rem', textAlign: 'right', color: '#94a3b8', fontSize: '0.85rem', fontWeight: 500 }}>
                                            Ações
                                        </th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {members.map(member => {
                                        const roleBadge = getRoleBadge(member.role);
                                        return (
                                            <tr
                                                key={member.id}
                                                style={{
                                                    borderBottom: '1px solid rgba(255,255,255,0.04)',
                                                    transition: 'background 0.15s ease',
                                                }}
                                                onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(16, 185, 129, 0.05)'}
                                                onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                                            >
                                                <td style={{ padding: '1rem' }}>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                                        <div style={{
                                                            width: 40,
                                                            height: 40,
                                                            borderRadius: '50%',
                                                            background: 'linear-gradient(135deg, #10b981, #0d9488)',
                                                            display: 'flex',
                                                            alignItems: 'center',
                                                            justifyContent: 'center',
                                                            color: 'white',
                                                            fontWeight: 600
                                                        }}>
                                                            {member.name.charAt(0).toUpperCase()}
                                                        </div>
                                                        <div>
                                                            <div style={{ fontWeight: 500, color: 'white' }}>{member.name}</div>
                                                            <div style={{ fontSize: '0.85rem', color: '#94a3b8' }}>{member.email}</div>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td style={{ padding: '1rem' }}>
                                                    <span style={{
                                                        padding: '0.25rem 0.625rem',
                                                        borderRadius: '6px',
                                                        fontSize: '0.8rem',
                                                        fontWeight: 500,
                                                        background: roleBadge.bg,
                                                        color: roleBadge.color
                                                    }}>
                                                        {roleBadge.label}
                                                    </span>
                                                </td>
                                                <td style={{ padding: '1rem', color: '#94a3b8', fontSize: '0.9rem' }}>
                                                    {formatDate(member.lastLoginAt)}
                                                </td>
                                                <td style={{ padding: '1rem', textAlign: 'right' }}>
                                                    <div style={{ position: 'relative', display: 'inline-block' }}>
                                                        <button
                                                            onClick={() => setOpenMenu(openMenu === member.id ? null : member.id)}
                                                            style={{
                                                                padding: '0.5rem',
                                                                background: 'none',
                                                                border: 'none',
                                                                cursor: 'pointer',
                                                                color: '#94a3b8',
                                                                borderRadius: 8
                                                            }}
                                                        >
                                                            <MoreVertical style={{ width: 18, height: 18 }} />
                                                        </button>

                                                        {openMenu === member.id && (
                                                            <div style={{
                                                                position: 'absolute',
                                                                right: 0,
                                                                top: '100%',
                                                                background: '#1e293b',
                                                                border: '1px solid rgba(255,255,255,0.08)',
                                                                borderRadius: 12,
                                                                padding: '0.5rem',
                                                                zIndex: 10,
                                                                minWidth: 150,
                                                                boxShadow: '0 10px 40px rgba(0,0,0,0.3)'
                                                            }}>
                                                                <button
                                                                    onClick={() => { /* Edit role */ setOpenMenu(null); }}
                                                                    style={{
                                                                        display: 'flex',
                                                                        alignItems: 'center',
                                                                        gap: '0.5rem',
                                                                        width: '100%',
                                                                        padding: '0.625rem 0.75rem',
                                                                        background: 'none',
                                                                        border: 'none',
                                                                        color: 'white',
                                                                        fontSize: '0.9rem',
                                                                        cursor: 'pointer',
                                                                        borderRadius: 8
                                                                    }}
                                                                >
                                                                    <Edit3 style={{ width: 16, height: 16 }} />
                                                                    Alterar Função
                                                                </button>
                                                                <button
                                                                    onClick={() => handleRemoveMember(member.id)}
                                                                    style={{
                                                                        display: 'flex',
                                                                        alignItems: 'center',
                                                                        gap: '0.5rem',
                                                                        width: '100%',
                                                                        padding: '0.625rem 0.75rem',
                                                                        background: 'none',
                                                                        border: 'none',
                                                                        color: '#f87171',
                                                                        fontSize: '0.9rem',
                                                                        cursor: 'pointer',
                                                                        borderRadius: 8
                                                                    }}
                                                                >
                                                                    <Trash2 style={{ width: 16, height: 16 }} />
                                                                    Remover
                                                                </button>
                                                            </div>
                                                        )}
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            </div>

            {/* Invite Modal */}
            {
                showInviteModal && (
                    <div className="dash-modal-overlay" onClick={() => setShowInviteModal(false)}>
                        <div className="dash-modal" onClick={e => e.stopPropagation()}>
                            <div className="dash-modal-header">
                                <h3 className="dash-modal-title">Convidar Membro</h3>
                                <button className="dash-modal-close" onClick={() => setShowInviteModal(false)}>
                                    <X />
                                </button>
                            </div>
                            <form onSubmit={handleInvite}>
                                <div className="dash-modal-body">
                                    <div className="dash-form">
                                        <div className="dash-field">
                                            <label className="dash-label">Nome</label>
                                            <input
                                                type="text"
                                                value={inviteForm.name}
                                                onChange={(e) => setInviteForm({ ...inviteForm, name: e.target.value })}
                                                className="dash-input"
                                                placeholder="Nome do membro"
                                                required
                                            />
                                        </div>
                                        <div className="dash-field">
                                            <label className="dash-label">Email</label>
                                            <div style={{ position: 'relative' }}>
                                                <Mail style={{
                                                    position: 'absolute',
                                                    left: 12,
                                                    top: '50%',
                                                    transform: 'translateY(-50%)',
                                                    width: 18,
                                                    height: 18,
                                                    color: '#64748b'
                                                }} />
                                                <input
                                                    type="email"
                                                    value={inviteForm.email}
                                                    onChange={(e) => setInviteForm({ ...inviteForm, email: e.target.value })}
                                                    className="dash-input"
                                                    style={{ paddingLeft: '2.75rem' }}
                                                    placeholder="email@exemplo.com"
                                                    required
                                                />
                                            </div>
                                        </div>
                                        <div className="dash-field">
                                            <label className="dash-label">Função</label>
                                            <div style={{ position: 'relative' }}>
                                                <Shield style={{
                                                    position: 'absolute',
                                                    left: 12,
                                                    top: '50%',
                                                    transform: 'translateY(-50%)',
                                                    width: 18,
                                                    height: 18,
                                                    color: '#64748b'
                                                }} />
                                                <select
                                                    value={inviteForm.role}
                                                    onChange={(e) => setInviteForm({ ...inviteForm, role: e.target.value as "COMPANY_ADMIN" | "COMPANY_USER" })}
                                                    className="dash-input dash-select"
                                                    style={{ paddingLeft: '2.75rem' }}
                                                >
                                                    <option value="COMPANY_USER">Usuário</option>
                                                    <option value="COMPANY_ADMIN">Administrador</option>
                                                </select>
                                            </div>
                                            <p style={{ fontSize: '0.8rem', color: '#94a3b8', marginTop: '0.5rem' }}>
                                                Administradores podem gerenciar agentes, conversas e membros da equipe.
                                            </p>
                                        </div>
                                    </div>
                                </div>
                                <div className="dash-modal-footer">
                                    <button type="button" className="dash-btn secondary" onClick={() => setShowInviteModal(false)}>
                                        Cancelar
                                    </button>
                                    <button type="submit" className="dash-btn primary" disabled={sending}>
                                        {sending ? <RefreshCw style={{ animation: 'spin 1s linear infinite' }} /> : <UserPlus />}
                                        Enviar Convite
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                )
            }
        </div >
    );
}
