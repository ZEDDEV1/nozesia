import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser, hashPassword } from "@/lib/auth";
import { teamInviteSchema } from "@/lib/validations";
import { successResponse, errorResponse, handleApiError } from "@/lib/api-response";

// GET - List team members
export async function GET() {
    try {
        const user = await getCurrentUser();

        if (!user || !user.companyId) {
            return NextResponse.json(errorResponse("Não autenticado"), { status: 401 });
        }

        const members = await prisma.user.findMany({
            where: { companyId: user.companyId },
            select: {
                id: true,
                name: true,
                email: true,
                role: true,
                avatar: true,
                lastLoginAt: true,
                createdAt: true,
            },
            orderBy: { createdAt: "asc" },
        });

        return NextResponse.json(successResponse(members));
    } catch (error) {
        return NextResponse.json(handleApiError(error), { status: 500 });
    }
}

// POST - Invite new team member
export async function POST(request: Request) {
    try {
        const user = await getCurrentUser();

        if (!user || !user.companyId) {
            return NextResponse.json(errorResponse("Não autenticado"), { status: 401 });
        }

        // Only admins can invite members
        if (user.role !== "SUPER_ADMIN" && user.role !== "COMPANY_ADMIN") {
            return NextResponse.json(
                errorResponse("Sem permissão para convidar membros"),
                { status: 403 }
            );
        }

        const body = await request.json();
        const parsed = teamInviteSchema.safeParse(body);

        if (!parsed.success) {
            return NextResponse.json(
                errorResponse(parsed.error.issues[0].message),
                { status: 400 }
            );
        }

        const { name, email, role } = parsed.data;

        // Check if email already exists
        const existingUser = await prisma.user.findUnique({
            where: { email },
        });

        if (existingUser) {
            return NextResponse.json(
                errorResponse("Este email já está cadastrado"),
                { status: 400 }
            );
        }

        // Check company's plan limits for users
        const company = await prisma.company.findUnique({
            where: { id: user.companyId },
            include: {
                subscription: {
                    include: { plan: true },
                },
                _count: {
                    select: { users: true },
                },
            },
        });

        if (!company) {
            return NextResponse.json(errorResponse("Empresa não encontrada"), { status: 404 });
        }

        // For now, allow unlimited users (can add plan limit later)
        // Generate a temporary password (user should reset on first login)
        const tempPassword = Math.random().toString(36).slice(-8) + "A1!";
        const hashedPassword = await hashPassword(tempPassword);

        const newMember = await prisma.user.create({
            data: {
                name,
                email,
                password: hashedPassword,
                role: role as "COMPANY_ADMIN" | "COMPANY_USER",
                companyId: user.companyId,
            },
            select: {
                id: true,
                name: true,
                email: true,
                role: true,
                createdAt: true,
            },
        });

        // Create audit log
        await prisma.auditLog.create({
            data: {
                action: "INVITE_TEAM_MEMBER",
                entity: "User",
                entityId: newMember.id,
                userEmail: user.email,
                companyId: user.companyId,
                changes: JSON.stringify({ name, email, role }),
            },
        });

        // TODO: Send invite email with temporary password
        // For now, return the temp password so admin can share it
        // In production, this would be sent via email

        return NextResponse.json(
            successResponse(
                { ...newMember, tempPassword },
                "Membro convidado com sucesso!"
            ),
            { status: 201 }
        );
    } catch (error) {
        return NextResponse.json(handleApiError(error), { status: 500 });
    }
}
