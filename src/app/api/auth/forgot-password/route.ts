/**
 * API de Solicitação de Reset de Senha
 * 
 * POST - Envia email com link para resetar senha
 */

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { successResponse, errorResponse } from "@/lib/api-response";
import { sendPasswordResetEmail } from "@/lib/email";
import { rateLimitMiddleware } from "@/lib/rate-limit";
import { logger } from "@/lib/logger";
import crypto from "crypto";
import { z } from "zod";

const forgotPasswordSchema = z.object({
    email: z.string().email("Email inválido"),
});

export async function POST(request: Request) {
    // Rate limiting - evitar spam
    const rateLimitResponse = await rateLimitMiddleware(request, 'auth');
    if (rateLimitResponse) {
        return rateLimitResponse;
    }

    try {
        const body = await request.json();
        const parsed = forgotPasswordSchema.safeParse(body);

        if (!parsed.success) {
            return NextResponse.json(
                errorResponse(parsed.error.issues[0].message),
                { status: 400 }
            );
        }

        const { email } = parsed.data;

        // Buscar usuário
        const user = await prisma.user.findUnique({
            where: { email },
        });

        // IMPORTANTE: Sempre retornar sucesso (não revelar se email existe)
        if (!user) {
            logger.auth("Password reset requested for non-existent email", { email });
            return NextResponse.json(
                successResponse(
                    { sent: true },
                    "Se o email existir, você receberá um link de recuperação."
                )
            );
        }

        // Invalidar tokens anteriores
        await prisma.verificationToken.updateMany({
            where: {
                userId: user.id,
                type: "PASSWORD_RESET",
                usedAt: null,
            },
            data: { usedAt: new Date() },
        });

        // Criar novo token
        const token = crypto.randomBytes(32).toString("hex");
        const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hora

        await prisma.verificationToken.create({
            data: {
                token,
                type: "PASSWORD_RESET",
                expiresAt,
                userId: user.id,
            },
        });

        // Enviar email
        const result = await sendPasswordResetEmail(user.email, user.name, token);

        if (!result.success) {
            logger.error("Failed to send password reset email", {
                userId: user.id,
                error: result.error
            });
        } else {
            logger.auth("Password reset email sent", { userId: user.id, email });
        }

        // Log de auditoria
        await prisma.auditLog.create({
            data: {
                action: "PASSWORD_RESET_REQUESTED",
                entity: "User",
                entityId: user.id,
                userEmail: user.email,
                companyId: user.companyId,
            },
        });

        return NextResponse.json(
            successResponse(
                { sent: true },
                "Se o email existir, você receberá um link de recuperação."
            )
        );

    } catch (error) {
        console.error("Error requesting password reset:", error);
        return NextResponse.json(
            errorResponse("Erro ao processar solicitação"),
            { status: 500 }
        );
    }
}
