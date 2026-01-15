/**
 * Serviço de Cache com Redis
 * 
 * PARA QUE SERVE:
 * - Cachear dados frequentemente acessados
 * - Reduzir consultas ao banco de dados
 * - Melhorar performance da aplicação
 * 
 * BENEFÍCIOS:
 * - Resposta ~100x mais rápida para dados cacheados
 * - Reduz carga no banco de dados
 * - Melhora experiência do usuário
 * 
 * CONFIGURAÇÃO:
 * Usa REDIS_URL do .env (já configurado para rate limiting)
 */

import { redis, isRedisAvailable } from "./redis";
import { logger } from "./logger";

// ============================================
// TIPOS
// ============================================

interface CacheOptions {
    /** Tempo de expiração em segundos (default: 5 minutos) */
    ttl?: number;
    /** Prefixo para a chave (default: "cache") */
    prefix?: string;
}

interface CacheResult<T> {
    data: T;
    fromCache: boolean;
}

// ============================================
// CONSTANTES
// ============================================

const DEFAULT_TTL = 300; // 5 minutos
const CACHE_PREFIX = "cache";

// ============================================
// FUNÇÕES DE CACHE
// ============================================

/**
 * Buscar do cache
 */
export async function cacheGet<T>(key: string, prefix = CACHE_PREFIX): Promise<T | null> {
    if (!redis) return null;

    try {
        const cacheKey = `${prefix}:${key}`;
        // Upstash already parses JSON automatically
        const cached = await redis.get<T>(cacheKey);

        if (cached !== null) {
            logger.debug("[Cache] HIT", { key: cacheKey });
            return cached;
        }

        logger.debug("[Cache] MISS", { key: cacheKey });
        return null;
    } catch (error) {
        logger.error("[Cache] Error getting cache", { key, error });
        return null;
    }
}

/**
 * Salvar no cache
 */
export async function cacheSet<T>(
    key: string,
    data: T,
    options: CacheOptions = {}
): Promise<boolean> {
    if (!redis) return false;

    try {
        const { ttl = DEFAULT_TTL, prefix = CACHE_PREFIX } = options;
        const cacheKey = `${prefix}:${key}`;

        // Upstash auto-serializes JSON
        await redis.set(cacheKey, data, { ex: ttl });

        logger.debug("[Cache] SET", { key: cacheKey, ttl });
        return true;
    } catch (error) {
        logger.error("[Cache] Error setting cache", { key, error });
        return false;
    }
}

/**
 * Deletar do cache
 */
export async function cacheDelete(key: string, prefix = CACHE_PREFIX): Promise<boolean> {
    if (!redis) return false;

    try {
        const cacheKey = `${prefix}:${key}`;
        await redis.del(cacheKey);

        logger.debug("[Cache] DELETE", { key: cacheKey });
        return true;
    } catch (error) {
        logger.error("[Cache] Error deleting cache", { key, error });
        return false;
    }
}

/**
 * Deletar várias chaves por padrão
 */
export async function cacheDeletePattern(pattern: string, prefix = CACHE_PREFIX): Promise<number> {
    if (!redis) return 0;

    try {
        const fullPattern = `${prefix}:${pattern}`;
        const keys = await redis.keys(fullPattern);

        if (keys.length === 0) return 0;

        await Promise.all(keys.map((key) => redis!.del(key)));

        logger.debug("[Cache] DELETE PATTERN", { pattern: fullPattern, count: keys.length });
        return keys.length;
    } catch (error) {
        logger.error("[Cache] Error deleting pattern", { pattern, error });
        return 0;
    }
}

/**
 * Buscar ou criar cache (pattern mais comum)
 * 
 * USO:
 * const plans = await cacheGetOrSet("plans:all", async () => {
 *     return await prisma.plan.findMany();
 * }, { ttl: 3600 });
 */
export async function cacheGetOrSet<T>(
    key: string,
    fetchFn: () => Promise<T>,
    options: CacheOptions = {}
): Promise<CacheResult<T>> {
    // Tentar buscar do cache
    const cached = await cacheGet<T>(key, options.prefix);

    if (cached !== null) {
        return { data: cached, fromCache: true };
    }

    // Executar função para buscar dados
    const data = await fetchFn();

    // Salvar no cache
    await cacheSet(key, data, options);

    return { data, fromCache: false };
}

// ============================================
// HELPERS ESPECÍFICOS
// ============================================

/**
 * Cache de planos (raramente muda)
 */
export async function cachePlans<T>(fetchFn: () => Promise<T>): Promise<T> {
    const result = await cacheGetOrSet("plans:all", fetchFn, { ttl: 3600 }); // 1 hora
    return result.data;
}

/**
 * Cache de dados da empresa
 */
export async function cacheCompany<T>(
    companyId: string,
    fetchFn: () => Promise<T>
): Promise<T> {
    const result = await cacheGetOrSet(`company:${companyId}`, fetchFn, { ttl: 600 }); // 10 min
    return result.data;
}

/**
 * Cache de usuário
 */
export async function cacheUser<T>(
    userId: string,
    fetchFn: () => Promise<T>
): Promise<T> {
    const result = await cacheGetOrSet(`user:${userId}`, fetchFn, { ttl: 300 }); // 5 min
    return result.data;
}

/**
 * Invalidar cache de empresa (quando dados mudam)
 */
export async function invalidateCompanyCache(companyId: string): Promise<void> {
    await cacheDeletePattern(`company:${companyId}*`);
}

/**
 * Invalidar cache de usuário
 */
export async function invalidateUserCache(userId: string): Promise<void> {
    await cacheDelete(`user:${userId}`);
}

/**
 * Invalidar cache de planos
 */
export async function invalidatePlansCache(): Promise<void> {
    await cacheDeletePattern("plans:*");
}

/**
 * Cache de Training Data do agente (muda raramente)
 * TTL: 30 minutos
 */
export async function cacheTrainingData<T>(
    agentId: string,
    fetchFn: () => Promise<T>
): Promise<T> {
    const result = await cacheGetOrSet(`training:${agentId}`, fetchFn, { ttl: 1800 }); // 30 min
    return result.data;
}

/**
 * Cache de Agente (configurações mudam raramente)
 * TTL: 10 minutos
 */
export async function cacheAgent<T>(
    agentId: string,
    fetchFn: () => Promise<T>
): Promise<T> {
    const result = await cacheGetOrSet(`agent:${agentId}`, fetchFn, { ttl: 600 }); // 10 min
    return result.data;
}

/**
 * Invalidar cache de training data (quando dados são atualizados)
 */
export async function invalidateTrainingDataCache(agentId: string): Promise<void> {
    await cacheDelete(`training:${agentId}`);
}

/**
 * Invalidar cache de agente
 */
export async function invalidateAgentCache(agentId: string): Promise<void> {
    await cacheDelete(`agent:${agentId}`);
}

// ============================================
// VERIFICAÇÃO
// ============================================

/**
 * Verifica se Redis está disponível para cache
 */
export function isCacheAvailable(): boolean {
    return isRedisAvailable();
}
