/**
 * Logger Estruturado para AgenteDeia
 * 
 * - Em desenvolvimento: logs coloridos e legíveis
 * - Em produção: JSON para agregadores + salva no banco
 * - Salva automaticamente no SystemLog para admin visualizar
 */

import { prisma } from "./prisma";

type LogLevel = 'DEBUG' | 'INFO' | 'WARNING' | 'ERROR' | 'SECURITY';
type LogCategory = 'API' | 'WHATSAPP' | 'AUTH' | 'PAYMENT' | 'AI' | 'WEBHOOK' | 'CRON' | 'SYSTEM';

interface LogContext {
    [key: string]: unknown;
    userId?: string;
    userEmail?: string;
    companyId?: string;
    requestId?: string;
    action?: string;
    duration?: number;
    error?: Error | unknown;
    route?: string;
    method?: string;
    statusCode?: number;
    ipAddress?: string;
    userAgent?: string;
}

interface LogEntry {
    timestamp: string;
    level: LogLevel;
    message: string;
    context?: LogContext;
    stack?: string;
}

const LOG_LEVELS: Record<LogLevel, number> = {
    DEBUG: 0,
    INFO: 1,
    WARNING: 2,
    ERROR: 3,
    SECURITY: 4,
};

// Nível mínimo baseado em ambiente
const MIN_LEVEL = process.env.NODE_ENV === 'production' ? 'INFO' : 'DEBUG';

// Níveis que devem ser salvos no banco
const PERSIST_LEVELS: LogLevel[] = ['WARNING', 'ERROR', 'SECURITY'];

function shouldLog(level: LogLevel): boolean {
    return LOG_LEVELS[level] >= LOG_LEVELS[MIN_LEVEL as LogLevel];
}

function shouldPersist(level: LogLevel): boolean {
    return PERSIST_LEVELS.includes(level);
}

function formatError(error: unknown): { message: string; stack?: string } {
    if (error instanceof Error) {
        return { message: error.message, stack: error.stack };
    }
    return { message: String(error) };
}

// Detectar categoria baseado na mensagem
function detectCategory(message: string): LogCategory {
    const lowerMessage = message.toLowerCase();
    if (lowerMessage.includes('whatsapp') || lowerMessage.includes('webhook')) return 'WHATSAPP';
    if (lowerMessage.includes('auth') || lowerMessage.includes('login') || lowerMessage.includes('2fa')) return 'AUTH';
    if (lowerMessage.includes('payment') || lowerMessage.includes('checkout') || lowerMessage.includes('mercado')) return 'PAYMENT';
    if (lowerMessage.includes('openai') || lowerMessage.includes('ai') || lowerMessage.includes('gpt')) return 'AI';
    if (lowerMessage.includes('cron') || lowerMessage.includes('recovery')) return 'CRON';
    if (lowerMessage.includes('api')) return 'API';
    return 'SYSTEM';
}

// Salvar no banco de forma assíncrona (não bloqueia)
async function persistLog(
    level: LogLevel,
    category: LogCategory,
    message: string,
    context?: LogContext,
    stack?: string
): Promise<void> {
    try {
        await prisma.systemLog.create({
            data: {
                level,
                category,
                message: message.slice(0, 500), // Limitar tamanho
                context: context ? JSON.stringify(context).slice(0, 2000) : null,
                stack: stack?.slice(0, 5000) || null,
                route: context?.route as string || null,
                method: context?.method as string || null,
                statusCode: context?.statusCode as number || null,
                duration: context?.duration as number || null,
                userId: context?.userId as string || null,
                userEmail: context?.userEmail as string || null,
                companyId: context?.companyId as string || null,
                ipAddress: context?.ipAddress as string || null,
                userAgent: context?.userAgent as string || null,
            },
        });
    } catch {
        // Silently fail - logs não devem quebrar a aplicação
        console.error('[Logger] Failed to persist log to database');
    }
}

function log(level: LogLevel, message: string, context?: LogContext, category?: LogCategory): void {
    if (!shouldLog(level)) return;

    const timestamp = new Date().toISOString();
    const detectedCategory = category || detectCategory(message);

    // Processar erro se existir no contexto
    let stack: string | undefined;
    if (context?.error) {
        const errorInfo = formatError(context.error);
        context = { ...context, errorMessage: errorInfo.message };
        stack = errorInfo.stack;
        delete context.error;
    }

    const entry: LogEntry = {
        timestamp,
        level,
        message,
        ...(context && Object.keys(context).length > 0 && { context }),
        ...(stack && { stack }),
    };

    // Log para console
    if (process.env.NODE_ENV === 'development') {
        // Logs coloridos e legíveis para dev
        const icons: Record<LogLevel, string> = {
            DEBUG: '🔍',
            INFO: '📘',
            WARNING: '⚠️',
            ERROR: '❌',
            SECURITY: '🔒'
        };
        const colors: Record<LogLevel, string> = {
            DEBUG: '\x1b[36m',  // Cyan
            INFO: '\x1b[32m',   // Green
            WARNING: '\x1b[33m', // Yellow
            ERROR: '\x1b[31m',  // Red
            SECURITY: '\x1b[35m', // Magenta
        };
        const reset = '\x1b[0m';

        const time = timestamp.split('T')[1].split('.')[0]; // HH:MM:SS
        const prefix = `${icons[level]} ${colors[level]}[${time}]${reset}`;

        if (context && Object.keys(context).length > 0) {
            console.log(`${prefix} ${message}`, context);
        } else {
            console.log(`${prefix} ${message}`);
        }

        if (stack) {
            console.log(`${colors.ERROR}${stack}${reset}`);
        }
    } else {
        // JSON para produção (Vercel, DataDog, etc.)
        console.log(JSON.stringify(entry));
    }

    // Salvar no banco para WARNING, ERROR, SECURITY
    if (shouldPersist(level)) {
        // Fire and forget - não bloqueia
        persistLog(level, detectedCategory, message, context, stack).catch(() => { });
    }
}

// ============================================
// API PÚBLICA
// ============================================

export const logger = {
    /**
     * Debug - informações detalhadas para desenvolvimento
     */
    debug: (message: string, context?: LogContext) => log('DEBUG', message, context),

    /**
     * Info - eventos normais de operação
     */
    info: (message: string, context?: LogContext) => log('INFO', message, context),

    /**
     * Warn - situações inesperadas mas não críticas
     */
    warn: (message: string, context?: LogContext) => log('WARNING', message, context),

    /**
     * Error - erros que precisam de atenção
     */
    error: (message: string, context?: LogContext) => log('ERROR', message, context),

    /**
     * Security - eventos de segurança (acesso negado, etc)
     */
    security: (message: string, context?: LogContext) => log('SECURITY', message, context, 'AUTH'),

    /**
     * Log de requisição API
     */
    apiRequest: (method: string, path: string, context?: LogContext) => {
        log('INFO', `${method} ${path}`, { action: 'api_request', route: path, method, ...context }, 'API');
    },

    /**
     * Log de resposta API
     */
    apiResponse: (method: string, path: string, status: number, duration: number, context?: LogContext) => {
        const level: LogLevel = status >= 500 ? 'ERROR' : status >= 400 ? 'WARNING' : 'INFO';
        log(level, `${method} ${path} → ${status}`, {
            action: 'api_response',
            route: path,
            method,
            statusCode: status,
            duration,
            ...context
        }, 'API');
    },

    /**
     * Log de eventos de WhatsApp
     */
    whatsapp: (event: string, context?: LogContext) => {
        log('INFO', `[WhatsApp] ${event}`, { action: 'whatsapp', ...context }, 'WHATSAPP');
    },

    /**
     * Log de eventos de IA
     */
    ai: (event: string, context?: LogContext) => {
        log('INFO', `[AI] ${event}`, { action: 'ai', ...context }, 'AI');
    },

    /**
     * Log de autenticação
     */
    auth: (event: string, context?: LogContext) => {
        const level: LogLevel = event.includes('failed') || event.includes('error') ? 'WARNING' : 'INFO';
        log(level, `[Auth] ${event}`, { action: 'auth', ...context }, 'AUTH');
    },

    /**
     * Log de pagamentos
     */
    payment: (event: string, context?: LogContext) => {
        log('INFO', `[Payment] ${event}`, { action: 'payment', ...context }, 'PAYMENT');
    },

    /**
     * Log de webhook
     */
    webhook: (event: string, context?: LogContext) => {
        log('INFO', `[Webhook] ${event}`, { action: 'webhook', ...context }, 'WEBHOOK');
    },
};

// ============================================
// UTILITÁRIOS
// ============================================

/**
 * Gera um ID único para rastreamento de requisição
 */
export function generateRequestId(): string {
    return `req_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * Mede tempo de execução
 */
export function measureTime(): () => number {
    const start = performance.now();
    return () => Math.round(performance.now() - start);
}

/**
 * Wrapper para logar erros de funções async
 */
export async function withLogging<T>(
    operation: string,
    fn: () => Promise<T>,
    context?: LogContext
): Promise<T> {
    const getElapsed = measureTime();

    try {
        logger.debug(`Starting: ${operation}`, context);
        const result = await fn();
        logger.debug(`Completed: ${operation}`, { ...context, duration: getElapsed() });
        return result;
    } catch (error) {
        logger.error(`Failed: ${operation}`, { ...context, error, duration: getElapsed() });
        throw error;
    }
}
