/**
 * API de Reset de Senha
 * 
 * POST - Reseta a senha usando o token
 */

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/auth";
import { successResponse, errorResponse } from "@/lib/api-response";
import { logger } from "@/lib/logger";
import { z } from "zod";

const resetPasswordSchema = z.object({
    token: z.string().min(1, "Token é obrigatório"),
    password: z.string().min(6, "Senha deve ter no mínimo 6 caracteres"),
    confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
    message: "As senhas não coincidem",
    path: ["confirmPassword"],
});

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const parsed = resetPasswordSchema.safeParse(body);

        if (!parsed.success) {
            return NextResponse.json(
                errorResponse(parsed.error.issues[0].message),
                { status: 400 }
            );
        }

        const { token, password } = parsed.data;

        // Buscar token válido
        const verificationToken = await prisma.verificationToken.findUnique({
            where: { token },
            include: { user: true },
        });

        if (!verificationToken) {
            logger.auth("Invalid password reset token", { token: token.substring(0, 10) + "..." });
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
            logger.auth("Expired password reset token", { userId: verificationToken.userId });
            return NextResponse.json(
                errorResponse("Token expirado. Solicite um novo link de recuperação."),
                { status: 400 }
            );
        }

        // Verificar tipo
        if (verificationToken.type !== "PASSWORD_RESET") {
            return NextResponse.json(
                errorResponse("Token inválido para esta operação"),
                { status: 400 }
            );
        }

        // Atualizar senha
        const hashedPassword = await hashPassword(password);

        await prisma.user.update({
            where: { id: verificationToken.userId },
            data: { password: hashedPassword },
        });

        // Marcar token como usado
        await prisma.verificationToken.update({
            where: { id: verificationToken.id },
            data: { usedAt: new Date() },
        });

        logger.auth("Password reset successfully", {
            userId: verificationToken.userId,
            email: verificationToken.user.email
        });

        // Log de auditoria
        await prisma.auditLog.create({
            data: {
                action: "PASSWORD_RESET_COMPLETED",
                entity: "User",
                entityId: verificationToken.userId,
                userEmail: verificationToken.user.email,
                companyId: verificationToken.user.companyId,
            },
        });

        return NextResponse.json(
            successResponse(
                { reset: true },
                "Senha alterada com sucesso! Faça login com sua nova senha."
            )
        );

    } catch (error) {
        console.error("Error resetting password:", error);
        return NextResponse.json(
            errorResponse("Erro ao redefinir senha"),
            { status: 500 }
        );
    }
}
