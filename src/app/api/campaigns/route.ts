/**
 * API: Campaigns
 * 
 * GET - List campaigns
 * POST - Create campaign with AI variations
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { generateMessageVariations } from "@/lib/message-variations";
import { logger } from "@/lib/logger";

/**
 * GET /api/campaigns - List all campaigns
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
        const status = searchParams.get("status");

        const where: Record<string, unknown> = { companyId: user.companyId };
        if (status && status !== "all") {
            where.status = status;
        }

        const campaigns = await prisma.campaign.findMany({
            where,
            orderBy: { createdAt: "desc" },
            include: {
                _count: {
                    select: { recipients: true },
                },
            },
        });

        // Calculate stats for each campaign
        const campaignsWithStats = campaigns.map(campaign => ({
            ...campaign,
            recipientCount: campaign._count.recipients,
            deliveryRate: campaign.sentCount > 0
                ? Math.round((campaign.deliveredCount / campaign.sentCount) * 100)
                : 0,
            readRate: campaign.deliveredCount > 0
                ? Math.round((campaign.readCount / campaign.deliveredCount) * 100)
                : 0,
            replyRate: campaign.readCount > 0
                ? Math.round((campaign.repliedCount / campaign.readCount) * 100)
                : 0,
        }));

        return NextResponse.json({
            success: true,
            data: campaignsWithStats,
        });
    } catch (error) {
        logger.error("[API Campaigns] GET error", { error, route: "/api/campaigns", method: "GET" });
        return NextResponse.json(
            { success: false, error: "Erro ao buscar campanhas" },
            { status: 500 }
        );
    }
}

/**
 * POST /api/campaigns - Create new campaign
 */
export async function POST(request: NextRequest) {
    try {
        const user = await getCurrentUser();
        if (!user || !user.companyId) {
            return NextResponse.json(
                { success: false, error: "Não autorizado" },
                { status: 401 }
            );
        }

        const body = await request.json();
        const {
            name,
            originalMessage,
            targetSegments,
            scheduledAt,
            settings,
            selectedPhones, // Manual contact selection
        } = body;

        if (!name || !originalMessage) {
            return NextResponse.json(
                { success: false, error: "Nome e mensagem são obrigatórios" },
                { status: 400 }
            );
        }

        // Validate selection limit (anti-ban)
        if (selectedPhones && selectedPhones.length > 100) {
            return NextResponse.json(
                { success: false, error: "Máximo de 100 contatos por campanha" },
                { status: 400 }
            );
        }

        // Get company name for AI context
        const company = await prisma.company.findUnique({
            where: { id: user.companyId },
            select: { name: true },
        });

        // Generate message variations using AI
        logger.info("[Campaigns] Generating AI variations...");
        const variations = await generateMessageVariations(
            originalMessage,
            company?.name || "Empresa"
        );
        logger.info(`[Campaigns] Generated ${variations.length} variations`);

        // Default settings with anti-ban protection (9s minimum delay)
        const defaultSettings = {
            minDelay: 9,  // Updated: 9 seconds minimum
            maxDelay: 25,
            pauseEvery: 15,
            pauseDuration: 60,
            dailyLimit: 100,
            simulateTyping: true,
            ...settings,
        };

        // Create campaign
        const campaign = await prisma.campaign.create({
            data: {
                companyId: user.companyId,
                name,
                originalMessage,
                variations,
                targetSegments: targetSegments || ["HOT", "WARM"],
                status: scheduledAt ? "SCHEDULED" : "DRAFT",
                scheduledAt: scheduledAt ? new Date(scheduledAt) : null,
                settings: defaultSettings,
            },
        });

        // Find eligible recipients
        // Use selectedPhones if provided, otherwise find by segments
        let eligibleContacts: { phone: string; name: string | null }[];

        if (selectedPhones && selectedPhones.length > 0) {
            // Manual selection - get names from conversations
            const conversations = await prisma.conversation.findMany({
                where: {
                    companyId: user.companyId,
                    customerPhone: { in: selectedPhones },
                },
                select: {
                    customerPhone: true,
                    customerName: true,
                },
                distinct: ["customerPhone"],
            });

            eligibleContacts = selectedPhones.map((phone: string) => {
                const conv = conversations.find(c => c.customerPhone === phone);
                return {
                    phone,
                    name: conv?.customerName || null,
                };
            });

            logger.info(`[Campaigns] Using ${eligibleContacts.length} manually selected contacts`);
        } else {
            // Automatic selection by segments
            eligibleContacts = await findEligibleRecipients(
                user.companyId,
                targetSegments || ["HOT", "WARM"]
            );
        }

        // Create campaign recipients
        if (eligibleContacts.length > 0) {
            await prisma.campaignRecipient.createMany({
                data: eligibleContacts.map((contact, index) => ({
                    campaignId: campaign.id,
                    phone: contact.phone,
                    contactName: contact.name,
                    variationIndex: index % variations.length,
                    status: "PENDING",
                })),
                skipDuplicates: true,
            });

            // Update campaign total
            await prisma.campaign.update({
                where: { id: campaign.id },
                data: { totalRecipients: eligibleContacts.length },
            });
        }

        return NextResponse.json({
            success: true,
            data: {
                ...campaign,
                variationsGenerated: variations.length,
                recipientsFound: eligibleContacts.length,
            },
        });
    } catch (error) {
        logger.error("[API Campaigns] POST error", { error, route: "/api/campaigns", method: "POST" });
        return NextResponse.json(
            { success: false, error: "Erro ao criar campanha" },
            { status: 500 }
        );
    }
}

/**
 * Find eligible recipients based on segments and safety rules
 */
async function findEligibleRecipients(
    companyId: string,
    segments: string[]
): Promise<{ phone: string; name: string | null }[]> {
    // Get conversations that had recent interaction
    const cutoffDates = {
        HOT: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // 30 days
        WARM: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000), // 60 days
        INACTIVE: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000), // 90 days
        COLD: new Date(Date.now() - 120 * 24 * 60 * 60 * 1000), // 120 days
    };

    // Start with most permissive date based on segments
    let minDate = new Date(0); // Very old date

    if (segments.includes("HOT")) {
        minDate = cutoffDates.HOT;
    } else if (segments.includes("WARM")) {
        minDate = cutoffDates.WARM;
    } else if (segments.includes("INACTIVE")) {
        minDate = cutoffDates.INACTIVE;
    } else if (segments.includes("COLD")) {
        minDate = cutoffDates.COLD;
    }

    // Find conversations with recent activity
    const conversations = await prisma.conversation.findMany({
        where: {
            companyId,
            lastMessageAt: { gte: minDate },
        },
        select: {
            customerPhone: true,
            customerName: true,
        },
        distinct: ["customerPhone"],
    });

    // Filter out opted-out contacts
    const optedOutPhones = await prisma.contactPreference.findMany({
        where: {
            companyId,
            optedOut: true,
        },
        select: { phone: true },
    });

    const optedOutSet = new Set(optedOutPhones.map(c => c.phone));

    // Return eligible contacts
    return conversations
        .filter(c => !optedOutSet.has(c.customerPhone))
        .map(c => ({
            phone: c.customerPhone,
            name: c.customerName,
        }));
}
