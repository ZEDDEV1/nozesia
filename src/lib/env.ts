/**
 * Environment Variables Validation
 * 
 * PARA QUE SERVE:
 * - Valida que todas as variáveis de ambiente necessárias existem
 * - Previne erros em produção por variáveis faltando
 * - Mostra mensagens de erro claras sobre o que está faltando
 * 
 * COMO FUNCIONA:
 * - Importado automaticamente no build do Next.js
 * - Se alguma variável crítica faltar, o app nem inicia
 * - Variáveis opcionais têm valores default
 */

import { z } from "zod";

// ============================================
// SCHEMA DE VALIDAÇÃO
// ============================================

const envSchema = z.object({
    // ============================================
    // OBRIGATÓRIAS
    // ============================================

    /** URL do banco PostgreSQL */
    DATABASE_URL: z.string({ message: "❌ DATABASE_URL é obrigatória!" })
        .url("DATABASE_URL deve ser uma URL válida (Ex: postgresql://user:pass@localhost:5432/nozesia)"),

    /** Secret para JWT/NextAuth (mínimo 32 caracteres) */
    JWT_SECRET: z.string({ message: "❌ JWT_SECRET é obrigatória! Gere com: openssl rand -base64 32" })
        .min(32, "JWT_SECRET deve ter no mínimo 32 caracteres para segurança"),

    /** URL pública da aplicação */
    NEXT_PUBLIC_APP_URL: z.string({ message: "❌ NEXT_PUBLIC_APP_URL é obrigatória!" })
        .url("NEXT_PUBLIC_APP_URL deve ser uma URL válida (Ex: https://seu-dominio.com)"),

    /** API Key da OpenAI */
    OPENAI_API_KEY: z.string({ message: "❌ OPENAI_API_KEY é obrigatória! Obtenha em: platform.openai.com" })
        .startsWith("sk-", "OPENAI_API_KEY deve começar com 'sk-'"),

    // ============================================
    // OPCIONAIS COM DEFAULT
    // ============================================

    /** Ambiente de execução */
    NODE_ENV: z.enum(["development", "production", "test"]).default("development"),

    /** Porta do servidor (default: 3000) */
    PORT: z.string().default("3000").transform(Number),

    // ============================================
    // REDIS (Opcional - tem fallback em memória)
    // ============================================

    /** URL Redis para rate limiting e cache (Upstash) */
    UPSTASH_REDIS_REST_URL: z.string().url().optional(),

    /** Token Redis Upstash */
    UPSTASH_REDIS_REST_TOKEN: z.string().optional(),

    /** URL Redis para BullMQ (ioredis format) */
    REDIS_URL: z.string().optional(),

    // ============================================
    // WPPCONNECT (Opcional - para WhatsApp)
    // ============================================

    /** URL do servidor WPPConnect */
    WPPCONNECT_URL: z.string().url().optional().default("http://localhost:21465"),

    /** Secret do WPPConnect */
    WPPCONNECT_SECRET: z.string().optional(),

    // ============================================
    // SENTRY (Opcional - para monitoramento)
    // ============================================

    /** DSN do Sentry para error tracking */
    SENTRY_DSN: z.string().url().optional(),

    // ============================================
    // EMAIL (Opcional - para notificações)
    // ============================================

    /** API Key do Resend para emails */
    RESEND_API_KEY: z.string().optional(),

    // ============================================
    // PAGAMENTOS (Opcional)
    // ============================================

    /** Access Token do MercadoPago */
    MERCADOPAGO_ACCESS_TOKEN: z.string().optional(),

    /** Public Key do MercadoPago (frontend) */
    NEXT_PUBLIC_MERCADOPAGO_PUBLIC_KEY: z.string().optional(),

    // ============================================
    // STORAGE (Opcional)
    // ============================================

    /** URL do Cloudinary */
    CLOUDINARY_URL: z.string().optional(),
});

// ============================================
// VALIDAÇÃO E EXPORT
// ============================================

// Tipo inferido
export type Env = z.infer<typeof envSchema>;

// Função de validação
function validateEnv(): Env {
    try {
        return envSchema.parse(process.env);
    } catch (error) {
        if (error instanceof z.ZodError) {
            const issues = error.issues.map(issue => {
                return `  - ${issue.path.join(".")}: ${issue.message}`;
            }).join("\n");

            console.error("\n");
            console.error("╔══════════════════════════════════════════════════════════════╗");
            console.error("║  ⚠️  ERRO DE CONFIGURAÇÃO - VARIÁVEIS DE AMBIENTE            ║");
            console.error("╠══════════════════════════════════════════════════════════════╣");
            console.error("║  As seguintes variáveis estão incorretas ou faltando:        ║");
            console.error("╚══════════════════════════════════════════════════════════════╝");
            console.error("\n" + issues + "\n");
            console.error("📝 Veja o arquivo .env.example para referência.\n");

            // Em desenvolvimento, apenas avisa. Em produção, não inicia.
            if (process.env.NODE_ENV === "production") {
                process.exit(1);
            }
        }
        throw error;
    }
}

// Validar e exportar
export const env = validateEnv();

// ============================================
// HELPERS
// ============================================

/** Verifica se está em produção */
export const isProduction = env.NODE_ENV === "production";

/** Verifica se está em desenvolvimento */
export const isDevelopment = env.NODE_ENV === "development";

/** Verifica se Redis está configurado */
export const hasRedis = Boolean(env.UPSTASH_REDIS_REST_URL && env.UPSTASH_REDIS_REST_TOKEN);

/** Verifica se Sentry está configurado */
export const hasSentry = Boolean(env.SENTRY_DSN);

/** Verifica se pagamentos estão configurados */
export const hasPayments = Boolean(env.MERCADOPAGO_ACCESS_TOKEN);

