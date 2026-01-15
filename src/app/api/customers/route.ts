/**
 * API: Customers (CRM)
 * 
 * Returns all customers who have interacted with the company,
 * extracted from conversations with segment classification.
 * 
 * GET /api/customers - List all customers with segments
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { logger } from "@/lib/logger";

interface CustomerData {
    id: string;
    phone: string;
    name: string;
    segment: "HOT" | "WARM" | "INACTIVE" | "COLD" | "VIP";
    lastInteractionAt: Date | null;
    lastPurchaseAt: Date | null;
    totalMessages: number;
    totalOrders: number;
    totalSpent: number;
    firstContactAt: Date;
    optedOut: boolean;
}

/**
 * Calculate segment based on activity
 */
function calculateSegment(
    lastInteractionAt: Date | null,
    lastPurchaseAt: Date | null,
    totalOrders: number
): "HOT" | "WARM" | "INACTIVE" | "COLD" | "VIP" {
    const now = new Date();
    const daysSinceInteraction = lastInteractionAt
        ? Math.floor((now.getTime() - lastInteractionAt.getTime()) / (1000 * 60 * 60 * 24))
        : 999;
    const daysSincePurchase = lastPurchaseAt
        ? Math.floor((now.getTime() - lastPurchaseAt.getTime()) / (1000 * 60 * 60 * 24))
        : 999;

    // VIP: Many orders
    if (totalOrders >= 5) return "VIP";

    // HOT: Purchased in last 30 days
    if (daysSincePurchase <= 30) return "HOT";

    // WARM: Interacted in last 30 days
    if (daysSinceInteraction <= 30) return "WARM";

    // INACTIVE: 30-60 days without interaction
    if (daysSinceInteraction <= 60) return "INACTIVE";

    // COLD: 60+ days without interaction
    return "COLD";
}

const SEGMENT_ORDER = { VIP: 0, HOT: 1, WARM: 2, INACTIVE: 3, COLD: 4 };

/**
 * GET /api/customers - List all customers from conversations
 */
export async function GET(request: NextRequest) {
    try {
        const user = await getCurrentUser();
        if (!user || !user.companyId) {
            return NextResponse.json(
                { success: false, error: "Não autorizado" },
                { status: 401 }
            );
        }

        const { searchParams } = new URL(request.url);
        const segment = searchParams.get("segment");
        const search = searchParams.get("search");
        const tagFilter = searchParams.get("tag"); // Novo: filtro por tag
        const page = parseInt(searchParams.get("page") || "1");
        const limit = parseInt(searchParams.get("limit") || "20");

        // Se filtrar por tag, buscar os phones que têm essa tag
        let phonesWithTag: Set<string> | null = null;
        if (tagFilter) {
            const contactTags = await prisma.contactTag.findMany({
                where: {
                    companyId: user.companyId,
                    tag: {
                        name: tagFilter,
                    },
                },
                select: { phone: true },
            });
            phonesWithTag = new Set(contactTags.map(ct => ct.phone));
        }

        // Get all conversations for this company
        const conversations = await prisma.conversation.findMany({
            where: { companyId: user.companyId },
            select: {
                id: true,
                customerPhone: true,
                customerName: true,
                createdAt: true,
                lastMessageAt: true,
                _count: {
                    select: { messages: true },
                },
            },
        });

        // Get orders for these customers
        const phones = [...new Set(conversations.map(c => c.customerPhone))];
        const orders = await prisma.order.findMany({
            where: {
                companyId: user.companyId,
                customerPhone: { in: phones },
            },
            select: {
                customerPhone: true,
                totalAmount: true,
                createdAt: true,
            },
        });

        // Get contact preferences (opted out status)
        const preferences = await prisma.contactPreference.findMany({
            where: { companyId: user.companyId },
            select: {
                phone: true,
                optedOut: true,
                segment: true,
            },
        });
        const prefMap = new Map(preferences.map(p => [p.phone, p]));

        // Aggregate by customer phone
        const customerMap = new Map<string, CustomerData>();

        for (const conv of conversations) {
            const phone = conv.customerPhone;
            const existing = customerMap.get(phone);

            // Get orders for this customer
            const customerOrders = orders.filter(o => o.customerPhone === phone);
            const totalSpent = customerOrders.reduce((sum, o) => sum + (o.totalAmount || 0), 0);
            const lastPurchaseAt = customerOrders.length > 0
                ? new Date(Math.max(...customerOrders.map(o => o.createdAt.getTime())))
                : null;

            // Get preference
            const pref = prefMap.get(phone);

            if (!existing) {
                customerMap.set(phone, {
                    id: conv.id,
                    phone,
                    name: conv.customerName || phone,
                    segment: calculateSegment(conv.lastMessageAt, lastPurchaseAt, customerOrders.length),
                    lastInteractionAt: conv.lastMessageAt,
                    lastPurchaseAt,
                    totalMessages: conv._count.messages,
                    totalOrders: customerOrders.length,
                    totalSpent,
                    firstContactAt: conv.createdAt,
                    optedOut: pref?.optedOut || false,
                });
            } else {
                // Merge data
                existing.totalMessages += conv._count.messages;
                if (conv.lastMessageAt && (!existing.lastInteractionAt || conv.lastMessageAt > existing.lastInteractionAt)) {
                    existing.lastInteractionAt = conv.lastMessageAt;
                }
                if (conv.createdAt < existing.firstContactAt) {
                    existing.firstContactAt = conv.createdAt;
                }
                existing.segment = calculateSegment(existing.lastInteractionAt, existing.lastPurchaseAt, existing.totalOrders);
            }
        }

        // Convert to array
        let customers = Array.from(customerMap.values());

        // Filter by segment
        if (segment && segment !== "all") {
            customers = customers.filter(c => c.segment === segment);
        }

        // Filter by tag (se phonesWithTag foi preenchido)
        if (phonesWithTag) {
            customers = customers.filter(c => phonesWithTag.has(c.phone));
        }

        // Filter by search
        if (search) {
            const searchLower = search.toLowerCase();
            customers = customers.filter(c =>
                c.name.toLowerCase().includes(searchLower) ||
                c.phone.includes(search)
            );
        }

        // Sort by segment priority, then by last interaction
        customers.sort((a, b) => {
            const segDiff = SEGMENT_ORDER[a.segment] - SEGMENT_ORDER[b.segment];
            if (segDiff !== 0) return segDiff;
            return (b.lastInteractionAt?.getTime() || 0) - (a.lastInteractionAt?.getTime() || 0);
        });

        // Count by segment (before pagination)
        const allCustomers = Array.from(customerMap.values());
        const segmentCounts = {
            VIP: allCustomers.filter(c => c.segment === "VIP").length,
            HOT: allCustomers.filter(c => c.segment === "HOT").length,
            WARM: allCustomers.filter(c => c.segment === "WARM").length,
            INACTIVE: allCustomers.filter(c => c.segment === "INACTIVE").length,
            COLD: allCustomers.filter(c => c.segment === "COLD").length,
        };

        // Pagination
        const total = customers.length;
        const totalPages = Math.ceil(total / limit);
        const startIndex = (page - 1) * limit;
        const endIndex = startIndex + limit;
        const paginatedCustomers = customers.slice(startIndex, endIndex);

        return NextResponse.json({
            success: true,
            data: paginatedCustomers,
            total,
            page,
            limit,
            totalPages,
            hasMore: page < totalPages,
            segmentCounts,
        });

    } catch (error) {
        logger.error("[Customers API] Error", { error, route: "/api/customers" });
        return NextResponse.json(
            { success: false, error: "Erro ao buscar clientes" },
            { status: 500 }
        );
    }
}
