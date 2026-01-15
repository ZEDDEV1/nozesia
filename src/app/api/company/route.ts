import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { companySchema } from "@/lib/validations";
import { successResponse, errorResponse, handleApiError } from "@/lib/api-response";

// GET - Get current user's company
export async function GET() {
    try {
        const user = await getCurrentUser();

        if (!user || !user.companyId) {
            return NextResponse.json(errorResponse("Não autenticado"), { status: 401 });
        }

        const company = await prisma.company.findUnique({
            where: { id: user.companyId },
            include: {
                subscription: {
                    include: {
                        plan: true,
                    },
                },
                _count: {
                    select: {
                        users: true,
                        agents: true,
                        sessions: true,
                    },
                },
            },
        });

        if (!company) {
            return NextResponse.json(errorResponse("Empresa não encontrada"), { status: 404 });
        }

        return NextResponse.json(successResponse(company));
    } catch (error) {
        return NextResponse.json(handleApiError(error), { status: 500 });
    }
}

// PUT - Update company settings
export async function PUT(request: Request) {
    try {
        const user = await getCurrentUser();

        if (!user || !user.companyId) {
            return NextResponse.json(errorResponse("Não autenticado"), { status: 401 });
        }

        // Only admins can update company
        if (user.role !== "SUPER_ADMIN" && user.role !== "COMPANY_ADMIN") {
            return NextResponse.json(
                errorResponse("Sem permissão para atualizar empresa"),
                { status: 403 }
            );
        }

        const body = await request.json();
        const parsed = companySchema.partial().safeParse(body);

        if (!parsed.success) {
            return NextResponse.json(
                errorResponse(parsed.error.issues[0].message),
                { status: 400 }
            );
        }

        const data = parsed.data;

        // Check if email is being changed and if it's already in use
        if (data.email) {
            const existingCompany = await prisma.company.findFirst({
                where: {
                    email: data.email,
                    id: { not: user.companyId },
                },
            });

            if (existingCompany) {
                return NextResponse.json(
                    errorResponse("Este email já está em uso por outra empresa"),
                    { status: 400 }
                );
            }
        }

        const updatedCompany = await prisma.company.update({
            where: { id: user.companyId },
            data: {
                ...(data.name && { name: data.name }),
                ...(data.email && { email: data.email }),
                ...(data.phone !== undefined && { phone: data.phone }),
                ...(data.document !== undefined && { document: data.document }),
                ...(data.niche !== undefined && { niche: data.niche }),
                ...(data.description !== undefined && { description: data.description }),
                ...(data.timezone && { timezone: data.timezone }),
                // PIX fields
                ...(body.pixKeyType !== undefined && { pixKeyType: body.pixKeyType }),
                ...(body.pixKey !== undefined && { pixKey: body.pixKey }),
            },
        });

        // Create audit log
        await prisma.auditLog.create({
            data: {
                action: "UPDATE_COMPANY",
                entity: "Company",
                entityId: user.companyId,
                userEmail: user.email,
                companyId: user.companyId,
                changes: JSON.stringify(data),
            },
        });

        return NextResponse.json(
            successResponse(updatedCompany, "Empresa atualizada com sucesso!")
        );
    } catch (error) {
        return NextResponse.json(handleApiError(error), { status: 500 });
    }
}

// PATCH - Update company settings (JSON field)
export async function PATCH(request: Request) {
    try {
        const user = await getCurrentUser();

        if (!user || !user.companyId) {
            return NextResponse.json(errorResponse("Não autenticado"), { status: 401 });
        }

        // Only admins can update settings
        if (user.role !== "SUPER_ADMIN" && user.role !== "COMPANY_ADMIN") {
            return NextResponse.json(
                errorResponse("Sem permissão para atualizar configurações"),
                { status: 403 }
            );
        }

        const body = await request.json();

        // Get current settings
        const company = await prisma.company.findUnique({
            where: { id: user.companyId },
        });

        if (!company) {
            return NextResponse.json(errorResponse("Empresa não encontrada"), { status: 404 });
        }

        // Merge settings
        let currentSettings = {};
        try {
            currentSettings = JSON.parse(company.settings || "{}");
        } catch {
            currentSettings = {};
        }

        // Handle aiEnabled field directly (not in settings)
        const updateData: { settings?: string; aiEnabled?: boolean; enabledModules?: string } = {};

        if (typeof body.aiEnabled === "boolean") {
            updateData.aiEnabled = body.aiEnabled;
        }

        // Handle enabledModules field directly
        if (Array.isArray(body.enabledModules)) {
            updateData.enabledModules = JSON.stringify(body.enabledModules);
        }

        // Handle other settings as JSON
        const settingsFields = { ...body };
        delete settingsFields.aiEnabled;
        delete settingsFields.enabledModules;

        if (Object.keys(settingsFields).length > 0) {
            const newSettings = { ...currentSettings, ...settingsFields };
            updateData.settings = JSON.stringify(newSettings);
        }

        const updatedCompany = await prisma.company.update({
            where: { id: user.companyId },
            data: updateData,
        });

        // Create audit log
        await prisma.auditLog.create({
            data: {
                action: "UPDATE_COMPANY_SETTINGS",
                entity: "Company",
                entityId: user.companyId,
                userEmail: user.email,
                companyId: user.companyId,
                changes: JSON.stringify(body),
            },
        });

        return NextResponse.json(
            successResponse(updatedCompany, "Configurações atualizadas!")
        );
    } catch (error) {
        return NextResponse.json(handleApiError(error), { status: 500 });
    }
}
