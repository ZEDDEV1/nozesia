import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { wppConnect } from "@/lib/wppconnect";
import { successResponse, errorResponse, handleApiError } from "@/lib/api-response";
import { parseCursorParams, getPrismaCursorParams, formatCursorPaginatedResponse } from "@/lib/pagination";
import { dispatchWebhook } from "@/lib/webhooks";
import { logger } from "@/lib/logger";

interface RouteParams {
    params: Promise<{ id: string }>;
}

// GET - Get conversation with messages (paginated)
export async function GET(request: Request, { params }: RouteParams) {
    try {
        const user = await getCurrentUser();
        const { id } = await params;

        if (!user || !user.companyId) {
            return NextResponse.json(errorResponse("Não autorizado"), { status: 401 });
        }

        const { searchParams } = new URL(request.url);
        const { cursor, limit } = parseCursorParams(searchParams);
        const cursorParams = getPrismaCursorParams(cursor, limit);

        const conversation = await prisma.conversation.findFirst({
            where: { id, companyId: user.companyId },
            include: {
                agent: {
                    select: { id: true, name: true },
                },
                session: {
                    select: { id: true, sessionName: true, phoneNumber: true },
                },
            },
        });

        if (!conversation) {
            return NextResponse.json(errorResponse("Conversa não encontrada"), { status: 404 });
        }

        // Buscar mensagens paginadas (ordem inversa para cursor funcionar corretamente)
        const messages = await prisma.message.findMany({
            where: { conversationId: id },
            orderBy: { createdAt: "desc" },
            ...cursorParams,
            select: {
                id: true,
                content: true,
                sender: true,
                type: true,
                createdAt: true,
                isRead: true,
                mediaUrl: true,
            },
        });

        // Reverter para ordem cronológica
        const paginatedMessages = formatCursorPaginatedResponse(messages, limit);
        paginatedMessages.data = paginatedMessages.data.reverse();

        // Mark messages as read
        await prisma.message.updateMany({
            where: { conversationId: id, isRead: false },
            data: { isRead: true },
        });

        await prisma.conversation.update({
            where: { id },
            data: { unreadCount: 0 },
        });

        return NextResponse.json(successResponse({
            ...conversation,
            messages: paginatedMessages.data,
            pagination: paginatedMessages.pagination,
        }));
    } catch (error) {
        return NextResponse.json(handleApiError(error), { status: 500 });
    }
}

// PUT - Update conversation (transfer to human, close, etc.)
export async function PUT(request: Request, { params }: RouteParams) {
    try {
        const user = await getCurrentUser();
        const { id } = await params;

        if (!user || !user.companyId) {
            return NextResponse.json(errorResponse("Não autorizado"), { status: 401 });
        }

        const conversation = await prisma.conversation.findFirst({
            where: { id, companyId: user.companyId },
        });

        if (!conversation) {
            return NextResponse.json(errorResponse("Conversa não encontrada"), { status: 404 });
        }

        const body = await request.json();
        const { status, agentId } = body;

        const updateData: Record<string, unknown> = {};

        if (status) {
            updateData.status = status;
        }

        if (agentId !== undefined) {
            updateData.agentId = agentId;
        }

        const updated = await prisma.conversation.update({
            where: { id },
            data: updateData,
        });

        // Dispatch CONVERSATION_CLOSED webhook if status is CLOSED
        if (status === "CLOSED") {
            dispatchWebhook(user.companyId, "CONVERSATION_CLOSED", {
                conversationId: id,
                customerPhone: conversation.customerPhone,
                customerName: conversation.customerName,
                closedBy: user.email,
                timestamp: new Date().toISOString(),
            }).catch((err) => logger.error("[Webhook] CONVERSATION_CLOSED failed", { error: err }));
        }

        return NextResponse.json(successResponse(updated));
    } catch (error) {
        return NextResponse.json(handleApiError(error), { status: 500 });
    }
}

// POST - Send message in conversation
export async function POST(request: Request, { params }: RouteParams) {
    try {
        const user = await getCurrentUser();
        const { id } = await params;

        if (!user || !user.companyId) {
            return NextResponse.json(errorResponse("Não autorizado"), { status: 401 });
        }

        const conversation = await prisma.conversation.findFirst({
            where: { id, companyId: user.companyId },
            include: {
                session: true,
            },
        });

        if (!conversation) {
            return NextResponse.json(errorResponse("Conversa não encontrada"), { status: 404 });
        }

        if (!conversation.session) {
            return NextResponse.json(errorResponse("Sessão WhatsApp não encontrada"), { status: 400 });
        }

        const body = await request.json();
        const { content } = body;

        if (!content || content.trim() === "") {
            return NextResponse.json(errorResponse("Mensagem não pode estar vazia"), { status: 400 });
        }

        // Get session name for WPPConnect
        const sessionName = `${user.companyId}_${conversation.session.sessionName}`.toLowerCase().replace(/\s/g, "_");

        // Use o ID original do WhatsApp se disponível, senão construa com @c.us
        let phoneForWpp = conversation.customerWhatsAppId;
        if (!phoneForWpp) {
            // Fallback: construir com @c.us
            phoneForWpp = conversation.customerPhone.replace(/\D/g, "") + "@c.us";
        }

        logger.info("[Conversations API] Sending message", { to: phoneForWpp, session: sessionName });

        // Check if session is connected before sending
        try {
            const sessionStatus = await wppConnect.checkSessionStatus(sessionName);
            if (!sessionStatus?.connected) {
                logger.warn("[Conversations API] Session not connected", { sessionName, status: sessionStatus });
                return NextResponse.json(
                    errorResponse("Sessão WhatsApp não está conectada. Reconecte pelo painel de WhatsApp."),
                    { status: 400 }
                );
            }
        } catch (statusError) {
            logger.error("[Conversations API] Failed to check session status", { error: statusError });
            // Continue anyway - might be a temporary network error
        }

        // Send message via WPPConnect
        let sent = false;
        try {
            sent = await wppConnect.sendTextMessage(sessionName, phoneForWpp, content);
        } catch (sendError) {
            logger.error("[Conversations API] WPPConnect sendTextMessage error", { error: sendError });
            return NextResponse.json(
                errorResponse("Erro ao conectar com servidor WhatsApp. Verifique se o wppconnect-server está rodando."),
                { status: 500 }
            );
        }

        if (!sent) {
            return NextResponse.json(errorResponse("Erro ao enviar mensagem pelo WhatsApp"), { status: 500 });
        }

        // Save message in database
        const message = await prisma.message.create({
            data: {
                conversationId: id,
                type: "TEXT",
                content,
                sender: "HUMAN",
            },
        });

        // Update conversation
        await prisma.conversation.update({
            where: { id },
            data: {
                lastMessageAt: new Date(),
                status: "HUMAN_HANDLING", // When human sends, take over
            },
        });

        return NextResponse.json(successResponse(message, "Mensagem enviada!"));
    } catch (error) {
        return NextResponse.json(handleApiError(error), { status: 500 });
    }
}
