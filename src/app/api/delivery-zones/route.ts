"use server";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { successResponse, errorResponse, handleApiError } from "@/lib/api-response";

// GET - List delivery zones
export async function GET() {
    try {
        const user = await getCurrentUser();
        if (!user || !user.companyId) {
            return NextResponse.json(errorResponse("Não autorizado"), { status: 401 });
        }

        const zones = await prisma.deliveryZone.findMany({
            where: { companyId: user.companyId },
            orderBy: [{ order: "asc" }, { name: "asc" }],
        });

        return NextResponse.json(successResponse(zones));
    } catch (error) {
        return NextResponse.json(handleApiError(error), { status: 500 });
    }
}

// POST - Create delivery zone
export async function POST(request: NextRequest) {
    try {
        const user = await getCurrentUser();
        if (!user || !user.companyId) {
            return NextResponse.json(errorResponse("Não autorizado"), { status: 401 });
        }

        const body = await request.json();
        const { name, fee, estimatedTime } = body;

        if (!name || typeof name !== "string" || name.trim().length < 2) {
            return NextResponse.json(errorResponse("Nome do bairro é obrigatório (mínimo 2 caracteres)"), { status: 400 });
        }

        if (typeof fee !== "number" || fee < 0) {
            return NextResponse.json(errorResponse("Taxa de entrega deve ser um valor válido"), { status: 400 });
        }

        // Check for duplicate
        const existing = await prisma.deliveryZone.findUnique({
            where: {
                companyId_name: {
                    companyId: user.companyId,
                    name: name.trim(),
                },
            },
        });

        if (existing) {
            return NextResponse.json(errorResponse("Bairro já cadastrado"), { status: 400 });
        }

        // Get max order
        const maxOrder = await prisma.deliveryZone.aggregate({
            where: { companyId: user.companyId },
            _max: { order: true },
        });

        const zone = await prisma.deliveryZone.create({
            data: {
                companyId: user.companyId,
                name: name.trim(),
                fee,
                estimatedTime: estimatedTime?.trim() || null,
                order: (maxOrder._max.order || 0) + 1,
            },
        });

        return NextResponse.json(successResponse(zone, "Bairro adicionado!"), { status: 201 });
    } catch (error) {
        return NextResponse.json(handleApiError(error), { status: 500 });
    }
}
