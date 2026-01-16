"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
    MessageCircle,
    LayoutDashboard,
    Bot,
    Smartphone,
    Users,
    Settings,
    LogOut,
    Menu,
    X,
    ChevronDown,
    Heart,
    ShoppingCart,
    BarChart3,
    Package,
    Send,
    FileText,
    Shirt,
    Clock,
} from "lucide-react";
import "./globals-dashboard.css";
import { EmailVerificationBanner } from "@/components/email-verification-banner";
import { GlobalNotificationProvider } from "@/components/global-notification-provider";
import { ThemeToggle } from "@/components";
import { ModulesProvider } from "@/contexts/modules-context";

interface User {
    id: string;
    name: string;
    email: string;
    role: string;
    avatar?: string;
    emailVerified?: boolean;
    companyId?: string;
}

interface Company {
    id: string;
    name: string;
    status: string;
}

interface MenuItem {
    href: string;
    icon: React.ElementType;
    label: string;
}

// Menu simplificado para NozesIA - Loja de Roupas
const menuItems: MenuItem[] = [
    { href: "/dashboard", icon: LayoutDashboard, label: "Dashboard" },
    { href: "/dashboard/conversations", icon: MessageCircle, label: "Conversas" },
    { href: "/dashboard/awaiting-response", icon: Clock, label: "Esperando Resposta" },
    { href: "/dashboard/agents", icon: Bot, label: "Agente IA" },
    { href: "/dashboard/products", icon: Package, label: "Produtos" },
    { href: "/dashboard/orders", icon: ShoppingCart, label: "Pedidos" },
    { href: "/dashboard/interests", icon: Heart, label: "Interesses" },
    { href: "/dashboard/crm", icon: Users, label: "CRM" },
    { href: "/dashboard/campaigns", icon: Send, label: "Campanhas" },
    { href: "/dashboard/templates", icon: FileText, label: "Templates" },
    { href: "/dashboard/analytics", icon: BarChart3, label: "Relatórios" },
    { href: "/dashboard/whatsapp", icon: Smartphone, label: "WhatsApp" },
    { href: "/dashboard/settings", icon: Settings, label: "Configurações" },
];

export default function DashboardLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <ModulesProvider>
            <DashboardLayoutInner>{children}</DashboardLayoutInner>
        </ModulesProvider>
    );
}

function DashboardLayoutInner({
    children,
}: {
    children: React.ReactNode;
}) {
    const pathname = usePathname();
    const router = useRouter();
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const [user, setUser] = useState<User | null>(null);
    const [company, setCompany] = useState<Company | null>(null);
    const [dropdownOpen, setDropdownOpen] = useState(false);

    const fetchUser = async () => {
        try {
            const response = await fetch("/api/auth/me");
            const data = await response.json();

            if (data.success) {
                setUser(data.data);
            } else {
                router.push("/login");
            }
        } catch {
            router.push("/login");
        }
    };

    const fetchCompany = async () => {
        try {
            const response = await fetch("/api/company");
            const data = await response.json();
            if (data.success) {
                setCompany(data.data);
            }
        } catch (error) {
            console.error("Error fetching company:", error);
        }
    };

    useEffect(() => {
        fetchUser();
        fetchCompany();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const handleLogout = async () => {
        await fetch("/api/auth/logout", { method: "POST" });
        router.push("/login");
    };

    const content = (
        <div className="dash-layout">
            {/* Mobile overlay */}
            <div
                className={`dash-overlay ${sidebarOpen ? 'visible' : ''}`}
                onClick={() => setSidebarOpen(false)}
            />

            {/* Sidebar */}
            <aside className={`dash-sidebar ${sidebarOpen ? 'open' : ''}`}>
                {/* Header */}
                <div className="dash-sidebar-header">
                    <Link href="/dashboard" className="dash-sidebar-logo">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center">
                                <Shirt className="w-5 h-5 text-black" />
                            </div>
                            <span className="text-xl font-bold text-white">
                                Nozes<span className="text-white/60">IA</span>
                            </span>
                        </div>
                    </Link>
                    <button
                        className="dash-menu-btn"
                        onClick={() => setSidebarOpen(false)}
                        style={{ display: sidebarOpen ? 'flex' : 'none' }}
                    >
                        <X />
                    </button>
                </div>

                {/* Navigation */}
                <nav className="dash-sidebar-nav">
                    {menuItems.map((item) => {
                        const isActive = pathname === item.href;

                        return (
                            <Link
                                key={item.href}
                                href={item.href}
                                className={`dash-nav-item ${isActive ? 'active' : ''}`}
                                onClick={() => setSidebarOpen(false)}
                            >
                                <item.icon />
                                {item.label}
                            </Link>
                        );
                    })}
                </nav>

                {/* User Footer */}
                <div className="dash-sidebar-footer">
                    <div style={{ position: 'relative' }}>
                        <button
                            className="dash-user-info"
                            onClick={() => setDropdownOpen(!dropdownOpen)}
                            style={{ width: '100%', cursor: 'pointer', border: 'none' }}
                        >
                            <div className="dash-user-avatar">
                                {user?.name?.charAt(0).toUpperCase() || "U"}
                            </div>
                            <div style={{ flex: 1, textAlign: 'left' }}>
                                <div className="dash-user-name">
                                    {user?.name || "Carregando..."}
                                </div>
                                <div className="dash-user-email">
                                    {user?.email || ""}
                                </div>
                            </div>
                            <ChevronDown
                                style={{
                                    width: 16,
                                    height: 16,
                                    color: '#64748b',
                                    transform: dropdownOpen ? 'rotate(180deg)' : 'none',
                                    transition: 'transform 0.2s ease'
                                }}
                            />
                        </button>

                        {dropdownOpen && (
                            <div style={{
                                position: 'absolute',
                                bottom: '100%',
                                left: 0,
                                right: 0,
                                marginBottom: '0.5rem',
                                padding: '0.5rem',
                                background: '#1a1a1a',
                                borderRadius: '12px',
                                border: '1px solid rgba(255,255,255,0.1)',
                                boxShadow: '0 10px 40px rgba(0,0,0,0.4)'
                            }}>
                                <button
                                    onClick={handleLogout}
                                    className="dash-btn danger"
                                    style={{ width: '100%', justifyContent: 'flex-start' }}
                                >
                                    <LogOut />
                                    Sair da conta
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            </aside>

            {/* Main Content */}
            <div className="dash-main">
                {/* Top Header */}
                <header className="dash-header">
                    <div className="dash-header-left">
                        <button
                            className="dash-menu-btn"
                            onClick={() => setSidebarOpen(true)}
                        >
                            <Menu />
                        </button>
                        <h2 style={{ fontSize: '1.125rem', fontWeight: 600, color: 'white', margin: 0 }}>
                            {company?.name || "NozesIA"}
                        </h2>
                    </div>

                    <div className="dash-header-right">
                        <ThemeToggle />
                        <div className="dash-status online">
                            <span className="dash-status-dot" />
                            <span>Online</span>
                        </div>
                    </div>
                </header>

                {/* Email Verification Banner */}
                {user && user.emailVerified === false && (
                    <EmailVerificationBanner userEmail={user.email} />
                )}

                {/* Page Content */}
                <main className="dash-content dash-fade-in">
                    {children}
                </main>
            </div>
        </div>
    );

    // Envolve com GlobalNotificationProvider se tiver companyId
    if (user?.companyId) {
        return (
            <GlobalNotificationProvider companyId={user.companyId}>
                {content}
            </GlobalNotificationProvider>
        );
    }

    return content;
}
