import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { successResponse, errorResponse } from "@/lib/api-response";
import { logger } from "@/lib/logger";

export async function GET(request: NextRequest) {
    try {
        // Auth via middleware headers (all /api/admin/* routes require SUPER_ADMIN)
        const userId = request.headers.get("x-user-id");
        const userRole = request.headers.get("x-user-role");

        if (!userId || userRole !== "SUPER_ADMIN") {
            return NextResponse.json(errorResponse("Acesso negado"), { status: 403 });
        }

        const now = new Date();
        const oneMinuteAgo = new Date(now.getTime() - 60 * 1000);
        const fiveMinutesAgo = new Date(now.getTime() - 5 * 60 * 1000);
        const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);

        // Buscar métricas em paralelo
        const [
            messagesLastMinute,
            messagesLastFiveMinutes,
            messagesLastHour,
            activeSessions,
            totalCompanies,
            activeConversations,
            recentErrors,
            systemHealth,
        ] = await Promise.all([
            // Mensagens no último minuto
            prisma.message.count({
                where: { createdAt: { gte: oneMinuteAgo } },
            }),
            // Mensagens nos últimos 5 minutos
            prisma.message.count({
                where: { createdAt: { gte: fiveMinutesAgo } },
            }),
            // Mensagens na última hora
            prisma.message.count({
                where: { createdAt: { gte: oneHourAgo } },
            }),
            // Sessões WhatsApp ativas
            prisma.whatsAppSession.count({
                where: { status: "CONNECTED" },
            }),
            // Total de empresas
            prisma.company.count(),
            // Conversas ativas (com mensagem na última hora)
            prisma.conversation.count({
                where: { lastMessageAt: { gte: oneHourAgo } },
            }),
            // Erros recentes (logs de audit)
            prisma.auditLog.findMany({
                where: {
                    createdAt: { gte: oneHourAgo },
                    action: { contains: "error" },
                },
                orderBy: { createdAt: "desc" },
                take: 5,
                select: {
                    id: true,
                    action: true,
                    changes: true,
                    createdAt: true,
                },
            }),
            // Verificar saúde dos serviços
            checkSystemHealth(),
        ]);

        // Calcular métricas derivadas
        const messagesPerMinute = messagesLastFiveMinutes / 5;

        return NextResponse.json(
            successResponse({
                timestamp: now.toISOString(),
                metrics: {
                    messagesLastMinute,
                    messagesPerMinute: Math.round(messagesPerMinute * 10) / 10,
                    messagesLastHour,
                    activeSessions,
                    totalCompanies,
                    activeConversations,
                },
                recentErrors: recentErrors.map((e) => ({
                    id: e.id,
                    action: e.action,
                    details: e.changes || "",
                    time: e.createdAt,
                })),
                systemHealth,
            })
        );
    } catch (error) {
        logger.error("[Monitoring] Error", { error, route: "/api/admin/monitoring" });
        return NextResponse.json(
            errorResponse("Erro ao buscar métricas"),
            { status: 500 }
        );
    }
}

async function checkSystemHealth() {
    const services = {
        database: "unknown" as "healthy" | "unhealthy" | "unknown",
        redis: "unknown" as "healthy" | "unhealthy" | "unknown",
        openai: "unknown" as "healthy" | "unhealthy" | "unknown",
    };

    // Verificar Database
    try {
        await prisma.$queryRaw`SELECT 1`;
        services.database = "healthy";
    } catch {
        services.database = "unhealthy";
    }

    // Verificar Redis (opcional)
    try {
        const redisUrl = process.env.REDIS_URL;
        if (redisUrl) {
            services.redis = "healthy"; // Assumir healthy se configurado
        } else {
            services.redis = "unknown";
        }
    } catch {
        services.redis = "unhealthy";
    }

    // Verificar OpenAI (pela presença da chave)
    try {
        const openaiKey = process.env.OPENAI_API_KEY;
        services.openai = openaiKey ? "healthy" : "unhealthy";
    } catch {
        services.openai = "unknown";
    }

    return services;
}
