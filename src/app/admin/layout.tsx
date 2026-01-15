"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
    LayoutDashboard,
    Building2,
    Users,
    Settings,
    LogOut,
    Menu,
    X,
    Activity,
    Key,
    Shield,
    Bell,
    Shirt,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { ThemeToggle } from "@/components";
import "./globals-admin.css";

interface User {
    id: string;
    name: string;
    email: string;
    role: string;
}

// Menu simplificado para NozesIA Admin
const menuItems = [
    { href: "/admin", icon: LayoutDashboard, label: "Dashboard" },
    { href: "/admin/companies", icon: Building2, label: "Empresa" },
    { href: "/admin/companies/users", icon: Users, label: "Usuários" },
    { href: "/admin/tokens", icon: Key, label: "Tokens" },
    { href: "/admin/logs", icon: Activity, label: "Logs" },
    { href: "/admin/settings", icon: Settings, label: "Configurações" },
];

export default function AdminLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const pathname = usePathname();
    const router = useRouter();
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const [user, setUser] = useState<User | null>(null);

    const fetchUser = async () => {
        try {
            const response = await fetch("/api/auth/me");
            const data = await response.json();

            if (data.success && data.data.role === "SUPER_ADMIN") {
                setUser(data.data);
            } else {
                router.push("/login");
            }
        } catch {
            router.push("/login");
        }
    };

    useEffect(() => {
        fetchUser();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const handleLogout = async () => {
        await fetch("/api/auth/logout", { method: "POST" });
        router.push("/login");
    };

    return (
        <div className="admin-layout">
            {/* Mobile Overlay */}
            {sidebarOpen && (
                <div
                    className="admin-overlay"
                    onClick={() => setSidebarOpen(false)}
                />
            )}

            {/* Sidebar */}
            <aside className={cn("admin-sidebar", sidebarOpen && "open")}>
                {/* Logo */}
                <div className="sidebar-header">
                    <Link href="/admin" className="sidebar-logo">
                        <div className="logo-icon" style={{ background: 'white' }}>
                            <Shirt className="w-5 h-5 text-black" />
                        </div>
                        <div className="logo-text">
                            <span className="logo-title">NozesIA</span>
                            <span className="logo-subtitle">Admin</span>
                        </div>
                    </Link>
                    <button
                        className="sidebar-close"
                        onClick={() => setSidebarOpen(false)}
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Navigation */}
                <nav className="sidebar-nav">
                    {menuItems.map((item) => {
                        const isActive = pathname === item.href ||
                            (item.href !== "/admin" && pathname.startsWith(item.href));
                        return (
                            <Link
                                key={item.href}
                                href={item.href}
                                className={cn("nav-link", isActive && "active")}
                                onClick={() => setSidebarOpen(false)}
                            >
                                <item.icon className="nav-icon" />
                                <span className="nav-label">{item.label}</span>
                            </Link>
                        );
                    })}
                </nav>

                {/* User Section */}
                <div className="sidebar-footer">
                    <div className="user-info">
                        <div className="user-avatar">
                            {user?.name?.charAt(0).toUpperCase() || "A"}
                        </div>
                        <div className="user-details">
                            <span className="user-name">{user?.name || "Admin"}</span>
                            <span className="user-role">Super Admin</span>
                        </div>
                    </div>
                    <button onClick={handleLogout} className="logout-btn">
                        <LogOut className="w-4 h-4" />
                    </button>
                </div>
            </aside>

            {/* Main Content */}
            <div className="admin-main">
                {/* Header */}
                <header className="admin-header">
                    <div className="header-left">
                        <button
                            className="mobile-menu-btn"
                            onClick={() => setSidebarOpen(true)}
                        >
                            <Menu className="w-6 h-6" />
                        </button>
                    </div>

                    <div className="header-right">
                        <ThemeToggle />
                        <button className="header-btn notification-btn">
                            <Bell className="w-5 h-5" />
                            <span className="notification-dot" />
                        </button>
                        <div className="admin-badge">
                            <Shield className="w-4 h-4" />
                            <span>ADMIN</span>
                        </div>
                    </div>
                </header>

                {/* Page Content */}
                <main className="admin-content">
                    {children}
                </main>
            </div>
        </div>
    );
}
