import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { successResponse, errorResponse, handleApiError } from "@/lib/api-response";

interface RouteParams {
    params: Promise<{ id: string }>;
}

// GET - Get team member details
export async function GET(request: Request, { params }: RouteParams) {
    try {
        const user = await getCurrentUser();
        const { id: memberId } = await params;

        if (!user || !user.companyId) {
            return NextResponse.json(errorResponse("Não autenticado"), { status: 401 });
        }

        const member = await prisma.user.findFirst({
            where: {
                id: memberId,
                companyId: user.companyId,
            },
            select: {
                id: true,
                name: true,
                email: true,
                role: true,
                avatar: true,
                lastLoginAt: true,
                createdAt: true,
            },
        });

        if (!member) {
            return NextResponse.json(errorResponse("Membro não encontrado"), { status: 404 });
        }

        return NextResponse.json(successResponse(member));
    } catch (error) {
        return NextResponse.json(handleApiError(error), { status: 500 });
    }
}

// PUT - Update team member (role, active status)
export async function PUT(request: Request, { params }: RouteParams) {
    try {
        const user = await getCurrentUser();
        const { id: memberId } = await params;

        if (!user || !user.companyId) {
            return NextResponse.json(errorResponse("Não autenticado"), { status: 401 });
        }

        // Only admins can update members
        if (user.role !== "SUPER_ADMIN" && user.role !== "COMPANY_ADMIN") {
            return NextResponse.json(
                errorResponse("Sem permissão para atualizar membros"),
                { status: 403 }
            );
        }

        // Can't update yourself through this endpoint
        if (memberId === user.id) {
            return NextResponse.json(
                errorResponse("Use a página de perfil para atualizar seus dados"),
                { status: 400 }
            );
        }

        const existingMember = await prisma.user.findFirst({
            where: {
                id: memberId,
                companyId: user.companyId,
            },
        });

        if (!existingMember) {
            return NextResponse.json(errorResponse("Membro não encontrado"), { status: 404 });
        }

        const body = await request.json();
        const { role } = body;

        // Validate role if provided
        if (role && !["COMPANY_ADMIN", "COMPANY_USER"].includes(role)) {
            return NextResponse.json(
                errorResponse("Função inválida"),
                { status: 400 }
            );
        }

        const updatedMember = await prisma.user.update({
            where: { id: memberId },
            data: {
                ...(role && { role }),
            },
            select: {
                id: true,
                name: true,
                email: true,
                role: true,
            },
        });

        // Create audit log
        await prisma.auditLog.create({
            data: {
                action: "UPDATE_TEAM_MEMBER",
                entity: "User",
                entityId: memberId,
                userEmail: user.email,
                companyId: user.companyId,
                changes: JSON.stringify({ role }),
            },
        });

        return NextResponse.json(
            successResponse(updatedMember, "Membro atualizado com sucesso!")
        );
    } catch (error) {
        return NextResponse.json(handleApiError(error), { status: 500 });
    }
}

// DELETE - Remove team member
export async function DELETE(request: Request, { params }: RouteParams) {
    try {
        const user = await getCurrentUser();
        const { id: memberId } = await params;

        if (!user || !user.companyId) {
            return NextResponse.json(errorResponse("Não autenticado"), { status: 401 });
        }

        // Only admins can remove members
        if (user.role !== "SUPER_ADMIN" && user.role !== "COMPANY_ADMIN") {
            return NextResponse.json(
                errorResponse("Sem permissão para remover membros"),
                { status: 403 }
            );
        }

        // Can't remove yourself
        if (memberId === user.id) {
            return NextResponse.json(
                errorResponse("Você não pode remover a si mesmo"),
                { status: 400 }
            );
        }

        const existingMember = await prisma.user.findFirst({
            where: {
                id: memberId,
                companyId: user.companyId,
            },
        });

        if (!existingMember) {
            return NextResponse.json(errorResponse("Membro não encontrado"), { status: 404 });
        }

        // Hard delete the user (dissociate from company)
        await prisma.user.delete({
            where: { id: memberId },
        });

        // Create audit log
        await prisma.auditLog.create({
            data: {
                action: "REMOVE_TEAM_MEMBER",
                entity: "User",
                entityId: memberId,
                userEmail: user.email,
                companyId: user.companyId,
            },
        });

        return NextResponse.json(
            successResponse(null, "Membro removido com sucesso!")
        );
    } catch (error) {
        return NextResponse.json(handleApiError(error), { status: 500 });
    }
}
