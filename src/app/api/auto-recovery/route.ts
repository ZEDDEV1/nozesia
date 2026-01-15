/**
 * API: Auto Recovery Configuration
 * 
 * GET - Get config
 * PUT - Update config
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { logger } from "@/lib/logger";

/**
 * GET /api/auto-recovery - Get auto recovery config
 */
export async function GET() {
    try {
        const user = await getCurrentUser();
        if (!user || !user.companyId) {
            return NextResponse.json(
                { success: false, error: "Não autorizado" },
                { status: 401 }
            );
        }

        let config = await prisma.autoRecoveryConfig.findUnique({
            where: { companyId: user.companyId },
        });

        // Create default config if not exists
        if (!config) {
            config = await prisma.autoRecoveryConfig.create({
                data: {
                    companyId: user.companyId,
                    enabled: false,
                    inactiveDays: 30,
                    message: "Oi {nome}! 👋\n\nSentimos sua falta! Faz um tempo que você não visita a gente.\n\nTem novidades incríveis te esperando! Quer dar uma olhada? 😊",
                    startHour: 9,
                    endHour: 21,
                    activeDays: [1, 2, 3, 4, 5],
                    dailyLimit: 50,
                },
            });
        }

        return NextResponse.json({
            success: true,
            data: config,
        });
    } catch (error) {
        logger.error("[API AutoRecovery] GET error", { error, route: "/api/auto-recovery", method: "GET" });
        return NextResponse.json(
            { success: false, error: "Erro ao buscar configuração" },
            { status: 500 }
        );
    }
}

/**
 * PUT /api/auto-recovery - Update auto recovery config
 */
export async function PUT(request: NextRequest) {
    try {
        const user = await getCurrentUser();
        if (!user || !user.companyId) {
            return NextResponse.json(
                { success: false, error: "Não autorizado" },
                { status: 401 }
            );
        }

        const body = await request.json();
        const {
            enabled,
            inactiveDays,
            message,
            startHour,
            endHour,
            activeDays,
            dailyLimit,
        } = body;

        const config = await prisma.autoRecoveryConfig.upsert({
            where: { companyId: user.companyId },
            create: {
                companyId: user.companyId,
                enabled: enabled ?? false,
                inactiveDays: inactiveDays ?? 30,
                message: message ?? "Oi {nome}! Sentimos sua falta!",
                startHour: startHour ?? 9,
                endHour: endHour ?? 21,
                activeDays: activeDays ?? [1, 2, 3, 4, 5],
                dailyLimit: dailyLimit ?? 50,
            },
            update: {
                ...(enabled !== undefined && { enabled }),
                ...(inactiveDays !== undefined && { inactiveDays }),
                ...(message !== undefined && { message }),
                ...(startHour !== undefined && { startHour }),
                ...(endHour !== undefined && { endHour }),
                ...(activeDays !== undefined && { activeDays }),
                ...(dailyLimit !== undefined && { dailyLimit }),
            },
        });

        return NextResponse.json({
            success: true,
            data: config,
        });
    } catch (error) {
        logger.error("[API AutoRecovery] PUT error", { error, route: "/api/auto-recovery", method: "PUT" });
        return NextResponse.json(
            { success: false, error: "Erro ao atualizar configuração" },
            { status: 500 }
        );
    }
}
