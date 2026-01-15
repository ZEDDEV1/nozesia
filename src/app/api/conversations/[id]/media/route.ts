import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { wppConnect } from "@/lib/wppconnect";
import { successResponse, errorResponse, handleApiError } from "@/lib/api-response";
import { logger } from "@/lib/logger";

interface RouteParams {
    params: Promise<{ id: string }>;
}

// POST - Send media (image or audio)
export async function POST(request: Request, { params }: RouteParams) {
    try {
        const user = await getCurrentUser();
        const { id } = await params;

        if (!user || !user.companyId) {
            return NextResponse.json(errorResponse("Não autorizado"), { status: 401 });
        }

        const conversation = await prisma.conversation.findFirst({
            where: { id, companyId: user.companyId },
            include: { session: true },
        });

        if (!conversation) {
            return NextResponse.json(errorResponse("Conversa não encontrada"), { status: 404 });
        }

        if (!conversation.session) {
            return NextResponse.json(errorResponse("Sessão WhatsApp não encontrada"), { status: 400 });
        }

        const body = await request.json();
        const { type, base64, caption } = body;

        if (!base64) {
            return NextResponse.json(errorResponse("Arquivo não fornecido"), { status: 400 });
        }

        // Get session name for WPPConnect
        const sessionName = `${user.companyId}_${conversation.session.sessionName}`.toLowerCase().replace(/\s/g, "_");

        // Format phone
        let phoneForWpp = conversation.customerPhone;
        if (!phoneForWpp.includes("@")) {
            phoneForWpp = phoneForWpp.replace(/\D/g, "") + "@c.us";
        }

        logger.info("[Media API] Sending", { type, to: phoneForWpp });

        let sent = false;
        let messageType = "TEXT";
        let content = "";

        if (type === "audio") {
            sent = await wppConnect.sendAudioMessage(sessionName, phoneForWpp, base64);
            messageType = "AUDIO";
            content = "[Áudio enviado]";
        } else if (type === "image") {
            sent = await wppConnect.sendImageMessage(sessionName, phoneForWpp, base64, caption);
            messageType = "IMAGE";
            content = caption || "[Imagem enviada]";
        } else if (type === "document") {
            // Get filename from body or use default
            const filename = body.filename || "document.pdf";
            sent = await wppConnect.sendFile(sessionName, phoneForWpp, `data:application/octet-stream;base64,${base64}`, filename);
            messageType = "DOCUMENT";
            content = caption || `[Documento: ${filename}]`;
        } else {
            return NextResponse.json(errorResponse("Tipo de mídia não suportado"), { status: 400 });
        }

        if (!sent) {
            return NextResponse.json(errorResponse("Erro ao enviar mídia"), { status: 500 });
        }

        // Save message in database
        const message = await prisma.message.create({
            data: {
                conversationId: id,
                type: messageType as "TEXT",
                content,
                sender: "HUMAN",
            },
        });

        // Update conversation
        await prisma.conversation.update({
            where: { id },
            data: {
                lastMessageAt: new Date(),
                status: "HUMAN_HANDLING",
            },
        });

        return NextResponse.json(successResponse(message, "Mídia enviada!"));
    } catch (error) {
        logger.error("[Media API] Error", { error, route: "/api/conversations/[id]/media" });
        return NextResponse.json(handleApiError(error), { status: 500 });
    }
}
