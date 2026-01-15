/**
 * Rate Limiter - Proteção contra abuso de APIs
 * 
 * Usa Redis (Upstash) em produção para rate limiting distribuído.
 * Fallback para memória local se Redis não estiver disponível.
 */

import { NextResponse } from "next/server";
import { isRedisAvailable, redisIncr, redisTTL, redisExpire } from "./redis";
import { logger } from "./logger";

// ============================================
// TIPOS
// ============================================

interface RateLimitConfig {
    windowMs: number;      // Janela de tempo em ms (ex: 60000 = 1 min)
    maxRequests: number;   // Máximo de requests na janela
}

interface RateLimitResult {
    allowed: boolean;
    remaining: number;
    resetIn: number;
    retryAfter?: number;   // Segundos para retry (se bloqueado)
}

// ============================================
// FALLBACK EM MEMÓRIA
// ============================================

interface RateLimitEntry {
    count: number;
    resetTime: number;
}

// Store em memória (usado como fallback)
const memoryStore = new Map<string, RateLimitEntry>();
let cleanupCounter = 0;
const CLEANUP_INTERVAL = 1000;

function cleanupExpired(): void {
    const now = Date.now();
    for (const [key, entry] of memoryStore.entries()) {
        if (now > entry.resetTime) {
            memoryStore.delete(key);
        }
    }
}

function checkRateLimitMemory(identifier: string, config: RateLimitConfig): RateLimitResult {
    const now = Date.now();

    // Cleanup periódico
    cleanupCounter++;
    if (cleanupCounter >= CLEANUP_INTERVAL) {
        cleanupCounter = 0;
        cleanupExpired();
    }

    const entry = memoryStore.get(identifier);

    // Nova janela ou janela expirada
    if (!entry || now > entry.resetTime) {
        memoryStore.set(identifier, {
            count: 1,
            resetTime: now + config.windowMs,
        });
        return {
            allowed: true,
            remaining: config.maxRequests - 1,
            resetIn: config.windowMs
        };
    }

    // Limite atingido
    if (entry.count >= config.maxRequests) {
        const retryAfter = Math.ceil((entry.resetTime - now) / 1000);
        return {
            allowed: false,
            remaining: 0,
            resetIn: entry.resetTime - now,
            retryAfter
        };
    }

    // Incrementar contador
    entry.count++;
    return {
        allowed: true,
        remaining: config.maxRequests - entry.count,
        resetIn: entry.resetTime - now
    };
}

// ============================================
// RATE LIMIT COM REDIS
// ============================================

async function checkRateLimitRedis(identifier: string, config: RateLimitConfig): Promise<RateLimitResult> {
    const key = `ratelimit:${identifier}`;
    const windowSeconds = Math.ceil(config.windowMs / 1000);

    try {
        // Incrementar contador
        const count = await redisIncr(key);

        if (count === null) {
            // Redis falhou, fallback para memória
            logger.warn('[RateLimit] Redis falhou, usando fallback em memória');
            return checkRateLimitMemory(identifier, config);
        }

        // Se for a primeira request, definir TTL
        if (count === 1) {
            await redisExpire(key, windowSeconds);
        }

        // Obter TTL restante
        let ttl = await redisTTL(key);
        if (ttl === null || ttl < 0) {
            ttl = windowSeconds;
        }

        const resetIn = ttl * 1000;

        // Verificar limite
        if (count > config.maxRequests) {
            return {
                allowed: false,
                remaining: 0,
                resetIn,
                retryAfter: ttl
            };
        }

        return {
            allowed: true,
            remaining: config.maxRequests - count,
            resetIn
        };
    } catch (error) {
        logger.error('[RateLimit] Erro no Redis, usando fallback', { error });
        return checkRateLimitMemory(identifier, config);
    }
}

// ============================================
// FUNÇÃO PRINCIPAL
// ============================================

/**
 * Verifica se uma requisição está dentro do limite
 * Usa Redis se disponível, caso contrário usa memória
 */
export async function checkRateLimit(identifier: string, config: RateLimitConfig): Promise<RateLimitResult> {
    if (isRedisAvailable()) {
        return checkRateLimitRedis(identifier, config);
    }
    return checkRateLimitMemory(identifier, config);
}

/**
 * Versão síncrona para compatibilidade (usa apenas memória)
 * @deprecated Use checkRateLimit async quando possível
 */
export function checkRateLimitSync(identifier: string, config: RateLimitConfig): RateLimitResult {
    return checkRateLimitMemory(identifier, config);
}

// ============================================
// HELPERS
// ============================================

/**
 * Extrai identificador do cliente (IP ou userId)
 */
export function getClientIdentifier(request: Request, userId?: string): string {
    // Preferir userId se autenticado
    if (userId) {
        return `user:${userId}`;
    }

    // Fallback para IP
    const forwarded = request.headers.get('x-forwarded-for');
    const ip = forwarded
        ? forwarded.split(',')[0].trim()
        : request.headers.get('x-real-ip') || 'unknown';

    return `ip:${ip}`;
}

/**
 * Cria headers de rate limit para a resposta
 */
export function getRateLimitHeaders(result: RateLimitResult, config: RateLimitConfig): Record<string, string> {
    return {
        'X-RateLimit-Limit': config.maxRequests.toString(),
        'X-RateLimit-Remaining': result.remaining.toString(),
        'X-RateLimit-Reset': Math.ceil(result.resetIn / 1000).toString(),
        ...(result.retryAfter && { 'Retry-After': result.retryAfter.toString() }),
    };
}

// ============================================
// PRESETS DE RATE LIMIT
// ============================================

export const RATE_LIMITS = {
    // Autenticação - mais restritivo para prevenir brute force
    auth: {
        windowMs: 60 * 1000,    // 1 minuto
        maxRequests: 10         // 10 tentativas/min
    },

    // APIs gerais (CRUD)
    api: {
        windowMs: 60 * 1000,    // 1 minuto
        maxRequests: 100        // 100 req/min
    },

    // Webhooks (recebem muitas chamadas)
    webhook: {
        windowMs: 1000,         // 1 segundo
        maxRequests: 50         // 50 req/seg
    },

    // OpenAI/IA (custo alto)
    ai: {
        windowMs: 60 * 1000,    // 1 minuto
        maxRequests: 30         // 30 req/min
    },

    // Admin (mais permissivo)
    admin: {
        windowMs: 60 * 1000,    // 1 minuto
        maxRequests: 200        // 200 req/min
    },

    // Upload de arquivos
    upload: {
        windowMs: 60 * 1000,    // 1 minuto
        maxRequests: 20         // 20 uploads/min
    },
} as const;

// ============================================
// MIDDLEWARE HELPER
// ============================================

/**
 * Middleware de rate limiting para usar em rotas
 * Retorna null se permitido, ou Response se bloqueado
 */
export async function rateLimitMiddleware(
    request: Request,
    preset: keyof typeof RATE_LIMITS,
    userId?: string
): Promise<NextResponse | null> {
    const config = RATE_LIMITS[preset];
    const identifier = getClientIdentifier(request, userId);
    const result = await checkRateLimit(`${preset}:${identifier}`, config);

    if (!result.allowed) {
        const headers = getRateLimitHeaders(result, config);
        return NextResponse.json(
            {
                success: false,
                error: "Muitas requisições. Tente novamente em alguns segundos.",
                retryAfter: result.retryAfter
            },
            {
                status: 429,
                headers
            }
        );
    }

    return null; // Permitido
}
