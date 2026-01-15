"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import { ChevronRight, Home } from "lucide-react";

interface BreadcrumbItem {
    label: string;
    href: string;
}

const ROUTE_LABELS: Record<string, string> = {
    dashboard: "Dashboard",
    analytics: "Analytics",
    conversations: "Conversas",
    interests: "Interesses",
    products: "Produtos",
    orders: "Pedidos",
    campaigns: "Campanhas",
    templates: "Templates",
    "delivery-zones": "Taxas de Entrega",
    crm: "CRM",
    contacts: "Contatos",
    agents: "Agentes de IA",
    whatsapp: "WhatsApp",
    webhooks: "Webhooks",
    team: "Equipe",
    billing: "Faturamento",
    settings: "Configurações",
    new: "Novo",
};

export function Breadcrumbs() {
    const pathname = usePathname();

    // Skip if on main dashboard
    if (pathname === "/dashboard") return null;

    const segments = pathname.split("/").filter(Boolean);

    // Build breadcrumb items
    const items: BreadcrumbItem[] = [
        { label: "Dashboard", href: "/dashboard" },
    ];

    let currentPath = "";
    for (const segment of segments.slice(1)) { // Skip "dashboard"
        currentPath += "/" + segment;
        const label = ROUTE_LABELS[segment] || segment;
        items.push({
            label,
            href: "/dashboard" + currentPath,
        });
    }

    return (
        <nav
            aria-label="Breadcrumb"
            style={{
                display: "flex",
                alignItems: "center",
                gap: "0.5rem",
                padding: "0.75rem 0",
                marginBottom: "0.5rem",
            }}
        >
            {items.map((item, index) => (
                <div key={item.href} style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                    {index > 0 && (
                        <ChevronRight style={{ width: 14, height: 14, color: "#475569" }} />
                    )}
                    {index === 0 && (
                        <Home style={{ width: 14, height: 14, color: "#64748b" }} />
                    )}
                    {index === items.length - 1 ? (
                        <span style={{ color: "white", fontSize: "0.85rem", fontWeight: 500 }}>
                            {item.label}
                        </span>
                    ) : (
                        <Link
                            href={item.href}
                            style={{
                                color: "#64748b",
                                fontSize: "0.85rem",
                                textDecoration: "none",
                                transition: "color 0.2s",
                            }}
                            onMouseEnter={(e) => (e.currentTarget.style.color = "#94a3b8")}
                            onMouseLeave={(e) => (e.currentTarget.style.color = "#64748b")}
                        >
                            {item.label}
                        </Link>
                    )}
                </div>
            ))}
        </nav>
    );
}
