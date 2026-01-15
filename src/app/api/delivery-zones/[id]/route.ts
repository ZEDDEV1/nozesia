"use server";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { successResponse, errorResponse, handleApiError } from "@/lib/api-response";

interface RouteParams {
    params: Promise<{ id: string }>;
}

// PATCH - Update delivery zone
export async function PATCH(request: NextRequest, { params }: RouteParams) {
    try {
        const user = await getCurrentUser();
        if (!user || !user.companyId) {
            return NextResponse.json(errorResponse("Não autorizado"), { status: 401 });
        }

        const { id } = await params;
        const body = await request.json();

        // Check ownership
        const zone = await prisma.deliveryZone.findFirst({
            where: { id, companyId: user.companyId },
        });

        if (!zone) {
            return NextResponse.json(errorResponse("Bairro não encontrado"), { status: 404 });
        }

        const { name, fee, estimatedTime, isActive, order } = body;

        // If changing name, check for duplicate
        if (name && name !== zone.name) {
            const existing = await prisma.deliveryZone.findFirst({
                where: {
                    companyId: user.companyId,
                    name: name.trim(),
                    NOT: { id },
                },
            });

            if (existing) {
                return NextResponse.json(errorResponse("Já existe um bairro com esse nome"), { status: 400 });
            }
        }

        const updated = await prisma.deliveryZone.update({
            where: { id },
            data: {
                ...(name && { name: name.trim() }),
                ...(typeof fee === "number" && { fee }),
                ...(estimatedTime !== undefined && { estimatedTime: estimatedTime?.trim() || null }),
                ...(typeof isActive === "boolean" && { isActive }),
                ...(typeof order === "number" && { order }),
            },
        });

        return NextResponse.json(successResponse(updated, "Bairro atualizado!"));
    } catch (error) {
        return NextResponse.json(handleApiError(error), { status: 500 });
    }
}

// DELETE - Remove delivery zone
export async function DELETE(request: NextRequest, { params }: RouteParams) {
    try {
        const user = await getCurrentUser();
        if (!user || !user.companyId) {
            return NextResponse.json(errorResponse("Não autorizado"), { status: 401 });
        }

        const { id } = await params;

        // Check ownership
        const zone = await prisma.deliveryZone.findFirst({
            where: { id, companyId: user.companyId },
        });

        if (!zone) {
            return NextResponse.json(errorResponse("Bairro não encontrado"), { status: 404 });
        }

        await prisma.deliveryZone.delete({ where: { id } });

        return NextResponse.json(successResponse(null, "Bairro removido!"));
    } catch (error) {
        return NextResponse.json(handleApiError(error), { status: 500 });
    }
}
