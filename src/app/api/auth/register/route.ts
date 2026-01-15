import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hashPassword, generateToken, setAuthCookie } from "@/lib/auth";
import { registerSchema } from "@/lib/validations";
import { successResponse, errorResponse, handleApiError } from "@/lib/api-response";
import { rateLimitMiddleware } from "@/lib/rate-limit";
import { logger } from "@/lib/logger";
import { sendVerificationEmail } from "@/lib/email";
import crypto from "crypto";

export async function POST(request: Request) {
    // Rate limiting - previne spam de registros
    const rateLimitResponse = await rateLimitMiddleware(request, 'auth');
    if (rateLimitResponse) {
        logger.auth('Register rate limited', {
            ip: request.headers.get('x-forwarded-for') || 'unknown'
        });
        return rateLimitResponse;
    }

    try {
        const body = await request.json();
        const parsed = registerSchema.safeParse(body);

        if (!parsed.success) {
            return NextResponse.json(
                errorResponse(parsed.error.issues[0].message),
                { status: 400 }
            );
        }

        const { name, email, password, companyName, companyNiche, companyDescription, phone } = parsed.data;

        // Check if email already exists
        const existingUser = await prisma.user.findUnique({
            where: { email },
        });

        if (existingUser) {
            return NextResponse.json(
                errorResponse("Este email já está em uso"),
                { status: 400 }
            );
        }

        // Check if company email already exists
        const existingCompany = await prisma.company.findUnique({
            where: { email },
        });

        if (existingCompany) {
            return NextResponse.json(
                errorResponse("Esta empresa já está cadastrada"),
                { status: 400 }
            );
        }

        // Calculate trial end date (7 days from now)
        const trialEndsAt = new Date();
        trialEndsAt.setDate(trialEndsAt.getDate() + 7);

        // Create company with business context and FREE trial
        const company = await prisma.company.create({
            data: {
                name: companyName,
                email,
                phone,
                niche: companyNiche,
                description: companyDescription,
                status: "ACTIVE", // Active during trial
                trialEndsAt: trialEndsAt,
                trialUsed: true,
            },
        });

        // Auto-assign TRIAL plan subscription (if TRIAL plan exists)
        const trialPlan = await prisma.plan.findFirst({
            where: { type: "TRIAL" },
        });

        if (trialPlan) {
            await prisma.subscription.create({
                data: {
                    companyId: company.id,
                    planId: trialPlan.id,
                    status: "ACTIVE",
                    currentPeriodStart: new Date(),
                    currentPeriodEnd: trialEndsAt,
                },
            });

            logger.info("Trial subscription created for new company", {
                companyId: company.id,
                planId: trialPlan.id,
                trialEndsAt: trialEndsAt.toISOString(),
            });
        }

        // Create user (email não verificado inicialmente)
        const hashedPassword = await hashPassword(password);
        const user = await prisma.user.create({
            data: {
                name,
                email,
                password: hashedPassword,
                role: "COMPANY_ADMIN",
                companyId: company.id,
                emailVerified: false, // Aguardando verificação
            },
        });

        // Criar token de verificação de email
        const verificationToken = crypto.randomBytes(32).toString("hex");
        const tokenExpiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 horas

        await prisma.verificationToken.create({
            data: {
                token: verificationToken,
                type: "EMAIL_VERIFICATION",
                expiresAt: tokenExpiresAt,
                userId: user.id,
            },
        });

        // Enviar email de verificação
        const emailResult = await sendVerificationEmail(email, name, verificationToken);

        if (!emailResult.success) {
            logger.warn("Failed to send verification email", {
                userId: user.id,
                error: emailResult.error
            });
            // Não falha o registro, apenas loga o erro
        } else {
            logger.auth("Verification email sent", { userId: user.id, email });
        }

        // Generate token and set cookie
        const token = generateToken({
            userId: user.id,
            email: user.email,
            role: user.role,
            companyId: company.id,
        });

        await setAuthCookie(token);

        // Create audit log
        await prisma.auditLog.create({
            data: {
                action: "REGISTER",
                entity: "User",
                entityId: user.id,
                userEmail: email,
                companyId: company.id,
            },
        });

        return NextResponse.json(
            successResponse(
                {
                    user: {
                        id: user.id,
                        name: user.name,
                        email: user.email,
                        role: user.role,
                        emailVerified: user.emailVerified,
                    },
                    company: {
                        id: company.id,
                        name: company.name,
                        status: company.status,
                    },
                    verificationEmailSent: emailResult.success,
                },
                "Conta criada com sucesso! Verifique seu email para ativar."
            ),
            { status: 201 }
        );
    } catch (error) {
        return NextResponse.json(handleApiError(error), { status: 500 });
    }
}
