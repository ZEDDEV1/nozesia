/**
 * API: Contact Tags
 * 
 * GET /api/contacts/tags?phone=xxx - Get tags for a contact
 * PUT /api/contacts/tags - Update tags for a contact (set)
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { successResponse, errorResponse } from "@/lib/api-response";
import { logger } from "@/lib/logger";

/**
 * GET /api/contacts/tags?phone=xxx
 * Get all tags for a specific contact
 */
export async function GET(request: NextRequest) {
    try {
        const user = await getCurrentUser();
        if (!user || !user.companyId) {
            return NextResponse.json(errorResponse("Não autorizado"), { status: 401 });
        }

        const phone = request.nextUrl.searchParams.get("phone");

        if (!phone) {
            return NextResponse.json(errorResponse("Telefone é obrigatório"), { status: 400 });
        }

        const contactTags = await prisma.contactTag.findMany({
            where: {
                companyId: user.companyId,
                phone,
            },
            include: {
                tag: true,
            },
        });

        const tags = contactTags.map(ct => ct.tag);

        return NextResponse.json(successResponse(tags));
    } catch (error) {
        logger.error("[Contact Tags API] GET error", { error, route: "/api/contacts/tags" });
        return NextResponse.json(errorResponse("Erro ao buscar tags"), { status: 500 });
    }
}

/**
 * PUT /api/contacts/tags
 * Update tags for a contact (replaces all existing)
 * Body: { phone: string, tagIds: string[] }
 */
export async function PUT(request: NextRequest) {
    try {
        const user = await getCurrentUser();
        if (!user || !user.companyId) {
            return NextResponse.json(errorResponse("Não autorizado"), { status: 401 });
        }

        const body = await request.json();
        const { phone, tagIds } = body;

        if (!phone) {
            return NextResponse.json(errorResponse("Telefone é obrigatório"), { status: 400 });
        }

        if (!Array.isArray(tagIds)) {
            return NextResponse.json(errorResponse("tagIds deve ser um array"), { status: 400 });
        }

        // Verify all tags belong to company
        if (tagIds.length > 0) {
            const validTags = await prisma.tag.findMany({
                where: {
                    id: { in: tagIds },
                    companyId: user.companyId
                },
            });

            if (validTags.length !== tagIds.length) {
                return NextResponse.json(
                    errorResponse("Uma ou mais tags são inválidas"),
                    { status: 400 }
                );
            }
        }

        // Delete existing tags for this contact
        await prisma.contactTag.deleteMany({
            where: {
                companyId: user.companyId,
                phone,
            },
        });

        // Create new tag associations
        if (tagIds.length > 0) {
            await prisma.contactTag.createMany({
                data: tagIds.map((tagId: string) => ({
                    companyId: user.companyId!,
                    phone,
                    tagId,
                })),
            });
        }

        // Fetch updated tags
        const updatedTags = await prisma.contactTag.findMany({
            where: {
                companyId: user.companyId,
                phone,
            },
            include: { tag: true },
        });

        const tags = updatedTags.map(ct => ct.tag);

        logger.info("[Contact Tags API] Tags updated", {
            phone,
            tagCount: tags.length,
        });

        return NextResponse.json(successResponse(tags, "Tags atualizadas!"));
    } catch (error) {
        logger.error("[Contact Tags API] PUT error", { error, route: "/api/contacts/tags" });
        return NextResponse.json(errorResponse("Erro ao atualizar tags"), { status: 500 });
    }
}
