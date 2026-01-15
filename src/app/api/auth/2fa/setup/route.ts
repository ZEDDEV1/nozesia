/**
 * 2FA Setup API
 * 
 * POST: Generate secret and QR code for setup
 * PUT: Verify code and enable 2FA
 * DELETE: Disable 2FA
 */

import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { successResponse, errorResponse } from "@/lib/api-response";
import {
    generateTwoFactorSecret,
    generateQRCode,
    enableTwoFactor,
    disableTwoFactor,
    getTwoFactorStatus,
} from "@/lib/two-factor";
import { logger } from "@/lib/logger";

// GET - Check 2FA status
export async function GET() {
    const user = await getCurrentUser();

    if (!user) {
        return NextResponse.json(errorResponse("Não autenticado"), { status: 401 });
    }

    const status = await getTwoFactorStatus(user.id);
    return NextResponse.json(successResponse(status));
}

// POST - Generate new secret for setup
export async function POST() {
    const user = await getCurrentUser();

    if (!user) {
        return NextResponse.json(errorResponse("Não autenticado"), { status: 401 });
    }

    try {
        // Generate new secret
        const { secret, otpauth_url } = generateTwoFactorSecret(user.email);

        // Generate QR code
        const qrCode = await generateQRCode(otpauth_url);

        return NextResponse.json(
            successResponse({
                secret,
                qrCode,
                message: "Escaneie o QR code no seu app autenticador",
            })
        );
    } catch (error) {
        logger.error("[2FA] Setup error", { error, route: "/api/auth/2fa/setup", method: "POST" });
        return NextResponse.json(errorResponse("Erro ao gerar 2FA"), { status: 500 });
    }
}

// PUT - Enable 2FA with verification code
export async function PUT(request: Request) {
    const user = await getCurrentUser();

    if (!user) {
        return NextResponse.json(errorResponse("Não autenticado"), { status: 401 });
    }

    try {
        const { secret, token } = await request.json();

        if (!secret || !token) {
            return NextResponse.json(
                errorResponse("Secret e código são obrigatórios"),
                { status: 400 }
            );
        }

        const result = await enableTwoFactor(user.id, secret, token);

        if (!result.success) {
            return NextResponse.json(errorResponse(result.error || "Erro"), { status: 400 });
        }

        return NextResponse.json(successResponse({ enabled: true }));
    } catch (error) {
        logger.error("[2FA] Enable error", { error, route: "/api/auth/2fa/setup", method: "PUT" });
        return NextResponse.json(errorResponse("Erro ao ativar 2FA"), { status: 500 });
    }
}

// DELETE - Disable 2FA
export async function DELETE(request: Request) {
    const user = await getCurrentUser();

    if (!user) {
        return NextResponse.json(errorResponse("Não autenticado"), { status: 401 });
    }

    try {
        const { token } = await request.json();

        if (!token) {
            return NextResponse.json(
                errorResponse("Código de verificação obrigatório"),
                { status: 400 }
            );
        }

        const result = await disableTwoFactor(user.id, token);

        if (!result.success) {
            return NextResponse.json(errorResponse(result.error || "Erro"), { status: 400 });
        }

        return NextResponse.json(successResponse({ enabled: false }));
    } catch (error) {
        logger.error("[2FA] Disable error", { error, route: "/api/auth/2fa/setup", method: "DELETE" });
        return NextResponse.json(errorResponse("Erro ao desativar 2FA"), { status: 500 });
    }
}
