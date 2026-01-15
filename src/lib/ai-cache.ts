/**
 * AI Response Cache
 * 
 * Cache de respostas para perguntas frequentes.
 * Usa Redis para armazenar respostas e evitar chamadas repetidas à API.
 */

import { redis, isRedisConnected } from "./redis";
import { logger } from "./logger";

// Cache em memória como fallback
const memoryCache = new Map<string, { response: string; timestamp: number }>();
const CACHE_TTL = 60 * 60 * 24 * 7; // 7 dias (otimização de tokens)
const MEMORY_CACHE_TTL = 60 * 60 * 1000; // 1 hora em ms

/**
 * Gera uma chave de cache normalizada a partir da pergunta
 */
function generateCacheKey(companyId: string, question: string): string {
    // Normalizar a pergunta: lowercase, remover pontuação, espaços extras
    const normalized = question
        .toLowerCase()
        .trim()
        .replace(/[^\w\s]/g, "") // Remove pontuação
        .replace(/\s+/g, " ")    // Normaliza espaços
        .substring(0, 100);      // Limita tamanho

    // Gerar hash simples
    let hash = 0;
    for (let i = 0; i < normalized.length; i++) {
        const char = normalized.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash;
    }

    return `ai_cache:${companyId}:${Math.abs(hash)}`;
}

/**
 * Verifica se a pergunta é cacheable (não é muito específica/pessoal)
 */
function isCacheable(question: string): boolean {
    // Perguntas com números específicos não são cacheáveis
    if (/\d{3,}/.test(question)) return false;

    // Perguntas com nomes próprios não são cacheáveis
    if (/meu|minha|nosso|nossa|eu /i.test(question)) return false;

    // Perguntas muito curtas não são cacheáveis
    if (question.length < 10) return false;

    // Perguntas muito longas são específicas demais
    if (question.length > 200) return false;

    return true;
}

/**
 * Busca resposta no cache
 */
export async function getCachedResponse(
    companyId: string,
    question: string
): Promise<string | null> {
    if (!isCacheable(question)) {
        return null;
    }

    const key = generateCacheKey(companyId, question);

    try {
        // Tentar Redis primeiro
        if (redis && await isRedisConnected()) {
            const cached = await redis.get<string>(key);
            if (cached) {
                logger.debug("Cache hit (Redis)", { companyId, key });
                return cached;
            }
        }

        // Fallback para memória
        const memoryCached = memoryCache.get(key);
        if (memoryCached) {
            // Verificar se expirou
            if (Date.now() - memoryCached.timestamp < MEMORY_CACHE_TTL) {
                logger.debug("Cache hit (Memory)", { companyId, key });
                return memoryCached.response;
            } else {
                memoryCache.delete(key);
            }
        }
    } catch (error) {
        logger.warn("Cache read error", { error: error instanceof Error ? error.message : "Unknown" });
    }

    return null;
}

/**
 * Salva resposta no cache
 */
export async function setCachedResponse(
    companyId: string,
    question: string,
    response: string
): Promise<void> {
    if (!isCacheable(question)) {
        return;
    }

    // Não cachear respostas muito curtas ou muito longas
    if (response.length < 20 || response.length > 1000) {
        return;
    }

    const key = generateCacheKey(companyId, question);

    try {
        // Salvar no Redis
        if (redis && await isRedisConnected()) {
            await redis.set(key, response, { ex: CACHE_TTL });
            logger.debug("Cache saved (Redis)", { companyId, key });
        }

        // Também salvar na memória como fallback
        memoryCache.set(key, { response, timestamp: Date.now() });

        // Limpar cache de memória se ficar muito grande
        if (memoryCache.size > 1000) {
            cleanMemoryCache();
        }
    } catch (error) {
        logger.warn("Cache write error", { error: error instanceof Error ? error.message : "Unknown" });
    }
}

/**
 * Limpa entradas expiradas do cache de memória
 */
function cleanMemoryCache(): void {
    const now = Date.now();
    let deleted = 0;

    for (const [key, value] of memoryCache.entries()) {
        if (now - value.timestamp > MEMORY_CACHE_TTL) {
            memoryCache.delete(key);
            deleted++;
        }
    }

    // Se ainda estiver grande, deletar as mais antigas
    if (memoryCache.size > 500) {
        const entries = Array.from(memoryCache.entries())
            .sort((a, b) => a[1].timestamp - b[1].timestamp);

        for (let i = 0; i < 250; i++) {
            memoryCache.delete(entries[i][0]);
            deleted++;
        }
    }

    logger.debug("Memory cache cleaned", { deleted, remaining: memoryCache.size });
}

/**
 * Invalida o cache de uma empresa (ex: quando atualiza treinamento)
 */
export async function invalidateCompanyCache(companyId: string): Promise<void> {
    try {
        // Para Redis, precisaríamos de scan - por enquanto só limpamos memória
        // Em produção, usar padrões de cache com timestamp de invalidação

        for (const key of memoryCache.keys()) {
            if (key.includes(companyId)) {
                memoryCache.delete(key);
            }
        }

        logger.info("Company cache invalidated", { companyId });
    } catch (error) {
        logger.warn("Cache invalidation error", { error: error instanceof Error ? error.message : "Unknown" });
    }
}

/**
 * Estatísticas do cache
 */
export function getCacheStats(): { memorySize: number; oldestEntry: number | null } {
    let oldestEntry: number | null = null;

    for (const value of memoryCache.values()) {
        if (oldestEntry === null || value.timestamp < oldestEntry) {
            oldestEntry = value.timestamp;
        }
    }

    return {
        memorySize: memoryCache.size,
        oldestEntry,
    };
}
