/**
 * API: Campaign Preview Contacts
 * 
 * GET /api/campaigns/preview-contacts?segments=HOT,WARM
 * Returns contacts eligible for each segment for preview/selection
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

interface SegmentContact {
    phone: string;
    name: string | null;
    lastMessageAt: Date | null;
    messageCount: number;
    segment: string;
}

// Segment date ranges (referenced in documentation)
const _SEGMENT_RANGES = {
    HOT: 30,      // Last 30 days
    WARM: 60,     // 31-60 days
    INACTIVE: 90, // 61-90 days
    COLD: 120,    // 91-120 days
    VIP: 0,       // Special handling
};

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
        const segmentsParam = searchParams.get("segments") || "HOT,WARM";
        const segments = segmentsParam.split(",").filter(Boolean);

        const now = new Date();
        const contacts: SegmentContact[] = [];

        // Get opted-out phones to exclude
        const optedOutPhones = await prisma.contactPreference.findMany({
            where: { companyId: user.companyId, optedOut: true },
            select: { phone: true },
        });
        const optedOutSet = new Set(optedOutPhones.map(p => p.phone));

        for (const segment of segments) {
            let minDate: Date;
            let maxDate: Date | null = null;

            switch (segment) {
                case "HOT":
                    minDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
                    break;
                case "WARM":
                    minDate = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);
                    maxDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
                    break;
                case "INACTIVE":
                    minDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
                    maxDate = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);
                    break;
                case "COLD":
                    minDate = new Date(now.getTime() - 120 * 24 * 60 * 60 * 1000);
                    maxDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
                    break;
                case "VIP":
                    // VIP = has orders or high message count
                    minDate = new Date(0);
                    break;
                default:
                    continue;
            }

            const whereClause: Record<string, unknown> = {
                companyId: user.companyId,
                lastMessageAt: {
                    gte: minDate,
                    ...(maxDate ? { lt: maxDate } : {}),
                },
            };

            const conversations = await prisma.conversation.findMany({
                where: whereClause,
                select: {
                    customerPhone: true,
                    customerName: true,
                    lastMessageAt: true,
                    _count: {
                        select: { messages: true },
                    },
                },
                distinct: ["customerPhone"],
                orderBy: { lastMessageAt: "desc" },
                take: 200, // Limit per segment
            });

            for (const conv of conversations) {
                if (!optedOutSet.has(conv.customerPhone)) {
                    // Check if already added from another segment
                    if (!contacts.find(c => c.phone === conv.customerPhone)) {
                        contacts.push({
                            phone: conv.customerPhone,
                            name: conv.customerName,
                            lastMessageAt: conv.lastMessageAt,
                            messageCount: conv._count.messages,
                            segment,
                        });
                    }
                }
            }
        }

        // Group by segment for easy UI display
        const grouped = segments.reduce((acc, seg) => {
            acc[seg] = contacts.filter(c => c.segment === seg);
            return acc;
        }, {} as Record<string, SegmentContact[]>);

        return NextResponse.json({
            success: true,
            data: {
                contacts,
                grouped,
                total: contacts.length,
                bySegment: segments.reduce((acc, seg) => {
                    acc[seg] = (grouped[seg] || []).length;
                    return acc;
                }, {} as Record<string, number>),
            },
        });
    } catch (error) {
        console.error("Preview contacts error:", error);
        return NextResponse.json(
            { success: false, error: "Erro ao buscar contatos" },
            { status: 500 }
        );
    }
}
