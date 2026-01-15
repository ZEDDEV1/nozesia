/**
 * Tests for lib/rate-limit.ts
 * 
 * Testa o Rate Limiting que protege contra abuso de APIs.
 * 
 * PARA QUE SERVE:
 * - Previne ataques de brute force
 * - Protege recursos do servidor
 * - Garante fairness entre clientes
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
    checkRateLimit,
    checkRateLimitSync,
    getClientIdentifier,
    getRateLimitHeaders,
    RATE_LIMITS,
} from '@/lib/rate-limit';

// Mock do logger
vi.mock('@/lib/logger', () => ({
    logger: {
        info: vi.fn(),
        error: vi.fn(),
        warn: vi.fn(),
        debug: vi.fn(),
    },
}));

// Mock do Redis (para testar fallback de memória)
vi.mock('@/lib/redis', () => ({
    isRedisAvailable: vi.fn(() => false), // Por padrão, usar memória
    redisIncr: vi.fn(),
    redisTTL: vi.fn(),
    redisExpire: vi.fn(),
}));

// ============================================
// HELPER FUNCTIONS
// ============================================

const createMockRequest = (options: {
    ip?: string;
    forwardedFor?: string;
    realIp?: string;
} = {}) => {
    const headers = new Headers();
    if (options.forwardedFor) {
        headers.set('x-forwarded-for', options.forwardedFor);
    }
    if (options.realIp) {
        headers.set('x-real-ip', options.realIp);
    }

    return {
        headers,
    } as unknown as Request;
};

// ============================================
// VERIFICAÇÃO DE RATE LIMIT (MEMÓRIA)
// ============================================

describe('checkRateLimitSync - Verificação Básica', () => {
    beforeEach(() => {
        // Limpar estado entre testes usando um identificador único
        vi.useFakeTimers();
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it('should allow first request', () => {
        const identifier = `test-${Date.now()}-${Math.random()}`;
        const result = checkRateLimitSync(identifier, {
            windowMs: 60000,
            maxRequests: 10,
        });

        expect(result.allowed).toBe(true);
        expect(result.remaining).toBe(9);
    });

    it('should track remaining requests', () => {
        const identifier = `test-${Date.now()}-${Math.random()}`;
        const config = { windowMs: 60000, maxRequests: 5 };

        const r1 = checkRateLimitSync(identifier, config);
        expect(r1.remaining).toBe(4);

        const r2 = checkRateLimitSync(identifier, config);
        expect(r2.remaining).toBe(3);

        const r3 = checkRateLimitSync(identifier, config);
        expect(r3.remaining).toBe(2);
    });

    it('should block after limit reached', () => {
        const identifier = `test-${Date.now()}-${Math.random()}`;
        const config = { windowMs: 60000, maxRequests: 3 };

        // Fazer 3 requests (limite)
        checkRateLimitSync(identifier, config);
        checkRateLimitSync(identifier, config);
        checkRateLimitSync(identifier, config);

        // 4ª request deve ser bloqueada
        const result = checkRateLimitSync(identifier, config);
        expect(result.allowed).toBe(false);
        expect(result.remaining).toBe(0);
    });

    it('should have retryAfter when blocked', () => {
        const identifier = `test-${Date.now()}-${Math.random()}`;
        const config = { windowMs: 60000, maxRequests: 1 };

        // Primeira request OK
        checkRateLimitSync(identifier, config);

        // Segunda deve ser bloqueada com retryAfter
        const result = checkRateLimitSync(identifier, config);
        expect(result.allowed).toBe(false);
        expect(result.retryAfter).toBeDefined();
        expect(result.retryAfter).toBeGreaterThan(0);
    });
});

// ============================================
// JANELA DE TEMPO
// ============================================

describe('checkRateLimitSync - Janela de Tempo', () => {
    beforeEach(() => {
        vi.useFakeTimers();
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it('should reset after window expires', () => {
        const identifier = `test-${Date.now()}-${Math.random()}`;
        const config = { windowMs: 10000, maxRequests: 2 }; // 10 segundos

        // Usar todo o limite
        checkRateLimitSync(identifier, config);
        checkRateLimitSync(identifier, config);

        // Deve estar bloqueado
        let result = checkRateLimitSync(identifier, config);
        expect(result.allowed).toBe(false);

        // Avançar além da janela
        vi.advanceTimersByTime(10001);

        // Agora deve permitir novamente
        result = checkRateLimitSync(identifier, config);
        expect(result.allowed).toBe(true);
        expect(result.remaining).toBe(1);
    });

    it('should provide correct resetIn time', () => {
        const identifier = `test-${Date.now()}-${Math.random()}`;
        const config = { windowMs: 60000, maxRequests: 10 };

        const result = checkRateLimitSync(identifier, config);

        // resetIn deve ser aproximadamente a janela completa
        expect(result.resetIn).toBeLessThanOrEqual(60000);
        expect(result.resetIn).toBeGreaterThan(59000);
    });
});

// ============================================
// IDENTIFICADORES DIFERENTES
// ============================================

describe('checkRateLimitSync - Identificadores Isolados', () => {
    beforeEach(() => {
        vi.useFakeTimers();
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it('should track limits separately per identifier', () => {
        const user1 = `user1-${Date.now()}`;
        const user2 = `user2-${Date.now()}`;
        const config = { windowMs: 60000, maxRequests: 2 };

        // User1 usa todo o limite
        checkRateLimitSync(user1, config);
        checkRateLimitSync(user1, config);

        const user1Result = checkRateLimitSync(user1, config);
        expect(user1Result.allowed).toBe(false);

        // User2 ainda tem limite
        const user2Result = checkRateLimitSync(user2, config);
        expect(user2Result.allowed).toBe(true);
        expect(user2Result.remaining).toBe(1);
    });
});

// ============================================
// checkRateLimit ASYNC
// ============================================

describe('checkRateLimit - Async (Fallback para Memória)', () => {
    beforeEach(() => {
        vi.useFakeTimers();
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it('should work with async API', async () => {
        const identifier = `async-${Date.now()}-${Math.random()}`;
        const config = { windowMs: 60000, maxRequests: 5 };

        const result = await checkRateLimit(identifier, config);

        expect(result.allowed).toBe(true);
        expect(result.remaining).toBe(4);
    });

    it('should block after limit with async API', async () => {
        const identifier = `async-${Date.now()}-${Math.random()}`;
        const config = { windowMs: 60000, maxRequests: 2 };

        await checkRateLimit(identifier, config);
        await checkRateLimit(identifier, config);

        const result = await checkRateLimit(identifier, config);
        expect(result.allowed).toBe(false);
    });
});

// ============================================
// getClientIdentifier
// ============================================

describe('getClientIdentifier', () => {
    it('should prefer userId when provided', () => {
        const request = createMockRequest({ forwardedFor: '192.168.1.1' });

        const identifier = getClientIdentifier(request, 'user-123');

        expect(identifier).toBe('user:user-123');
    });

    it('should use x-forwarded-for IP when no userId', () => {
        const request = createMockRequest({ forwardedFor: '10.0.0.1' });

        const identifier = getClientIdentifier(request);

        expect(identifier).toBe('ip:10.0.0.1');
    });

    it('should use first IP from x-forwarded-for chain', () => {
        const request = createMockRequest({ forwardedFor: '1.2.3.4, 5.6.7.8, 9.10.11.12' });

        const identifier = getClientIdentifier(request);

        expect(identifier).toBe('ip:1.2.3.4');
    });

    it('should use x-real-ip as fallback', () => {
        const request = createMockRequest({ realIp: '172.16.0.1' });

        const identifier = getClientIdentifier(request);

        expect(identifier).toBe('ip:172.16.0.1');
    });

    it('should return unknown when no IP headers', () => {
        const request = createMockRequest({});

        const identifier = getClientIdentifier(request);

        expect(identifier).toBe('ip:unknown');
    });

    it('should trim IP addresses', () => {
        const request = createMockRequest({ forwardedFor: '  192.168.1.1  ' });

        const identifier = getClientIdentifier(request);

        expect(identifier).toBe('ip:192.168.1.1');
    });
});

// ============================================
// getRateLimitHeaders
// ============================================

describe('getRateLimitHeaders', () => {
    it('should include all required headers', () => {
        const result = {
            allowed: true,
            remaining: 50,
            resetIn: 30000,
        };
        const config = { windowMs: 60000, maxRequests: 100 };

        const headers = getRateLimitHeaders(result, config);

        expect(headers['X-RateLimit-Limit']).toBe('100');
        expect(headers['X-RateLimit-Remaining']).toBe('50');
        expect(headers['X-RateLimit-Reset']).toBe('30');
    });

    it('should include Retry-After when provided', () => {
        const result = {
            allowed: false,
            remaining: 0,
            resetIn: 45000,
            retryAfter: 45,
        };
        const config = { windowMs: 60000, maxRequests: 10 };

        const headers = getRateLimitHeaders(result, config);

        expect(headers['Retry-After']).toBe('45');
    });

    it('should not include Retry-After when not blocked', () => {
        const result = {
            allowed: true,
            remaining: 5,
            resetIn: 60000,
        };
        const config = { windowMs: 60000, maxRequests: 10 };

        const headers = getRateLimitHeaders(result, config);

        expect(headers['Retry-After']).toBeUndefined();
    });
});

// ============================================
// RATE_LIMITS PRESETS
// ============================================

describe('RATE_LIMITS - Presets', () => {
    it('auth preset should be restrictive (brute force protection)', () => {
        expect(RATE_LIMITS.auth.maxRequests).toBe(10);
        expect(RATE_LIMITS.auth.windowMs).toBe(60000);
    });

    it('api preset should have reasonable limits', () => {
        expect(RATE_LIMITS.api.maxRequests).toBe(100);
        expect(RATE_LIMITS.api.windowMs).toBe(60000);
    });

    it('webhook preset should handle high volume', () => {
        expect(RATE_LIMITS.webhook.maxRequests).toBe(50);
        expect(RATE_LIMITS.webhook.windowMs).toBe(1000); // Por segundo
    });

    it('ai preset should be limited (high cost)', () => {
        expect(RATE_LIMITS.ai.maxRequests).toBe(30);
        expect(RATE_LIMITS.ai.windowMs).toBe(60000);
    });

    it('admin preset should be more permissive', () => {
        expect(RATE_LIMITS.admin.maxRequests).toBe(200);
        expect(RATE_LIMITS.admin.windowMs).toBe(60000);
    });

    it('upload preset should be limited', () => {
        expect(RATE_LIMITS.upload.maxRequests).toBe(20);
        expect(RATE_LIMITS.upload.windowMs).toBe(60000);
    });
});

// ============================================
// EDGE CASES
// ============================================

describe('Rate Limit - Edge Cases', () => {
    beforeEach(() => {
        vi.useFakeTimers();
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it('should handle maxRequests = 1', () => {
        const identifier = `edge-${Date.now()}-${Math.random()}`;
        const config = { windowMs: 60000, maxRequests: 1 };

        const r1 = checkRateLimitSync(identifier, config);
        expect(r1.allowed).toBe(true);
        expect(r1.remaining).toBe(0);

        const r2 = checkRateLimitSync(identifier, config);
        expect(r2.allowed).toBe(false);
    });

    it('should handle very short window', () => {
        const identifier = `edge-${Date.now()}-${Math.random()}`;
        const config = { windowMs: 100, maxRequests: 2 }; // 100ms

        checkRateLimitSync(identifier, config);
        checkRateLimitSync(identifier, config);

        let result = checkRateLimitSync(identifier, config);
        expect(result.allowed).toBe(false);

        // Avançar 100ms
        vi.advanceTimersByTime(101);

        result = checkRateLimitSync(identifier, config);
        expect(result.allowed).toBe(true);
    });

    it('should handle concurrent requests correctly', () => {
        const identifier = `concurrent-${Date.now()}-${Math.random()}`;
        const config = { windowMs: 60000, maxRequests: 100 };

        // Simular 100 requests "simultâneas"
        const results: boolean[] = [];
        for (let i = 0; i < 110; i++) {
            const result = checkRateLimitSync(identifier, config);
            results.push(result.allowed);
        }

        // Primeiras 100 devem ser permitidas
        const allowed = results.filter(r => r === true).length;
        const blocked = results.filter(r => r === false).length;

        expect(allowed).toBe(100);
        expect(blocked).toBe(10);
    });
});
