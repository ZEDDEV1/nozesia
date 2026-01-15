import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { wppConnect } from "@/lib/wppconnect";
import { successResponse, errorResponse, handleApiError } from "@/lib/api-response";
import { logger } from "@/lib/logger";

interface RouteParams {
    params: Promise<{ id: string }>;
}

// Helper to wait
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// POST - Start/Connect session
export async function POST(request: Request, { params }: RouteParams) {
    try {
        const user = await getCurrentUser();
        const { id } = await params;

        if (!user || !user.companyId) {
            return NextResponse.json(errorResponse("Não autorizado"), { status: 401 });
        }

        // Get session
        const session = await prisma.whatsAppSession.findFirst({
            where: { id, companyId: user.companyId },
        });

        if (!session) {
            return NextResponse.json(errorResponse("Sessão não encontrada"), { status: 404 });
        }

        // Update status to connecting
        await prisma.whatsAppSession.update({
            where: { id },
            data: { status: "CONNECTING" },
        });

        // Start session on WPPConnect
        const sessionName = `${user.companyId}_${session.sessionName}`.toLowerCase().replace(/\s/g, "_");

        logger.whatsapp("Starting session", { sessionName });

        // First, try to close any existing session to ensure clean start
        try {
            await wppConnect.closeSession(sessionName);
            logger.whatsapp("Closed existing session", { sessionName });
        } catch {
            // Ignore errors - session might not exist
        }

        // Use environment variable or localhost for webhook URL
        const webhookBaseUrl = process.env.WPPCONNECT_WEBHOOK_URL || "http://localhost:3000";
        const webhookUrl = `${webhookBaseUrl}/api/whatsapp/webhook`;
        logger.whatsapp("Webhook URL", { webhookUrl });

        const result = await wppConnect.startSession(sessionName, webhookUrl);

        if (!result) {
            await prisma.whatsAppSession.update({
                where: { id },
                data: { status: "ERROR" },
            });
            return NextResponse.json(
                errorResponse("Erro ao iniciar sessão no WPPConnect. Verifique se o servidor está rodando."),
                { status: 500 }
            );
        }

        logger.whatsapp("Start session result", { result });

        // Wait for QR Code to be generated (poll for up to 30 seconds)
        let qrCode: string | null = null;
        for (let i = 0; i < 15; i++) {
            await sleep(2000); // Wait 2 seconds

            // Check if already connected
            const status = await wppConnect.checkSessionStatus(sessionName);
            if (status?.connected) {
                await prisma.whatsAppSession.update({
                    where: { id },
                    data: {
                        status: "CONNECTED",
                        phoneNumber: status.phone || null,
                        qrCode: null,
                        lastSeenAt: new Date(),
                    },
                });

                return NextResponse.json(successResponse({
                    status: "CONNECTED",
                    phone: status.phone,
                }));
            }

            // Try to get QR code
            qrCode = await wppConnect.getQrCode(sessionName);
            if (qrCode && qrCode.startsWith("data:image")) {
                logger.whatsapp("QR Code obtained successfully");
                break;
            }

            logger.info(`[API] Waiting for QR Code... attempt ${i + 1}`);
        }

        if (qrCode && qrCode.startsWith("data:image")) {
            await prisma.whatsAppSession.update({
                where: { id },
                data: {
                    status: "QR_CODE",
                    qrCode,
                },
            });

            return NextResponse.json(successResponse({
                status: "QR_CODE",
                qrCode,
            }));
        }

        // Still initializing
        await prisma.whatsAppSession.update({
            where: { id },
            data: { status: "CONNECTING" },
        });

        return NextResponse.json(successResponse({
            status: "INITIALIZING",
            message: "Sessão está inicializando. Tente novamente em alguns segundos.",
        }));

    } catch (error) {
        logger.error("[API] Session connect error", { error, route: "/api/whatsapp/sessions/[id]/connect" });
        return NextResponse.json(handleApiError(error), { status: 500 });
    }
}

// GET - Get QR Code or status
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

        const sessionName = `${user.companyId}_${session.sessionName}`.toLowerCase().replace(/\s/g, "_");

        // Check status
        const status = await wppConnect.checkSessionStatus(sessionName);

        if (status?.connected) {
            await prisma.whatsAppSession.update({
                where: { id },
                data: {
                    status: "CONNECTED",
                    phoneNumber: status.phone || null,
                    qrCode: null,
                    lastSeenAt: new Date(),
                },
            });

            return NextResponse.json(successResponse({
                status: "CONNECTED",
                phone: status.phone,
            }));
        }

        // Try to get QR code from WPPConnect server (always fresh, never from database)
        const qrCode = await wppConnect.getQrCode(sessionName);

        if (qrCode && qrCode.startsWith("data:image")) {
            // Update database with fresh QR code
            await prisma.whatsAppSession.update({
                where: { id },
                data: {
                    status: "QR_CODE",
                    qrCode,
                },
            });

            return NextResponse.json(successResponse({
                status: "QR_CODE",
                qrCode,
            }));
        }

        // QR not available yet - return INITIALIZING status, NOT old database QR
        return NextResponse.json(successResponse({
            status: "INITIALIZING",
            message: "Aguardando QR Code...",
        }));
    } catch (error) {
        return NextResponse.json(handleApiError(error), { status: 500 });
    }
}

// DELETE - Disconnect/logout session
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

        const sessionName = `${user.companyId}_${session.sessionName}`.toLowerCase().replace(/\s/g, "_");

        // Logout from WPPConnect
        await wppConnect.logoutSession(sessionName);

        // Update database
        await prisma.whatsAppSession.update({
            where: { id },
            data: {
                status: "DISCONNECTED",
                phoneNumber: null,
                qrCode: null,
            },
        });

        return NextResponse.json(successResponse(null, "Sessão desconectada"));
    } catch (error) {
        return NextResponse.json(handleApiError(error), { status: 500 });
    }
}
