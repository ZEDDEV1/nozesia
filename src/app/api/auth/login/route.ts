import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyPassword, generateToken, setAuthCookie } from "@/lib/auth";
import { loginSchema } from "@/lib/validations";
import { successResponse, errorResponse, handleApiError } from "@/lib/api-response";
import { rateLimitMiddleware } from "@/lib/rate-limit";
import { logger } from "@/lib/logger";
import { auditLogin } from "@/lib/audit";

export async function POST(request: Request) {
    // Rate limiting - previne ataques de força bruta
    const rateLimitResponse = await rateLimitMiddleware(request, 'auth');
    if (rateLimitResponse) {
        logger.auth('Login rate limited', {
            ip: request.headers.get('x-forwarded-for') || 'unknown'
        });
        return rateLimitResponse;
    }

    try {
        const body = await request.json();
        const parsed = loginSchema.safeParse(body);

        if (!parsed.success) {
            return NextResponse.json(
                errorResponse(parsed.error.issues[0].message),
                { status: 400 }
            );
        }

        const { email, password } = parsed.data;

        // Find user
        const user = await prisma.user.findUnique({
            where: { email },
            include: { company: true },
        });

        if (!user) {
            logger.auth('Login failed - user not found', { email });
            await auditLogin(email, false, request.headers.get('x-forwarded-for') || undefined, { reason: 'user_not_found' });
            return NextResponse.json(
                errorResponse("Email ou senha incorretos"),
                { status: 401 }
            );
        }

        // Verify password
        const isValid = await verifyPassword(password, user.password);
        if (!isValid) {
            logger.auth('Login failed - wrong password', { email, userId: user.id });
            await auditLogin(email, false, request.headers.get('x-forwarded-for') || undefined, { reason: 'wrong_password' });
            return NextResponse.json(
                errorResponse("Email ou senha incorretos"),
                { status: 401 }
            );
        }

        // Check if company is suspended
        if (user.company && user.company.status === "SUSPENDED") {
            return NextResponse.json(
                errorResponse("Sua conta está suspensa. Entre em contato com o suporte."),
                { status: 403 }
            );
        }

        // Check if 2FA is enabled - require verification
        if (user.twoFactorEnabled) {
            logger.auth('2FA required', { email, userId: user.id });
            return NextResponse.json(
                successResponse({
                    requiresTwoFactor: true,
                    userId: user.id,
                    message: "Verificação de dois fatores necessária",
                })
            );
        }

        // Update last login
        await prisma.user.update({
            where: { id: user.id },
            data: { lastLoginAt: new Date() },
        });

        // Generate token and set cookie
        const token = generateToken({
            userId: user.id,
            email: user.email,
            role: user.role,
            companyId: user.companyId,
        });

        await setAuthCookie(token);

        // Create audit log
        await auditLogin(email, true, request.headers.get('x-forwarded-for') || undefined, {
            userId: user.id,
            companyId: user.companyId,
            role: user.role,
        });

        return NextResponse.json(
            successResponse({
                user: {
                    id: user.id,
                    name: user.name,
                    email: user.email,
                    role: user.role,
                    avatar: user.avatar,
                },
                company: user.company
                    ? {
                        id: user.company.id,
                        name: user.company.name,
                        status: user.company.status,
                    }
                    : null,
            })
        );
    } catch (error) {
        return NextResponse.json(handleApiError(error), { status: 500 });
    }
}

