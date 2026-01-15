/**
 * Serviço de Email com Resend
 * 
 * PARA QUE SERVE:
 * - Enviar email de verificação no registro
 * - Enviar email de recuperação de senha
 * - Notificações por email
 * 
 * CONFIGURAÇÃO:
 * 1. Crie conta em resend.com
 * 2. Pegue a API key
 * 3. Adicione RESEND_API_KEY no .env
 * 4. Configure domínio verificado (ou use onboarding@resend.dev para testes)
 */

import { Resend } from "resend";
import { logger } from "./logger";

// Inicializar Resend (só se tiver API key)
const resend = process.env.RESEND_API_KEY
    ? new Resend(process.env.RESEND_API_KEY)
    : null;

// Configurações
const FROM_EMAIL = process.env.EMAIL_FROM || "NozesIA <onboarding@resend.dev>";
const APP_NAME = "NozesIA";
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

// ============================================
// TIPOS
// ============================================

interface SendEmailOptions {
    to: string;
    subject: string;
    html: string;
    text?: string;
}

interface SendEmailResult {
    success: boolean;
    messageId?: string;
    error?: string;
}

// ============================================
// FUNÇÃO PRINCIPAL DE ENVIO
// ============================================

export async function sendEmail(options: SendEmailOptions): Promise<SendEmailResult> {
    const { to, subject, html, text } = options;

    // Se não tiver Resend configurado, logar e retornar sucesso fake (dev)
    if (!resend) {
        logger.warn("Email not sent - RESEND_API_KEY not configured", { to, subject });
        console.log("\n📧 ========== EMAIL (DEV MODE) ==========");
        console.log(`To: ${to}`);
        console.log(`Subject: ${subject}`);
        console.log(`HTML Preview: ${html.substring(0, 200)}...`);
        console.log("==========================================\n");
        return { success: true, messageId: "dev-mode" };
    }

    try {
        const result = await resend.emails.send({
            from: FROM_EMAIL,
            to,
            subject,
            html,
            text: text || html.replace(/<[^>]*>/g, ""), // Fallback para texto
        });

        if (result.error) {
            logger.error("Email send failed", { to, error: result.error.message });
            return { success: false, error: result.error.message };
        }

        logger.info("Email sent successfully", { to, messageId: result.data?.id });
        return { success: true, messageId: result.data?.id };

    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error";
        logger.error("Email send error", { to, error: errorMessage });
        return { success: false, error: errorMessage };
    }
}

// ============================================
// TEMPLATES DE EMAIL
// ============================================

/**
 * Email de verificação de conta
 */
export async function sendVerificationEmail(
    to: string,
    name: string,
    token: string
): Promise<SendEmailResult> {
    const verifyUrl = `${APP_URL}/auth/verify-email?token=${token}`;

    const html = `
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Verifique seu email</title>
    </head>
    <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f4f4f5; padding: 40px 20px;">
        <div style="max-width: 560px; margin: 0 auto; background: #ffffff; border-radius: 12px; padding: 40px; box-shadow: 0 4px 6px rgba(0,0,0,0.05);">
            <div style="text-align: center; margin-bottom: 32px;">
                <h1 style="color: #10b981; font-size: 28px; margin: 0;">🚀 ${APP_NAME}</h1>
            </div>
            
            <h2 style="color: #18181b; font-size: 20px; margin-bottom: 16px;">
                Olá, ${name}! 👋
            </h2>
            
            <p style="color: #52525b; font-size: 16px; line-height: 1.6; margin-bottom: 24px;">
                Obrigado por se cadastrar no ${APP_NAME}! Para ativar sua conta e começar a usar nossa plataforma de atendimento com IA, clique no botão abaixo:
            </p>
            
            <div style="text-align: center; margin: 32px 0;">
                <a href="${verifyUrl}" style="display: inline-block; background: linear-gradient(135deg, #10b981, #06b6d4); color: #ffffff; font-weight: 600; font-size: 16px; padding: 14px 32px; border-radius: 8px; text-decoration: none;">
                    ✅ Verificar meu email
                </a>
            </div>
            
            <p style="color: #71717a; font-size: 14px; margin-bottom: 8px;">
                Ou copie e cole este link no seu navegador:
            </p>
            <p style="color: #10b981; font-size: 14px; word-break: break-all; background: #f4f4f5; padding: 12px; border-radius: 6px;">
                ${verifyUrl}
            </p>
            
            <hr style="border: none; border-top: 1px solid #e4e4e7; margin: 32px 0;">
            
            <p style="color: #a1a1aa; font-size: 12px; text-align: center;">
                Este link expira em 24 horas.<br>
                Se você não criou uma conta, ignore este email.
            </p>
        </div>
    </body>
    </html>
    `;

    // Log do link para desenvolvimento (quando não tem Resend)
    if (!resend) {
        console.log("\n🔗 ========== VERIFICATION LINK ==========");
        console.log(`👤 User: ${name} (${to})`);
        console.log(`🔗 Link: ${verifyUrl}`);
        console.log("==========================================\n");
    }

    return sendEmail({
        to,
        subject: `Verifique seu email - ${APP_NAME}`,
        html,
    });
}

/**
 * Email de recuperação de senha
 */
export async function sendPasswordResetEmail(
    to: string,
    name: string,
    token: string
): Promise<SendEmailResult> {
    const resetUrl = `${APP_URL}/auth/reset-password?token=${token}`;

    const html = `
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Recuperar senha</title>
    </head>
    <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f4f4f5; padding: 40px 20px;">
        <div style="max-width: 560px; margin: 0 auto; background: #ffffff; border-radius: 12px; padding: 40px; box-shadow: 0 4px 6px rgba(0,0,0,0.05);">
            <div style="text-align: center; margin-bottom: 32px;">
                <h1 style="color: #10b981; font-size: 28px; margin: 0;">🔐 ${APP_NAME}</h1>
            </div>
            
            <h2 style="color: #18181b; font-size: 20px; margin-bottom: 16px;">
                Olá, ${name}! 
            </h2>
            
            <p style="color: #52525b; font-size: 16px; line-height: 1.6; margin-bottom: 24px;">
                Recebemos uma solicitação para redefinir sua senha. Clique no botão abaixo para criar uma nova senha:
            </p>
            
            <div style="text-align: center; margin: 32px 0;">
                <a href="${resetUrl}" style="display: inline-block; background: linear-gradient(135deg, #8b5cf6, #ec4899); color: #ffffff; font-weight: 600; font-size: 16px; padding: 14px 32px; border-radius: 8px; text-decoration: none;">
                    🔑 Redefinir minha senha
                </a>
            </div>
            
            <p style="color: #71717a; font-size: 14px; margin-bottom: 8px;">
                Ou copie e cole este link no seu navegador:
            </p>
            <p style="color: #8b5cf6; font-size: 14px; word-break: break-all; background: #f4f4f5; padding: 12px; border-radius: 6px;">
                ${resetUrl}
            </p>
            
            <hr style="border: none; border-top: 1px solid #e4e4e7; margin: 32px 0;">
            
            <p style="color: #a1a1aa; font-size: 12px; text-align: center;">
                Este link expira em 1 hora.<br>
                Se você não solicitou a redefinição de senha, ignore este email.
            </p>
        </div>
    </body>
    </html>
    `;

    // Log do link para desenvolvimento (quando não tem Resend)
    if (!resend) {
        console.log("\n🔑 ========== PASSWORD RESET LINK ==========");
        console.log(`👤 User: ${name} (${to})`);
        console.log(`🔗 Link: ${resetUrl}`);
        console.log("=============================================\n");
    }

    return sendEmail({
        to,
        subject: `Redefinir senha - ${APP_NAME}`,
        html,
    });
}

/**
 * Email de boas-vindas (após verificação)
 */
export async function sendWelcomeEmail(
    to: string,
    name: string
): Promise<SendEmailResult> {
    const dashboardUrl = `${APP_URL}/dashboard`;

    const html = `
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Bem-vindo ao ${APP_NAME}</title>
    </head>
    <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f4f4f5; padding: 40px 20px;">
        <div style="max-width: 560px; margin: 0 auto; background: #ffffff; border-radius: 12px; padding: 40px; box-shadow: 0 4px 6px rgba(0,0,0,0.05);">
            <div style="text-align: center; margin-bottom: 32px;">
                <h1 style="color: #10b981; font-size: 28px; margin: 0;">🎉 ${APP_NAME}</h1>
            </div>
            
            <h2 style="color: #18181b; font-size: 20px; margin-bottom: 16px;">
                Parabéns, ${name}! Sua conta foi verificada! 🚀
            </h2>
            
            <p style="color: #52525b; font-size: 16px; line-height: 1.6; margin-bottom: 24px;">
                Agora você está pronto para revolucionar seu atendimento ao cliente com IA. Aqui estão os próximos passos:
            </p>
            
            <div style="background: #f0fdf4; border-radius: 8px; padding: 20px; margin-bottom: 24px;">
                <p style="color: #166534; font-size: 14px; margin: 0 0 12px 0;"><strong>1️⃣ Conecte seu WhatsApp</strong><br>Escaneie o QR Code para vincular seu número</p>
                <p style="color: #166534; font-size: 14px; margin: 0 0 12px 0;"><strong>2️⃣ Crie seu Agente IA</strong><br>Configure a personalidade e o comportamento</p>
                <p style="color: #166534; font-size: 14px; margin: 0;"><strong>3️⃣ Treine com seus dados</strong><br>Adicione FAQs, produtos e informações</p>
            </div>
            
            <div style="text-align: center; margin: 32px 0;">
                <a href="${dashboardUrl}" style="display: inline-block; background: linear-gradient(135deg, #10b981, #06b6d4); color: #ffffff; font-weight: 600; font-size: 16px; padding: 14px 32px; border-radius: 8px; text-decoration: none;">
                    Acessar Dashboard
                </a>
            </div>
            
            <hr style="border: none; border-top: 1px solid #e4e4e7; margin: 32px 0;">
            
            <p style="color: #a1a1aa; font-size: 12px; text-align: center;">
                Precisa de ajuda? Responda este email ou acesse nossa documentação.
            </p>
        </div>
    </body>
    </html>
    `;

    return sendEmail({
        to,
        subject: `Bem-vindo ao ${APP_NAME}! 🎉`,
        html,
    });
}
