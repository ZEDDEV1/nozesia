/**
 * API: Get Socket Token
 * 
 * Endpoint para obter o token JWT para autenticação do Socket.io
 * Como o cookie é httpOnly, JavaScript não consegue lê-lo diretamente
 * GET /api/socket/token
 */

import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { generateToken } from "@/lib/auth";

export async function GET() {
    try {
        const user = await getCurrentUser();

        if (!user) {
            return NextResponse.json(
                { success: false, token: null },
                { status: 401 }
            );
        }

        // Gera um novo token (ou retorna o atual)
        const token = generateToken({
            userId: user.id,
            email: user.email,
            role: user.role,
            companyId: user.companyId,
        });

        return NextResponse.json({
            success: true,
            token,
        });
    } catch (error) {
        console.error("Error getting socket token:", error);
        return NextResponse.json(
            { success: false, token: null },
            { status: 500 }
        );
    }
}
