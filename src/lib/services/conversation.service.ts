/**
 * Conversation Service
 * 
 * Encapsulates business logic for conversations.
 * Keeps API routes thin and focused on HTTP handling.
 */

import { prisma } from "../prisma";
import type { Prisma } from "@prisma/client";

interface ListConversationsOptions {
    limit?: number;
    offset?: number;
    status?: "OPEN" | "AI_HANDLING" | "HUMAN_HANDLING" | "WAITING_RESPONSE" | "CLOSED";
    search?: string;
}

export class ConversationService {
    /**
     * List conversations for a company with filters
     */
    static async list(companyId: string, options: ListConversationsOptions = {}) {
        const { limit = 50, offset = 0, status, search } = options;

        const where: Prisma.ConversationWhereInput = {
            companyId,
            ...(status && { status }),
            ...(search && {
                OR: [
                    { customerName: { contains: search, mode: "insensitive" as const } },
                    { customerPhone: { contains: search } },
                ],
            }),
        };

        const [conversations, total] = await Promise.all([
            prisma.conversation.findMany({
                where,
                include: {
                    agent: { select: { id: true, name: true } },
                    session: { select: { id: true, sessionName: true, phoneNumber: true } },
                    messages: {
                        orderBy: { createdAt: "desc" },
                        take: 1,
                    },
                    _count: { select: { messages: { where: { isRead: false, sender: "CUSTOMER" } } } },
                },
                orderBy: { lastMessageAt: "desc" },
                take: limit,
                skip: offset,
            }),
            prisma.conversation.count({ where }),
        ]);

        return { conversations, total, pages: Math.ceil(total / limit) };
    }

    /**
     * Get a single conversation with messages
     */
    static async getById(conversationId: string, companyId: string) {
        return prisma.conversation.findFirst({
            where: { id: conversationId, companyId },
            include: {
                agent: { select: { id: true, name: true } },
                session: { select: { id: true, sessionName: true, phoneNumber: true } },
                messages: {
                    orderBy: { createdAt: "asc" },
                    take: 100,
                },
            },
        });
    }

    /**
     * Mark all messages in a conversation as read
     */
    static async markAsRead(conversationId: string, companyId: string) {
        // First verify the conversation belongs to the company
        const conversation = await prisma.conversation.findFirst({
            where: { id: conversationId, companyId },
        });

        if (!conversation) return null;

        await prisma.message.updateMany({
            where: { conversationId, sender: "CUSTOMER", isRead: false },
            data: { isRead: true },
        });

        return { success: true };
    }

    /**
     * Close a conversation
     */
    static async close(conversationId: string, companyId: string) {
        return prisma.conversation.updateMany({
            where: { id: conversationId, companyId },
            data: { status: "CLOSED" },
        });
    }

    /**
     * Transfer conversation to human
     */
    static async transferToHuman(conversationId: string, companyId: string) {
        return prisma.conversation.updateMany({
            where: { id: conversationId, companyId },
            data: { status: "HUMAN_HANDLING" },
        });
    }

    /**
     * Get recent conversations for dashboard
     */
    static async getRecent(companyId: string, limit = 5) {
        return prisma.conversation.findMany({
            where: { companyId },
            select: {
                id: true,
                customerName: true,
                customerPhone: true,
                status: true,
                lastMessageAt: true,
                messages: {
                    orderBy: { createdAt: "desc" },
                    take: 1,
                    select: { content: true },
                },
                _count: { select: { messages: { where: { isRead: false, sender: "CUSTOMER" } } } },
            },
            orderBy: { lastMessageAt: "desc" },
            take: limit,
        });
    }

    /**
     * Get conversation statistics
     */
    static async getStats(companyId: string) {
        const [total, open, aiHandling, humanHandling, waitingResponse, closed] = await Promise.all([
            prisma.conversation.count({ where: { companyId } }),
            prisma.conversation.count({ where: { companyId, status: "OPEN" } }),
            prisma.conversation.count({ where: { companyId, status: "AI_HANDLING" } }),
            prisma.conversation.count({ where: { companyId, status: "HUMAN_HANDLING" } }),
            prisma.conversation.count({ where: { companyId, status: "WAITING_RESPONSE" } }),
            prisma.conversation.count({ where: { companyId, status: "CLOSED" } }),
        ]);

        return { total, open, aiHandling, humanHandling, waitingResponse, closed };
    }
}
