/**
 * API: Message Templates
 * 
 * GET - List templates
 * POST - Create template
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { logger } from "@/lib/logger";

// Available template variables
const AVAILABLE_VARIABLES = ["nome", "produto", "valor", "empresa", "data"];

/**
 * GET /api/templates - List all templates
 */
export async function GET(request: NextRequest) {
    try {
        const user = await getCurrentUser();
        if (!user || !user.companyId) {
            return NextResponse.json(
                { success: false, error: "Não autorizado" },
                { status: 401 }
            );
        }

        const { searchParams } = new URL(request.url);
        const category = searchParams.get("category");

        const where: Record<string, unknown> = { companyId: user.companyId };
        if (category && category !== "all") {
            where.category = category;
        }

        const templates = await prisma.messageTemplate.findMany({
            where,
            orderBy: [{ category: "asc" }, { usageCount: "desc" }],
        });

        return NextResponse.json({
            success: true,
            data: templates,
            availableVariables: AVAILABLE_VARIABLES,
        });
    } catch (error) {
        logger.error("[API Templates] GET error", { error, route: "/api/templates", method: "GET" });
        return NextResponse.json(
            { success: false, error: "Erro ao buscar templates" },
            { status: 500 }
        );
    }
}

/**
 * POST /api/templates - Create new template
 */
export async function POST(request: NextRequest) {
    try {
        const user = await getCurrentUser();
        if (!user || !user.companyId) {
            return NextResponse.json(
                { success: false, error: "Não autorizado" },
                { status: 401 }
            );
        }

        const body = await request.json();
        const { name, content, category } = body;

        if (!name || !content) {
            return NextResponse.json(
                { success: false, error: "Nome e conteúdo são obrigatórios" },
                { status: 400 }
            );
        }

        // Extract variables from content (e.g., {nome}, {produto})
        const variableRegex = /\{(\w+)\}/g;
        const matches = content.matchAll(variableRegex);
        const variables = [...new Set([...matches].map((m: RegExpMatchArray) => m[1]))];

        // Validate extracted variables
        const invalidVars = variables.filter((v: string) => !AVAILABLE_VARIABLES.includes(v));
        if (invalidVars.length > 0) {
            return NextResponse.json(
                {
                    success: false,
                    error: `Variáveis inválidas: ${invalidVars.join(", ")}. Use: ${AVAILABLE_VARIABLES.join(", ")}`
                },
                { status: 400 }
            );
        }

        const template = await prisma.messageTemplate.create({
            data: {
                companyId: user.companyId,
                name,
                content,
                category: category || "CUSTOM",
                variables,
            },
        });

        return NextResponse.json({
            success: true,
            data: template,
        });
    } catch (error) {
        logger.error("[API Templates] POST error", { error, route: "/api/templates", method: "POST" });

        // Check for unique constraint error
        if (error instanceof Error && error.message.includes("Unique")) {
            return NextResponse.json(
                { success: false, error: "Já existe um template com esse nome" },
                { status: 400 }
            );
        }

        return NextResponse.json(
            { success: false, error: "Erro ao criar template" },
            { status: 500 }
        );
    }
}
