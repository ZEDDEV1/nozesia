/**
 * API: Order History
 * 
 * GET /api/orders/[id]/history - Get history for an order
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { successResponse, errorResponse } from "@/lib/api-response";

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const user = await getCurrentUser();
        if (!user || !user.companyId) {
            return NextResponse.json(errorResponse("Não autorizado"), { status: 401 });
        }

        const { id } = await params;

        // Verify order belongs to company
        const order = await prisma.order.findFirst({
            where: { id, companyId: user.companyId },
        });

        if (!order) {
            return NextResponse.json(errorResponse("Pedido não encontrado"), { status: 404 });
        }

        const history = await prisma.orderHistory.findMany({
            where: { orderId: id },
            orderBy: { createdAt: "desc" },
        });

        return NextResponse.json(successResponse(history));
    } catch (error) {
        console.error("Order history error:", error);
        return NextResponse.json(errorResponse("Erro ao buscar histórico"), { status: 500 });
    }
}
