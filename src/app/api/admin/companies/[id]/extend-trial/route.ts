/**
 * Admin Extend Trial API
 * 
 * Allows admin to extend a company's trial period
 */

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { successResponse, errorResponse, handleApiError } from "@/lib/api-response";
import { logger } from "@/lib/logger";

interface RouteParams {
    params: Promise<{ id: string }>;
}

export async function POST(request: Request, { params }: RouteParams) {
    try {
        const user = await getCurrentUser();
        const { id } = await params;

        if (!user || user.role !== "SUPER_ADMIN") {
            return NextResponse.json(errorResponse("Não autorizado"), { status: 401 });
        }

        const body = await request.json();
        const { days } = body;

        if (!days || days < 1 || days > 365) {
            return NextResponse.json(
                errorResponse("Número de dias inválido (1-365)"),
                { status: 400 }
            );
        }

        // Get company
        const company = await prisma.company.findUnique({
            where: { id },
            select: {
                id: true,
                name: true,
                trialEndsAt: true,
                subscription: { select: { status: true } }
            }
        });

        if (!company) {
            return NextResponse.json(errorResponse("Empresa não encontrada"), { status: 404 });
        }

        // Calculate new trial end date
        const now = new Date();
        const currentTrialEnd = company.trialEndsAt ? new Date(company.trialEndsAt) : now;
        const baseDate = currentTrialEnd > now ? currentTrialEnd : now;
        const newTrialEnd = new Date(baseDate);
        newTrialEnd.setDate(newTrialEnd.getDate() + days);

        // Update company
        const updated = await prisma.company.update({
            where: { id },
            data: {
                trialEndsAt: newTrialEnd,
                status: "ACTIVE" // Ensure company is active
            },
            select: { id: true, name: true, trialEndsAt: true }
        });

        // Create audit log
        await prisma.auditLog.create({
            data: {
                action: "EXTEND_TRIAL",
                entity: "Company",
                entityId: id,
                userEmail: user.email,
                companyId: id,
                changes: JSON.stringify({
                    previousTrialEnd: company.trialEndsAt,
                    newTrialEnd,
                    daysAdded: days,
                    extendedBy: user.email
                })
            }
        });

        logger.info(`[Admin] Trial extended for ${company.name}`, {
            companyId: id,
            days,
            newTrialEnd,
            adminEmail: user.email
        });

        return NextResponse.json(successResponse({
            message: `Trial estendido em ${days} dias`,
            company: {
                id: updated.id,
                name: updated.name,
                trialEndsAt: updated.trialEndsAt
            }
        }));

    } catch (error) {
        logger.error("[Admin] Error extending trial:", { error });
        return NextResponse.json(handleApiError(error), { status: 500 });
    }
}
