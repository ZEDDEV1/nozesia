/**
 * API de Reenvio de Email de Verificação
 * 
 * POST - Reenvia o email de verificação
 */

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { successResponse, errorResponse } from "@/lib/api-response";
import { sendVerificationEmail } from "@/lib/email";
import { rateLimitMiddleware } from "@/lib/rate-limit";
import { logger } from "@/lib/logger";
import crypto from "crypto";

export async function POST(request: Request) {
    // Rate limiting - evitar spam
    const rateLimitResponse = await rateLimitMiddleware(request, 'auth');
    if (rateLimitResponse) {
        return rateLimitResponse;
    }

    try {
        const user = await getCurrentUser();

        if (!user) {
            return NextResponse.json(
                errorResponse("Não autorizado"),
                { status: 401 }
            );
        }

        // Verificar se já está verificado
        if (user.emailVerified) {
            return NextResponse.json(
                errorResponse("Seu email já está verificado"),
                { status: 400 }
            );
        }

        // Verificar se já tem um token recente (últimos 2 minutos)
        const recentToken = await prisma.verificationToken.findFirst({
            where: {
                userId: user.id,
                type: "EMAIL_VERIFICATION",
                createdAt: {
                    gte: new Date(Date.now() - 2 * 60 * 1000), // 2 minutos
                },
            },
        });

        if (recentToken) {
            return NextResponse.json(
                errorResponse("Aguarde 2 minutos antes de solicitar outro email"),
                { status: 429 }
            );
        }

        // Invalidar tokens anteriores
        await prisma.verificationToken.updateMany({
            where: {
                userId: user.id,
                type: "EMAIL_VERIFICATION",
                usedAt: null,
            },
            data: { usedAt: new Date() },
        });

        // Criar novo token
        const token = crypto.randomBytes(32).toString("hex");
        const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 horas

        await prisma.verificationToken.create({
            data: {
                token,
                type: "EMAIL_VERIFICATION",
                expiresAt,
                userId: user.id,
            },
        });

        // Enviar email
        const result = await sendVerificationEmail(user.email, user.name, token);

        if (!result.success) {
            logger.error("Failed to send verification email", {
                userId: user.id,
                error: result.error
            });
            return NextResponse.json(
                errorResponse("Erro ao enviar email. Tente novamente."),
                { status: 500 }
            );
        }

        logger.auth("Verification email resent", { userId: user.id, email: user.email });

        return NextResponse.json(
            successResponse(
                { sent: true },
                "Email de verificação enviado! Verifique sua caixa de entrada."
            )
        );

    } catch (error) {
        console.error("Error resending verification email:", error);
        return NextResponse.json(
            errorResponse("Erro ao enviar email"),
            { status: 500 }
        );
    }
}
