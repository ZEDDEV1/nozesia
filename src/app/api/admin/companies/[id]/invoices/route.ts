/**
 * Admin Company Invoices API
 * 
 * Returns all invoices for a specific company
 */

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { successResponse, errorResponse, handleApiError } from "@/lib/api-response";
import { logger } from "@/lib/logger";

interface RouteParams {
    params: Promise<{ id: string }>;
}

export async function GET(request: Request, { params }: RouteParams) {
    try {
        const user = await getCurrentUser();
        const { id } = await params;

        if (!user || user.role !== "SUPER_ADMIN") {
            return NextResponse.json(errorResponse("Não autorizado"), { status: 401 });
        }

        // Verify company exists
        const company = await prisma.company.findUnique({
            where: { id },
            select: { id: true, name: true }
        });

        if (!company) {
            return NextResponse.json(errorResponse("Empresa não encontrada"), { status: 404 });
        }

        // Get all invoices
        const invoices = await prisma.invoice.findMany({
            where: { companyId: id },
            orderBy: { createdAt: "desc" },
            select: {
                id: true,
                amount: true,
                description: true,
                dueDate: true,
                paidAt: true,
                status: true,
                createdAt: true,
            }
        });

        // Calculate totals
        const totals = {
            total: invoices.length,
            paid: invoices.filter(i => i.status === "paid").length,
            pending: invoices.filter(i => i.status === "pending").length,
            cancelled: invoices.filter(i => i.status === "cancelled").length,
            totalAmount: invoices.reduce((sum, i) => sum + i.amount, 0),
            paidAmount: invoices.filter(i => i.status === "paid").reduce((sum, i) => sum + i.amount, 0),
        };

        return NextResponse.json(successResponse({
            company: { id: company.id, name: company.name },
            invoices,
            totals
        }));

    } catch (error) {
        logger.error("[Admin] Error fetching invoices:", { error });
        return NextResponse.json(handleApiError(error), { status: 500 });
    }
}
