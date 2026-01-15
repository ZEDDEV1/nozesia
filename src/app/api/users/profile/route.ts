import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser, hashPassword, verifyPassword } from "@/lib/auth";
import { userProfileSchema, passwordChangeSchema } from "@/lib/validations";
import { successResponse, errorResponse, handleApiError } from "@/lib/api-response";

// GET - Get current user profile with company data
export async function GET() {
    try {
        const user = await getCurrentUser();

        if (!user) {
            return NextResponse.json(errorResponse("Não autenticado"), { status: 401 });
        }

        const fullUser = await prisma.user.findUnique({
            where: { id: user.id },
            include: {
                company: {
                    select: {
                        id: true,
                        name: true,
                        email: true,
                        phone: true,
                        document: true,
                        niche: true,
                        description: true,
                        timezone: true,
                        settings: true,
                        pixKeyType: true,
                        pixKey: true,
                    },
                },
            },
        });

        if (!fullUser) {
            return NextResponse.json(errorResponse("Usuário não encontrado"), { status: 404 });
        }

        return NextResponse.json(
            successResponse({
                id: fullUser.id,
                name: fullUser.name,
                email: fullUser.email,
                role: fullUser.role,
                avatar: fullUser.avatar,
                createdAt: fullUser.createdAt,
                lastLoginAt: fullUser.lastLoginAt,
                company: fullUser.company,
            })
        );
    } catch (error) {
        return NextResponse.json(handleApiError(error), { status: 500 });
    }
}

// PUT - Update user profile
export async function PUT(request: Request) {
    try {
        const user = await getCurrentUser();

        if (!user) {
            return NextResponse.json(errorResponse("Não autenticado"), { status: 401 });
        }

        const body = await request.json();
        const parsed = userProfileSchema.partial().safeParse(body);

        if (!parsed.success) {
            return NextResponse.json(
                errorResponse(parsed.error.issues[0].message),
                { status: 400 }
            );
        }

        const data = parsed.data;

        // Check if email is being changed and if it's already in use
        if (data.email && data.email !== user.email) {
            const existingUser = await prisma.user.findUnique({
                where: { email: data.email },
            });

            if (existingUser) {
                return NextResponse.json(
                    errorResponse("Este email já está em uso"),
                    { status: 400 }
                );
            }
        }

        const updatedUser = await prisma.user.update({
            where: { id: user.id },
            data: {
                ...(data.name && { name: data.name }),
                ...(data.email && { email: data.email }),
                ...(data.avatar !== undefined && { avatar: data.avatar }),
                // Onboarding fields
                ...(body.onboardingCompleted !== undefined && { onboardingCompleted: body.onboardingCompleted }),
                ...(body.onboardingStep !== undefined && { onboardingStep: body.onboardingStep }),
            },
        });

        // Create audit log
        await prisma.auditLog.create({
            data: {
                action: "UPDATE_PROFILE",
                entity: "User",
                entityId: user.id,
                userEmail: user.email,
                companyId: user.companyId,
                changes: JSON.stringify(data),
            },
        });

        return NextResponse.json(
            successResponse({
                id: updatedUser.id,
                name: updatedUser.name,
                email: updatedUser.email,
                role: updatedUser.role,
                avatar: updatedUser.avatar,
            }, "Perfil atualizado com sucesso!")
        );
    } catch (error) {
        return NextResponse.json(handleApiError(error), { status: 500 });
    }
}

// PATCH - Change password
export async function PATCH(request: Request) {
    try {
        const user = await getCurrentUser();

        if (!user) {
            return NextResponse.json(errorResponse("Não autenticado"), { status: 401 });
        }

        const body = await request.json();
        const parsed = passwordChangeSchema.safeParse(body);

        if (!parsed.success) {
            return NextResponse.json(
                errorResponse(parsed.error.issues[0].message),
                { status: 400 }
            );
        }

        const { currentPassword, newPassword } = parsed.data;

        // Get user with password
        const fullUser = await prisma.user.findUnique({
            where: { id: user.id },
        });

        if (!fullUser) {
            return NextResponse.json(errorResponse("Usuário não encontrado"), { status: 404 });
        }

        // Verify current password
        const isValidPassword = await verifyPassword(currentPassword, fullUser.password);

        if (!isValidPassword) {
            return NextResponse.json(
                errorResponse("Senha atual incorreta"),
                { status: 400 }
            );
        }

        // Hash new password and update
        const hashedPassword = await hashPassword(newPassword);

        await prisma.user.update({
            where: { id: user.id },
            data: { password: hashedPassword },
        });

        // Create audit log
        await prisma.auditLog.create({
            data: {
                action: "CHANGE_PASSWORD",
                entity: "User",
                entityId: user.id,
                userEmail: user.email,
                companyId: user.companyId,
            },
        });

        return NextResponse.json(
            successResponse(null, "Senha alterada com sucesso!")
        );
    } catch (error) {
        return NextResponse.json(handleApiError(error), { status: 500 });
    }
}
