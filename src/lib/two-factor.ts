/**
 * Two-Factor Authentication Service
 * 
 * Handles TOTP setup, verification, and QR code generation.
 */

import speakeasy from "speakeasy";
import QRCode from "qrcode";
import { prisma } from "./prisma";
import { logger } from "./logger";

const APP_NAME = "AgenteDeia";

/**
 * Generate a new 2FA secret for a user
 */
export function generateTwoFactorSecret(userEmail: string): {
    secret: string;
    otpauth_url: string;
} {
    const secret = speakeasy.generateSecret({
        name: `${APP_NAME} (${userEmail})`,
        issuer: APP_NAME,
        length: 32,
    });

    return {
        secret: secret.base32,
        otpauth_url: secret.otpauth_url || "",
    };
}

/**
 * Generate QR code for authenticator app
 */
export async function generateQRCode(otpauth_url: string): Promise<string> {
    try {
        const qrCodeDataURL = await QRCode.toDataURL(otpauth_url, {
            width: 256,
            margin: 2,
            color: {
                dark: "#000000",
                light: "#FFFFFF",
            },
        });
        return qrCodeDataURL;
    } catch (error) {
        logger.error("[2FA] QR code generation failed", { error });
        throw new Error("Failed to generate QR code");
    }
}

/**
 * Verify a TOTP token
 */
export function verifyToken(secret: string, token: string): boolean {
    return speakeasy.totp.verify({
        secret,
        encoding: "base32",
        token,
        window: 2, // Allow 2 time steps tolerance
    });
}

/**
 * Enable 2FA for a user
 */
export async function enableTwoFactor(
    userId: string,
    secret: string,
    token: string
): Promise<{ success: boolean; error?: string }> {
    // Verify the token before enabling
    const isValid = verifyToken(secret, token);

    if (!isValid) {
        return { success: false, error: "Código inválido. Tente novamente." };
    }

    try {
        await prisma.user.update({
            where: { id: userId },
            data: {
                twoFactorEnabled: true,
                twoFactorSecret: secret,
            },
        });

        logger.info("[2FA] Enabled for user", { userId });
        return { success: true };
    } catch (error) {
        logger.error("[2FA] Failed to enable", { userId, error });
        return { success: false, error: "Erro ao ativar 2FA." };
    }
}

/**
 * Disable 2FA for a user
 */
export async function disableTwoFactor(
    userId: string,
    token: string
): Promise<{ success: boolean; error?: string }> {
    const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { twoFactorSecret: true },
    });

    if (!user?.twoFactorSecret) {
        return { success: false, error: "2FA não está ativado." };
    }

    // Verify the token before disabling
    const isValid = verifyToken(user.twoFactorSecret, token);

    if (!isValid) {
        return { success: false, error: "Código inválido." };
    }

    try {
        await prisma.user.update({
            where: { id: userId },
            data: {
                twoFactorEnabled: false,
                twoFactorSecret: null,
            },
        });

        logger.info("[2FA] Disabled for user", { userId });
        return { success: true };
    } catch (error) {
        logger.error("[2FA] Failed to disable", { userId, error });
        return { success: false, error: "Erro ao desativar 2FA." };
    }
}

/**
 * Verify 2FA during login
 */
export async function verifyTwoFactorLogin(
    userId: string,
    token: string
): Promise<boolean> {
    const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { twoFactorSecret: true, twoFactorEnabled: true },
    });

    if (!user?.twoFactorEnabled || !user.twoFactorSecret) {
        return false;
    }

    return verifyToken(user.twoFactorSecret, token);
}

/**
 * Check if user has 2FA enabled
 */
export async function hasTwoFactorEnabled(userId: string): Promise<boolean> {
    const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { twoFactorEnabled: true },
    });

    return user?.twoFactorEnabled ?? false;
}

/**
 * Get 2FA status for user
 */
export async function getTwoFactorStatus(userId: string): Promise<{
    enabled: boolean;
    setupRequired: boolean;
}> {
    const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { twoFactorEnabled: true, twoFactorSecret: true },
    });

    return {
        enabled: user?.twoFactorEnabled ?? false,
        setupRequired: !user?.twoFactorEnabled,
    };
}
