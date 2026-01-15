/**
 * API de Verificação de Email
 * 
 * POST - Verifica o email usando o token
 */

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { successResponse, errorResponse } from "@/lib/api-response";
import { sendWelcomeEmail } from "@/lib/email";
import { logger } from "@/lib/logger";

export async function POST(request: Request) {
    try {
        const { token } = await request.json();

        if (!token) {
            return NextResponse.json(
                errorResponse("Token de verificação é obrigatório"),
                { status: 400 }
            );
        }

        // Buscar token válido
        const verificationToken = await prisma.verificationToken.findUnique({
            where: { token },
            include: { user: true },
        });

        if (!verificationToken) {
            logger.auth("Invalid verification token", { token: token.substring(0, 10) + "..." });
            return NextResponse.json(
                errorResponse("Token inválido ou expirado"),
                { status: 400 }
            );
        }

        // Verificar se já foi usado
        if (verificationToken.usedAt) {
            return NextResponse.json(
                errorResponse("Este link já foi utilizado"),
                { status: 400 }
            );
        }

        // Verificar se expirou
        if (new Date() > verificationToken.expiresAt) {
            logger.auth("Expired verification token", { userId: verificationToken.userId });
            return NextResponse.json(
                errorResponse("Token expirado. Solicite um novo email de verificação."),
                { status: 400 }
            );
        }

        // Verificar tipo
        if (verificationToken.type !== "EMAIL_VERIFICATION") {
            return NextResponse.json(
                errorResponse("Token inválido para esta operação"),
                { status: 400 }
            );
        }

        // Atualizar usuário como verificado
        await prisma.user.update({
            where: { id: verificationToken.userId },
            data: {
                emailVerified: true,
                emailVerifiedAt: new Date(),
            },
        });

        // Marcar token como usado
        await prisma.verificationToken.update({
            where: { id: verificationToken.id },
            data: { usedAt: new Date() },
        });

        // Ativar empresa se estava pendente
        if (verificationToken.user.companyId) {
            await prisma.company.update({
                where: { id: verificationToken.user.companyId },
                data: { status: "ACTIVE" },
            });
        }

        logger.auth("Email verified successfully", {
            userId: verificationToken.userId,
            email: verificationToken.user.email
        });

        // Enviar email de boas-vindas
        await sendWelcomeEmail(
            verificationToken.user.email,
            verificationToken.user.name
        );

        // Log de auditoria
        await prisma.auditLog.create({
            data: {
                action: "EMAIL_VERIFIED",
                entity: "User",
                entityId: verificationToken.userId,
                userEmail: verificationToken.user.email,
                companyId: verificationToken.user.companyId,
            },
        });

        return NextResponse.json(
            successResponse(
                { verified: true },
                "Email verificado com sucesso! Bem-vindo ao NozesIA!"
            )
        );

    } catch (error) {
        console.error("Error verifying email:", error);
        return NextResponse.json(
            errorResponse("Erro ao verificar email"),
            { status: 500 }
        );
    }
}
