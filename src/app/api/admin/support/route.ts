import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { successResponse, errorResponse, handleApiError } from "@/lib/api-response";
import { logger } from "@/lib/logger";

// GET - List all support tickets (admin only)
export async function GET() {
    try {
        const user = await getCurrentUser();
        if (!user || user.role !== "SUPER_ADMIN") {
            return NextResponse.json(errorResponse("Não autorizado"), { status: 403 });
        }

        const tickets = await prisma.supportTicket.findMany({
            orderBy: [
                { priority: "desc" },
                { updatedAt: "desc" },
            ],
            include: {
                company: { select: { name: true } },
                user: { select: { name: true, email: true } },
                messages: {
                    orderBy: { createdAt: "asc" },
                },
                _count: { select: { messages: true } },
            },
        });

        return NextResponse.json(successResponse(tickets));
    } catch (error) {
        logger.error("[AdminSupport] Failed to list tickets", { error });
        return NextResponse.json(handleApiError(error), { status: 500 });
    }
}

// POST - Send admin reply to ticket
export async function POST(request: Request) {
    try {
        const user = await getCurrentUser();
        if (!user || user.role !== "SUPER_ADMIN") {
            return NextResponse.json(errorResponse("Não autorizado"), { status: 403 });
        }

        const { ticketId, message } = await request.json();

        if (!ticketId || !message?.trim()) {
            return NextResponse.json(errorResponse("Dados inválidos"), { status: 400 });
        }

        // Add admin message
        await prisma.supportMessage.create({
            data: {
                ticketId,
                sender: "ADMIN",
                content: message.trim(),
            },
        });

        // Update ticket status
        const ticket = await prisma.supportTicket.update({
            where: { id: ticketId },
            data: {
                status: "WAITING_USER",
                assignedToId: user.id,
            },
            include: {
                company: { select: { name: true } },
                user: { select: { name: true, email: true } },
                messages: { orderBy: { createdAt: "asc" } },
            },
        });

        logger.info("[AdminSupport] Admin replied to ticket", {
            ticketId,
            adminId: user.id,
        });

        return NextResponse.json(successResponse(ticket));
    } catch (error) {
        logger.error("[AdminSupport] Failed to reply", { error });
        return NextResponse.json(handleApiError(error), { status: 500 });
    }
}

// PATCH - Update ticket status
export async function PATCH(request: Request) {
    try {
        const user = await getCurrentUser();
        if (!user || user.role !== "SUPER_ADMIN") {
            return NextResponse.json(errorResponse("Não autorizado"), { status: 403 });
        }

        const { ticketId, status, priority } = await request.json();

        if (!ticketId) {
            return NextResponse.json(errorResponse("ID do ticket obrigatório"), { status: 400 });
        }

        const updateData: Record<string, unknown> = {};

        if (status) {
            updateData.status = status;
            if (status === "RESOLVED") {
                updateData.resolvedAt = new Date();
            }
        }

        if (priority) {
            updateData.priority = priority;
        }

        const ticket = await prisma.supportTicket.update({
            where: { id: ticketId },
            data: updateData,
            include: {
                company: { select: { name: true } },
                user: { select: { name: true, email: true } },
            },
        });

        logger.info("[AdminSupport] Ticket updated", {
            ticketId,
            status,
            priority,
        });

        return NextResponse.json(successResponse(ticket));
    } catch (error) {
        logger.error("[AdminSupport] Failed to update ticket", { error });
        return NextResponse.json(handleApiError(error), { status: 500 });
    }
}
