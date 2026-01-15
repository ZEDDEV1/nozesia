/**
 * API: Tag Actions
 * 
 * DELETE /api/tags/[id] - Excluir tag
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { logger } from "@/lib/logger";

interface RouteParams {
    params: Promise<{ id: string }>;
}

/**
 * DELETE /api/tags/[id] - Delete a tag
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
    try {
        const user = await getCurrentUser();
        if (!user || !user.companyId) {
            return NextResponse.json(
                { success: false, error: "Não autorizado" },
                { status: 401 }
            );
        }

        const { id } = await params;

        // Verify tag belongs to company
        const tag = await prisma.tag.findFirst({
            where: {
                id,
                companyId: user.companyId,
            },
        });

        if (!tag) {
            return NextResponse.json(
                { success: false, error: "Tag não encontrada" },
                { status: 404 }
            );
        }

        await prisma.tag.delete({
            where: { id },
        });

        return NextResponse.json({
            success: true,
            message: "Tag excluída!",
        });

    } catch (error) {
        logger.error("[Tags API] DELETE error", { error, route: "/api/tags/[id]", method: "DELETE" });
        return NextResponse.json(
            { success: false, error: "Erro ao excluir tag" },
            { status: 500 }
        );
    }
}
