/**
 * Redis Client - Upstash
 * 
 * Cliente Redis configurado para Upstash (serverless Redis).
 * Funciona tanto em Edge Runtime quanto em Node.js.
 * 
 * CONFIGURAÇÃO:
 * Adicione ao .env:
 *   UPSTASH_REDIS_REST_URL=https://your-url.upstash.io
 *   UPSTASH_REDIS_REST_TOKEN=your-token
 * 
 * FALLBACK:
 * Se as variáveis não estiverem configuradas, exporta null
 * e os componentes que usam Redis devem ter fallback.
 */

import { Redis } from '@upstash/redis';
import { logger } from './logger';

// ============================================
// CONFIGURAÇÃO
// ============================================

const REDIS_URL = process.env.UPSTASH_REDIS_REST_URL;
const REDIS_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;

// Verificar se as variáveis estão configuradas
const isConfigured = Boolean(REDIS_URL && REDIS_TOKEN);

// ============================================
// CLIENTE REDIS
// ============================================

let redis: Redis | null = null;

if (isConfigured) {
    try {
        redis = new Redis({
            url: REDIS_URL!,
            token: REDIS_TOKEN!,
        });
        logger.info('[Redis] Cliente Upstash configurado com sucesso');
    } catch (error) {
        logger.error('[Redis] Erro ao criar cliente', { error });
    }
} else {
    logger.warn('[Redis] Variáveis UPSTASH_REDIS_REST_URL e UPSTASH_REDIS_REST_TOKEN não configuradas. Usando fallback em memória.');
}

// ============================================
// FUNÇÕES HELPER
// ============================================

/**
 * Verifica se o Redis está disponível
 */
export function isRedisAvailable(): boolean {
    return redis !== null;
}

/**
 * Verifica se o Redis está conectado (alias para testRedisConnection)
 */
export async function isRedisConnected(): Promise<boolean> {
    return testRedisConnection();
}

/**
 * Testa a conexão com o Redis
 */
export async function testRedisConnection(): Promise<boolean> {
    if (!redis) return false;

    try {
        await redis.ping();
        return true;
    } catch (error) {
        logger.error('[Redis] Erro no teste de conexão', { error });
        return false;
    }
}

/**
 * Get com tipagem genérica
 */
export async function redisGet<T>(key: string): Promise<T | null> {
    if (!redis) return null;

    try {
        const value = await redis.get<T>(key);
        return value;
    } catch (error) {
        logger.error('[Redis] Erro no GET', { key, error });
        return null;
    }
}

/**
 * Set com TTL opcional
 */
export async function redisSet<T>(
    key: string,
    value: T,
    ttlSeconds?: number
): Promise<boolean> {
    if (!redis) return false;

    try {
        if (ttlSeconds) {
            await redis.set(key, value, { ex: ttlSeconds });
        } else {
            await redis.set(key, value);
        }
        return true;
    } catch (error) {
        logger.error('[Redis] Erro no SET', { key, error });
        return false;
    }
}

/**
 * Delete
 */
export async function redisDel(key: string): Promise<boolean> {
    if (!redis) return false;

    try {
        await redis.del(key);
        return true;
    } catch (error) {
        logger.error('[Redis] Erro no DEL', { key, error });
        return false;
    }
}

/**
 * Increment (útil para rate limiting)
 */
export async function redisIncr(key: string): Promise<number | null> {
    if (!redis) return null;

    try {
        return await redis.incr(key);
    } catch (error) {
        logger.error('[Redis] Erro no INCR', { key, error });
        return null;
    }
}

/**
 * Set expiration
 */
export async function redisExpire(key: string, seconds: number): Promise<boolean> {
    if (!redis) return false;

    try {
        await redis.expire(key, seconds);
        return true;
    } catch (error) {
        logger.error('[Redis] Erro no EXPIRE', { key, error });
        return false;
    }
}

/**
 * Get TTL remaining
 */
export async function redisTTL(key: string): Promise<number | null> {
    if (!redis) return null;

    try {
        return await redis.ttl(key);
    } catch (error) {
        logger.error('[Redis] Erro no TTL', { key, error });
        return null;
    }
}

/**
 * Delete keys by pattern
 */
export async function redisDelPattern(pattern: string): Promise<number> {
    if (!redis) return 0;

    try {
        const keys = await redis.keys(pattern);
        if (keys.length === 0) return 0;

        await Promise.all(keys.map(key => redis!.del(key)));
        return keys.length;
    } catch (error) {
        logger.error('[Redis] Erro no DEL pattern', { pattern, error });
        return 0;
    }
}

// ============================================
// EXPORT
// ============================================

export { redis };
