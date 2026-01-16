import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { wppConnect } from "@/lib/wppconnect";
import { successResponse, errorResponse, handleApiError } from "@/lib/api-response";
import { logger } from "@/lib/logger";

interface RouteParams {
    params: Promise<{ id: string }>;
}

// GET - Get session details
export async function GET(request: Request, { params }: RouteParams) {
    try {
        const user = await getCurrentUser();
        const { id } = await params;

        if (!user || !user.companyId) {
            return NextResponse.json(errorResponse("Não autorizado"), { status: 401 });
        }

        const session = await prisma.whatsAppSession.findFirst({
            where: { id, companyId: user.companyId },
        });

        if (!session) {
            return NextResponse.json(errorResponse("Sessão não encontrada"), { status: 404 });
        }

        return NextResponse.json(successResponse(session));
    } catch (error) {
        return NextResponse.json(handleApiError(error), { status: 500 });
    }
}

// DELETE - Remove WhatsApp session completely
export async function DELETE(request: Request, { params }: RouteParams) {
    try {
        const user = await getCurrentUser();
        const { id } = await params;

        if (!user || !user.companyId) {
            return NextResponse.json(errorResponse("Não autorizado"), { status: 401 });
        }

        const session = await prisma.whatsAppSession.findFirst({
            where: { id, companyId: user.companyId },
        });

        if (!session) {
            return NextResponse.json(errorResponse("Sessão não encontrada"), { status: 404 });
        }

        // Try to close session on WPPConnect first
        try {
            const fullSessionName = `${user.companyId}_${session.sessionName}`.toLowerCase().replace(/\s/g, "_");
            await wppConnect.closeSession(fullSessionName);
            logger.info("[WhatsApp API] Session closed on WPPConnect", { sessionId: id });
        } catch (wppError) {
            // Don't fail if WPPConnect cleanup fails
            logger.warn("[WhatsApp API] Failed to close WPPConnect session", { error: wppError, sessionId: id });
        }

        // Delete related conversations and messages
        const conversations = await prisma.conversation.findMany({
            where: { sessionId: id },
            select: { id: true },
        });

        // Delete messages from these conversations
        if (conversations.length > 0) {
            const convIds = conversations.map(c => c.id);
            await prisma.message.deleteMany({
                where: { conversationId: { in: convIds } },
            });
            await prisma.order.deleteMany({
                where: { conversationId: { in: convIds } },
            });
            await prisma.customerInterest.deleteMany({
                where: { conversationId: { in: convIds } },
            });
            await prisma.conversation.deleteMany({
                where: { id: { in: convIds } },
            });
        }

        // Delete the session
        await prisma.whatsAppSession.delete({
            where: { id },
        });

        // Create audit log
        await prisma.auditLog.create({
            data: {
                action: "DELETE_WHATSAPP_SESSION",
                entity: "WhatsAppSession",
                entityId: id,
                userEmail: user.email,
                companyId: user.companyId,
            },
        });

        logger.info("[WhatsApp API] Session deleted", {
            sessionId: id,
            deletedBy: user.email,
            conversationsDeleted: conversations.length,
        });

        return NextResponse.json(successResponse({ deleted: true }, "Sessão excluída com sucesso!"));
    } catch (error) {
        logger.error("[WhatsApp API] Error deleting session", { error });
        return NextResponse.json(handleApiError(error), { status: 500 });
    }
}
