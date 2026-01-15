/**
 * API de Monitoramento de Filas
 * 
 * PARA QUE SERVE:
 * - Ver quantos jobs estão pendentes/processando/falhou
 * - Diagnóstico de problemas
 * - Monitorar saúde do sistema
 */

import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getQueueStats, clearCompletedJobs } from "@/lib/queue";
import { successResponse, errorResponse } from "@/lib/api-response";
import { logger } from "@/lib/logger";

// GET - Retorna estatísticas da fila (apenas admins)
export async function GET() {
    try {
        const user = await getCurrentUser();

        if (!user || user.role !== "SUPER_ADMIN") {
            return NextResponse.json(errorResponse("Não autorizado"), { status: 401 });
        }

        const stats = getQueueStats();

        return NextResponse.json(successResponse({
            queue: stats,
            timestamp: new Date().toISOString(),
        }));
    } catch (error) {
        logger.error("Error getting queue stats", { error, route: "/api/admin/queue" });
        return NextResponse.json(errorResponse("Erro interno"), { status: 500 });
    }
}

// DELETE - Limpa jobs completados (apenas admins)
export async function DELETE() {
    try {
        const user = await getCurrentUser();

        if (!user || user.role !== "SUPER_ADMIN") {
            return NextResponse.json(errorResponse("Não autorizado"), { status: 401 });
        }

        clearCompletedJobs();

        return NextResponse.json(successResponse({
            message: "Jobs completados limpos"
        }));
    } catch (error) {
        logger.error("Error clearing queue", { error, route: "/api/admin/queue" });
        return NextResponse.json(errorResponse("Erro interno"), { status: 500 });
    }
}
