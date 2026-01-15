import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { successResponse, handleApiError } from "@/lib/api-response";
import { logger } from "@/lib/logger";

// GET - List audit logs (SUPER_ADMIN only)
export async function GET(request: Request) {
    try {
        await requireRole(["SUPER_ADMIN"]);

        const { searchParams } = new URL(request.url);
        const page = parseInt(searchParams.get("page") || "1");
        const limit = parseInt(searchParams.get("limit") || "50");
        const action = searchParams.get("action") || "";
        const entity = searchParams.get("entity") || "";

        const skip = (page - 1) * limit;

        // Build where clause
        const where: Record<string, unknown> = {};
        if (action) where.action = action;
        if (entity) where.entity = entity;

        // Get logs with pagination
        const [logs, total] = await Promise.all([
            prisma.auditLog.findMany({
                where,
                orderBy: { createdAt: "desc" },
                take: limit,
                skip,
                include: {
                    company: {
                        select: {
                            id: true,
                            name: true,
                        },
                    },
                },
            }),
            prisma.auditLog.count({ where }),
        ]);

        // Get unique actions and entities for filters
        const [actions, entities] = await Promise.all([
            prisma.auditLog.findMany({
                select: { action: true },
                distinct: ["action"],
            }),
            prisma.auditLog.findMany({
                select: { entity: true },
                distinct: ["entity"],
            }),
        ]);

        // Stats
        const todayStart = new Date();
        todayStart.setHours(0, 0, 0, 0);

        const [todayCount, weekCount] = await Promise.all([
            prisma.auditLog.count({
                where: { createdAt: { gte: todayStart } },
            }),
            prisma.auditLog.count({
                where: {
                    createdAt: {
                        gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
                    },
                },
            }),
        ]);

        return NextResponse.json(
            successResponse({
                logs: logs.map((log) => ({
                    id: log.id,
                    action: log.action,
                    entity: log.entity,
                    entityId: log.entityId,
                    userEmail: log.userEmail,
                    changes: log.changes,
                    ipAddress: log.ipAddress,
                    company: log.company,
                    createdAt: log.createdAt.toISOString(),
                })),
                pagination: {
                    page,
                    limit,
                    total,
                    totalPages: Math.ceil(total / limit),
                },
                filters: {
                    actions: actions.map((a) => a.action),
                    entities: entities.map((e) => e.entity).filter(Boolean),
                },
                stats: {
                    total,
                    today: todayCount,
                    thisWeek: weekCount,
                },
            })
        );
    } catch (error) {
        logger.error("[Admin Logs] Error", { error, route: "/api/admin/logs" });
        return NextResponse.json(handleApiError(error), { status: 500 });
    }
}
