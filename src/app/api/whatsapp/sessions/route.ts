import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { successResponse, errorResponse, handleApiError } from "@/lib/api-response";
import { getCompanyPlanInfo, hasAccess } from "@/lib/plan-features";

// GET - List WhatsApp sessions
export async function GET() {
    try {
        const user = await getCurrentUser();

        if (!user || !user.companyId) {
            return NextResponse.json(errorResponse("Não autorizado"), { status: 401 });
        }

        const sessions = await prisma.whatsAppSession.findMany({
            where: { companyId: user.companyId },
            orderBy: { createdAt: "desc" },
        });

        return NextResponse.json(successResponse(sessions));
    } catch (error) {
        return NextResponse.json(handleApiError(error), { status: 500 });
    }
}

// POST - Create new WhatsApp session
export async function POST(request: Request) {
    try {
        const user = await getCurrentUser();

        if (!user || !user.companyId) {
            return NextResponse.json(errorResponse("Não autorizado"), { status: 401 });
        }

        // Check access (trial or subscription)
        const accessCheck = await hasAccess(user.companyId);
        if (!accessCheck.hasAccess) {
            return NextResponse.json(
                errorResponse("⏰ Seu período de acesso expirou. Assine um plano para continuar!"),
                { status: 403 }
            );
        }

        const body = await request.json();
        const { sessionName } = body;

        if (!sessionName || sessionName.length < 2) {
            return NextResponse.json(
                errorResponse("Nome da sessão deve ter pelo menos 2 caracteres"),
                { status: 400 }
            );
        }

        // Check session limit based on plan (works for trial and subscription)
        const planInfo = await getCompanyPlanInfo(user.companyId);
        const sessionCount = await prisma.whatsAppSession.count({
            where: { companyId: user.companyId },
        });

        if (sessionCount >= planInfo.limits.maxWhatsAppNumbers) {
            return NextResponse.json(
                errorResponse(`📱 Limite de ${planInfo.limits.maxWhatsAppNumbers} número(s) de WhatsApp atingido. Faça upgrade do plano ou adicione um extra por R$29,99/mês!`),
                { status: 403 }
            );
        }

        // Check if session name already exists
        const existing = await prisma.whatsAppSession.findFirst({
            where: { companyId: user.companyId, sessionName },
        });

        if (existing) {
            return NextResponse.json(
                errorResponse("Já existe uma sessão com este nome"),
                { status: 400 }
            );
        }

        const session = await prisma.whatsAppSession.create({
            data: {
                companyId: user.companyId,
                sessionName,
                status: "DISCONNECTED",
            },
        });

        // Create audit log
        await prisma.auditLog.create({
            data: {
                action: "CREATE_WHATSAPP_SESSION",
                entity: "WhatsAppSession",
                entityId: session.id,
                userEmail: user.email,
                companyId: user.companyId,
            },
        });

        return NextResponse.json(
            successResponse(session, "Sessão criada! Conecte via QR Code."),
            { status: 201 }
        );
    } catch (error) {
        return NextResponse.json(handleApiError(error), { status: 500 });
    }
}
