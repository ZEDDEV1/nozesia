/**
 * API: Customer Profile (CRM)
 * 
 * GET /api/customers/[phone] - Get detailed customer profile
 * PATCH /api/customers/[phone] - Update customer notes/tags
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { logger } from "@/lib/logger";

interface RouteParams {
    params: Promise<{ phone: string }>;
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

    if (totalOrders >= 5) return "VIP";
    if (daysSincePurchase <= 30) return "HOT";
    if (daysSinceInteraction <= 30) return "WARM";
    if (daysSinceInteraction <= 60) return "INACTIVE";
    return "COLD";
}

/**
 * Parse notes from preferences JSON
 */
function _extractNotes(preferencesJson: string | null): string | null {
    if (!preferencesJson) return null;
    try {
        const parsed = JSON.parse(preferencesJson);
        return parsed.notes || null;
    } catch {
        return null;
    }
}

/**
 * GET /api/customers/[phone] - Get customer profile
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
    try {
        const user = await getCurrentUser();
        if (!user || !user.companyId) {
            return NextResponse.json(
                { success: false, error: "Não autorizado" },
                { status: 401 }
            );
        }

        const { phone } = await params;
        const normalizedPhone = phone.replace(/\D/g, "");

        // Get all conversations with this customer
        const conversations = await prisma.conversation.findMany({
            where: {
                companyId: user.companyId,
                customerPhone: normalizedPhone,
            },
            select: {
                id: true,
                customerName: true,
                status: true,
                createdAt: true,
                lastMessageAt: true,
                _count: {
                    select: { messages: true },
                },
                messages: {
                    take: 1,
                    orderBy: { createdAt: "desc" },
                    select: {
                        content: true,
                        sender: true,
                        createdAt: true,
                    },
                },
            },
            orderBy: { lastMessageAt: "desc" },
        });

        if (conversations.length === 0) {
            return NextResponse.json(
                { success: false, error: "Cliente não encontrado" },
                { status: 404 }
            );
        }

        // Get orders
        const orders = await prisma.order.findMany({
            where: {
                companyId: user.companyId,
                customerPhone: normalizedPhone,
            },
            select: {
                id: true,
                productName: true,
                productPrice: true,
                quantity: true,
                totalAmount: true,
                status: true,
                createdAt: true,
                deliveryType: true,
            },
            orderBy: { createdAt: "desc" },
        });

        // Get interests
        const interests = await prisma.customerInterest.findMany({
            where: {
                companyId: user.companyId,
                customerPhone: normalizedPhone,
            },
            select: {
                id: true,
                productName: true,
                details: true,
                status: true,
                createdAt: true,
            },
            orderBy: { createdAt: "desc" },
        });

        // Get customer memory
        const memory = await prisma.customerMemory.findUnique({
            where: {
                companyId_customerPhone: {
                    companyId: user.companyId,
                    customerPhone: normalizedPhone,
                },
            },
        });

        // Get contact preference
        const preference = await prisma.contactPreference.findUnique({
            where: {
                companyId_phone: {
                    companyId: user.companyId,
                    phone: normalizedPhone,
                },
            },
        });

        // Calculate stats
        const totalMessages = conversations.reduce((sum, c) => sum + c._count.messages, 0);
        const totalSpent = orders.reduce((sum, o) => sum + (o.totalAmount || 0), 0);
        const lastPurchaseAt = orders.length > 0 ? orders[0].createdAt : null;
        const lastInteractionAt = conversations[0]?.lastMessageAt || null;
        const firstContactAt = conversations.reduce(
            (oldest, c) => (c.createdAt < oldest ? c.createdAt : oldest),
            conversations[0].createdAt
        );

        // Determine segment
        const segment = calculateSegment(lastInteractionAt, lastPurchaseAt, orders.length);

        // Get customer name (most recent non-null)
        const customerName = conversations.find(c => c.customerName)?.customerName || normalizedPhone;

        // Parse memory data
        const tags = memory?.tags ? memory.tags.split(",").map(t => t.trim()).filter(Boolean) : [];
        let preferences = null;
        let notes = null;
        try {
            if (memory?.preferences) {
                const parsed = JSON.parse(memory.preferences);
                notes = parsed.notes || null;
                // Remove notes from preferences to avoid duplication
                delete parsed.notes;
                if (Object.keys(parsed).length > 0) {
                    preferences = parsed;
                }
            }
        } catch {
            // Ignore parse errors
        }
        const lastProducts = memory?.lastProducts ? JSON.parse(memory.lastProducts) : null;

        // Build timeline (chronological events)
        const timeline = [
            ...conversations.map(c => ({
                type: "conversation" as const,
                id: c.id,
                date: c.createdAt,
                title: "Conversa iniciada",
                subtitle: `${c._count.messages} mensagens`,
                status: c.status,
            })),
            ...orders.map(o => ({
                type: "order" as const,
                id: o.id,
                date: o.createdAt,
                title: `Pedido: ${o.productName}`,
                subtitle: `R$ ${o.totalAmount?.toFixed(2) || "0.00"}`,
                status: o.status,
            })),
            ...interests.map(i => ({
                type: "interest" as const,
                id: i.id,
                date: i.createdAt,
                title: `Interesse: ${i.productName}`,
                subtitle: i.details || "Sem detalhes",
                status: i.status,
            })),
        ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

        return NextResponse.json({
            success: true,
            data: {
                // Basic info
                phone: normalizedPhone,
                name: customerName,
                segment,
                tags,
                optedOut: preference?.optedOut || false,

                // Stats
                stats: {
                    totalConversations: conversations.length,
                    totalMessages,
                    totalOrders: orders.length,
                    totalInterests: interests.length,
                    totalSpent,
                    firstContactAt,
                    lastInteractionAt,
                    lastPurchaseAt,
                },

                // Memory
                memory: {
                    summary: memory?.summary || null,
                    preferences,
                    lastProducts,
                    notes,
                },

                // Lists
                conversations: conversations.map(c => ({
                    id: c.id,
                    status: c.status,
                    messageCount: c._count.messages,
                    lastMessageAt: c.lastMessageAt,
                    lastMessage: c.messages[0] || null,
                    createdAt: c.createdAt,
                })),
                orders,
                interests,
                timeline: timeline.slice(0, 20), // Last 20 events
            },
        });

    } catch (error) {
        logger.error("[Customer Profile API] GET error", { error, route: "/api/customers/[phone]", method: "GET" });
        return NextResponse.json(
            { success: false, error: "Erro ao buscar perfil do cliente" },
            { status: 500 }
        );
    }
}

/**
 * PATCH /api/customers/[phone] - Update customer notes/tags
 */
export async function PATCH(request: NextRequest, { params }: RouteParams) {
    try {
        const user = await getCurrentUser();
        if (!user || !user.companyId) {
            return NextResponse.json(
                { success: false, error: "Não autorizado" },
                { status: 401 }
            );
        }

        const { phone } = await params;
        const normalizedPhone = phone.replace(/\D/g, "");
        const body = await request.json();
        const { notes, tags } = body;

        // Get existing memory
        const existingMemory = await prisma.customerMemory.findUnique({
            where: {
                companyId_customerPhone: {
                    companyId: user.companyId,
                    customerPhone: normalizedPhone,
                },
            },
        });

        // Build updated preferences with notes
        let updatedPreferences = {};
        try {
            if (existingMemory?.preferences) {
                updatedPreferences = JSON.parse(existingMemory.preferences);
            }
        } catch {
            // Ignore parse errors
        }

        if (notes !== undefined) {
            updatedPreferences = { ...updatedPreferences, notes };
        }

        // Prepare update data
        const updateData: { preferences?: string; tags?: string } = {};

        if (notes !== undefined) {
            updateData.preferences = JSON.stringify(updatedPreferences);
        }

        if (tags !== undefined) {
            updateData.tags = Array.isArray(tags) ? tags.join(",") : tags;
        }

        // Update or create customer memory
        if (Object.keys(updateData).length > 0) {
            await prisma.customerMemory.upsert({
                where: {
                    companyId_customerPhone: {
                        companyId: user.companyId,
                        customerPhone: normalizedPhone,
                    },
                },
                update: updateData,
                create: {
                    companyId: user.companyId,
                    customerPhone: normalizedPhone,
                    summary: "Cliente atualizado manualmente",
                    ...updateData,
                },
            });
        }

        return NextResponse.json({
            success: true,
            message: "Cliente atualizado!",
        });

    } catch (error) {
        logger.error("[Customer Profile API] PATCH error", { error, route: "/api/customers/[phone]", method: "PATCH" });
        return NextResponse.json(
            { success: false, error: "Erro ao atualizar cliente" },
            { status: 500 }
        );
    }
}

