import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { successResponse, handleApiError, errorResponse } from "@/lib/api-response";
import { logger } from "@/lib/logger";
import { Prisma } from "@prisma/client";

// GET - List system logs (SUPER_ADMIN only)
export async function GET(request: Request) {
    try {
        await requireRole(["SUPER_ADMIN"]);

        const { searchParams } = new URL(request.url);
        const page = parseInt(searchParams.get("page") || "1");
        const limit = parseInt(searchParams.get("limit") || "50");
        const level = searchParams.get("level") || "";
        const category = searchParams.get("category") || "";
        const companyId = searchParams.get("companyId") || "";
        const dateFrom = searchParams.get("dateFrom") || "";
        const dateTo = searchParams.get("dateTo") || "";

        const skip = (page - 1) * limit;

        // Build where clause
        const where: Prisma.SystemLogWhereInput = {};
        if (level) where.level = level as Prisma.EnumLogLevelFilter;
        if (category) where.category = category as Prisma.EnumLogCategoryFilter;
        if (companyId) where.companyId = companyId;
        if (dateFrom || dateTo) {
            where.createdAt = {};
            if (dateFrom) where.createdAt.gte = new Date(dateFrom);
            if (dateTo) where.createdAt.lte = new Date(dateTo);
        }

        // Get logs with pagination
        const [logs, total] = await Promise.all([
            prisma.systemLog.findMany({
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
            prisma.systemLog.count({ where }),
        ]);

        // Stats by level
        const todayStart = new Date();
        todayStart.setHours(0, 0, 0, 0);

        const [levelStats, todayStats, categoryStats] = await Promise.all([
            prisma.systemLog.groupBy({
                by: ["level"],
                _count: true,
            }),
            prisma.systemLog.groupBy({
                by: ["level"],
                where: { createdAt: { gte: todayStart } },
                _count: true,
            }),
            prisma.systemLog.groupBy({
                by: ["category"],
                _count: true,
            }),
        ]);

        return NextResponse.json(
            successResponse({
                logs: logs.map((log) => ({
                    id: log.id,
                    level: log.level,
                    category: log.category,
                    message: log.message,
                    context: log.context ? JSON.parse(log.context) : null,
                    stack: log.stack,
                    route: log.route,
                    method: log.method,
                    statusCode: log.statusCode,
                    duration: log.duration,
                    userId: log.userId,
                    userEmail: log.userEmail,
                    company: log.company,
                    ipAddress: log.ipAddress,
                    createdAt: log.createdAt.toISOString(),
                })),
                pagination: {
                    page,
                    limit,
                    total,
                    totalPages: Math.ceil(total / limit),
                },
                stats: {
                    total,
                    byLevel: levelStats.reduce((acc, s) => {
                        acc[s.level] = s._count;
                        return acc;
                    }, {} as Record<string, number>),
                    today: todayStats.reduce((acc, s) => {
                        acc[s.level] = s._count;
                        return acc;
                    }, {} as Record<string, number>),
                    byCategory: categoryStats.reduce((acc, s) => {
                        acc[s.category] = s._count;
                        return acc;
                    }, {} as Record<string, number>),
                },
            })
        );
    } catch (error) {
        logger.error("[Admin System Logs] Error:", { error });
        return NextResponse.json(handleApiError(error), { status: 500 });
    }
}

// DELETE - Clean old logs (SUPER_ADMIN only)
export async function DELETE(request: Request) {
    try {
        await requireRole(["SUPER_ADMIN"]);

        const { searchParams } = new URL(request.url);
        const deleteAll = searchParams.get("all") === "true";
        const days = parseInt(searchParams.get("days") || "30");

        let result;

        if (deleteAll) {
            // Delete ALL logs
            result = await prisma.systemLog.deleteMany({});
            logger.info("[Admin System Logs] Deleted ALL logs", { deletedCount: result.count });
        } else {
            if (days < 7) {
                return NextResponse.json(errorResponse("Mínimo de 7 dias"), { status: 400 });
            }

            const cutoffDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

            result = await prisma.systemLog.deleteMany({
                where: { createdAt: { lt: cutoffDate } },
            });

            logger.info("[Admin System Logs] Cleaned old logs", { deletedCount: result.count, days });
        }

        return NextResponse.json(successResponse({ deleted: result.count }));
    } catch (error) {
        logger.error("[Admin System Logs] Error cleaning:", { error });
        return NextResponse.json(handleApiError(error), { status: 500 });
    }
}
