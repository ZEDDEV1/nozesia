/**
 * 2FA Verification API (for login)
 * 
 * POST: Verify 2FA code during login
 */

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { successResponse, errorResponse } from "@/lib/api-response";
import { verifyTwoFactorLogin } from "@/lib/two-factor";
import { sign } from "jsonwebtoken";
import { cookies } from "next/headers";
import { logger } from "@/lib/logger";

const JWT_SECRET = process.env.JWT_SECRET || process.env.NEXTAUTH_SECRET || "";

// POST - Verify 2FA code and complete login
export async function POST(request: Request) {
    try {
        const { userId, token } = await request.json();

        if (!userId || !token) {
            return NextResponse.json(
                errorResponse("User ID e código são obrigatórios"),
                { status: 400 }
            );
        }

        // Verify the 2FA token
        const isValid = await verifyTwoFactorLogin(userId, token);

        if (!isValid) {
            return NextResponse.json(
                errorResponse("Código inválido. Tente novamente."),
                { status: 400 }
            );
        }

        // Get user data
        const user = await prisma.user.findUnique({
            where: { id: userId },
            select: {
                id: true,
                email: true,
                name: true,
                role: true,
                companyId: true,
            },
        });

        if (!user) {
            return NextResponse.json(errorResponse("Usuário não encontrado"), { status: 404 });
        }

        // Update last login
        await prisma.user.update({
            where: { id: userId },
            data: { lastLoginAt: new Date() },
        });

        // Generate JWT token
        // Payload DEVE usar 'userId' para compatibilidade com middleware
        const jwtToken = sign(
            {
                userId: user.id,
                email: user.email,
                role: user.role,
                companyId: user.companyId,
            },
            JWT_SECRET,
            { expiresIn: "7d" }
        );

        // Set cookie
        const cookieStore = await cookies();
        cookieStore.set("auth-token", jwtToken, {
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",
            sameSite: "lax",
            maxAge: 7 * 24 * 60 * 60, // 7 days
            path: "/",
        });

        return NextResponse.json(
            successResponse({
                message: "Login com 2FA realizado com sucesso",
                user: {
                    id: user.id,
                    email: user.email,
                    name: user.name,
                    role: user.role,
                },
            })
        );
    } catch (error) {
        logger.error("[2FA] Verify error:", { error });
        return NextResponse.json(errorResponse("Erro na verificação 2FA"), { status: 500 });
    }
}
