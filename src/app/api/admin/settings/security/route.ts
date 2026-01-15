import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { successResponse, errorResponse, handleApiError } from "@/lib/api-response";
import { logger } from "@/lib/logger";
import bcrypt from "bcryptjs";

// PATCH - Update admin security settings (email/password)
export async function PATCH(request: Request) {
    try {
        const user = await requireRole(["SUPER_ADMIN"]);

        const body = await request.json();
        const { currentPassword, newPassword, newEmail } = body;

        // Get current user with password
        const currentUser = await prisma.user.findUnique({
            where: { id: user.id },
            select: { id: true, email: true, password: true },
        });

        if (!currentUser) {
            return NextResponse.json(errorResponse("Usuário não encontrado"), { status: 404 });
        }

        // Verify current password if changing password
        if (newPassword) {
            if (!currentPassword) {
                return NextResponse.json(
                    errorResponse("Senha atual é obrigatória"),
                    { status: 400 }
                );
            }

            const isPasswordValid = await bcrypt.compare(currentPassword, currentUser.password);
            if (!isPasswordValid) {
                return NextResponse.json(
                    errorResponse("Senha atual incorreta"),
                    { status: 400 }
                );
            }

            if (newPassword.length < 6) {
                return NextResponse.json(
                    errorResponse("Nova senha deve ter pelo menos 6 caracteres"),
                    { status: 400 }
                );
            }
        }

        // Build update object
        const updateData: { email?: string; password?: string } = {};

        if (newEmail && newEmail !== currentUser.email) {
            // Check if email is already in use
            const existingUser = await prisma.user.findFirst({
                where: { email: newEmail, id: { not: user.id } },
            });

            if (existingUser) {
                return NextResponse.json(
                    errorResponse("Este email já está em uso"),
                    { status: 400 }
                );
            }

            updateData.email = newEmail;
        }

        if (newPassword) {
            updateData.password = await bcrypt.hash(newPassword, 10);
        }

        if (Object.keys(updateData).length === 0) {
            return NextResponse.json(
                errorResponse("Nenhuma alteração informada"),
                { status: 400 }
            );
        }

        // Update user
        const updatedUser = await prisma.user.update({
            where: { id: user.id },
            data: updateData,
            select: { id: true, email: true, name: true },
        });

        // Log the action
        await prisma.auditLog.create({
            data: {
                action: "ADMIN_SECURITY_UPDATE",
                entity: "User",
                entityId: user.id,
                userEmail: user.email,
                companyId: user.companyId,
            },
        });

        logger.info("[Admin Security] Updated admin credentials", {
            userId: user.id,
            emailChanged: !!updateData.email,
            passwordChanged: !!updateData.password,
        });

        return NextResponse.json(
            successResponse({
                user: updatedUser,
                message: "Credenciais atualizadas com sucesso",
            })
        );
    } catch (error) {
        logger.error("[Admin Security] Error:", { error });
        return NextResponse.json(handleApiError(error), { status: 500 });
    }
}

// GET - Get current admin info
export async function GET() {
    try {
        const user = await requireRole(["SUPER_ADMIN"]);

        const adminUser = await prisma.user.findUnique({
            where: { id: user.id },
            select: { id: true, email: true, name: true, createdAt: true },
        });

        return NextResponse.json(successResponse(adminUser));
    } catch (error) {
        logger.error("[Admin Security] Error:", { error });
        return NextResponse.json(handleApiError(error), { status: 500 });
    }
}
