/**
 * Tests for lib/retry.ts
 * 
 * Testa o Retry Pattern com exponential backoff para chamadas externas.
 * 
 * PARA QUE SERVE:
 * - Quando APIs externas falham temporariamente
 * - O sistema tenta de novo automaticamente
 * - Usa exponential backoff (1s → 2s → 4s)
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
    retry,
    retryWithResult,
    retryOpenAI,
    retryWPPConnect,
    OPENAI_RETRY_OPTIONS,
    WPPCONNECT_RETRY_OPTIONS,
    WEBHOOK_RETRY_OPTIONS,
} from '@/lib/retry';

// Mock do logger para não poluir output dos testes
vi.mock('@/lib/logger', () => ({
    logger: {
        info: vi.fn(),
        error: vi.fn(),
        warn: vi.fn(),
        debug: vi.fn(),
    },
}));

// ============================================
// HELPER FUNCTIONS
// ============================================

const createSuccessFn = (value = 'success') => vi.fn().mockResolvedValue(value);
const createFailFn = (message = 'Service failed') => vi.fn().mockRejectedValue(new Error(message));

// Função que falha N vezes e depois tem sucesso
const createFailThenSuccessFn = (failCount: number, successValue = 'success') => {
    let attempts = 0;
    return vi.fn().mockImplementation(() => {
        attempts++;
        if (attempts <= failCount) {
            return Promise.reject(new Error(`Attempt ${attempts} failed`));
        }
        return Promise.resolve(successValue);
    });
};

// ============================================
// RETRY - SUCESSO NA PRIMEIRA TENTATIVA
// ============================================

describe('retry - Sucesso na primeira tentativa', () => {
    beforeEach(() => {
        vi.useFakeTimers();
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it('should return result on first successful attempt', async () => {
        const fn = createSuccessFn('data');

        const result = await retry(fn, { maxRetries: 3 });

        expect(result).toBe('data');
        expect(fn).toHaveBeenCalledTimes(1);
    });

    it('should not call onRetry when first attempt succeeds', async () => {
        const fn = createSuccessFn();
        const onRetry = vi.fn();

        await retry(fn, { maxRetries: 3, onRetry });

        expect(onRetry).not.toHaveBeenCalled();
    });
});

// ============================================
// RETRY - FALHA E RETRY
// ============================================

describe('retry - Falha e Retry', () => {
    beforeEach(() => {
        vi.useFakeTimers();
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it('should retry after failure', async () => {
        const fn = createFailThenSuccessFn(1);

        const promise = retry(fn, { maxRetries: 3, initialDelay: 100 });

        // Avançar tempo para o retry
        await vi.advanceTimersByTimeAsync(100);

        const result = await promise;

        expect(result).toBe('success');
        expect(fn).toHaveBeenCalledTimes(2);
    });

    it('should call onRetry callback on failure', async () => {
        const fn = createFailThenSuccessFn(1);
        const onRetry = vi.fn();

        const promise = retry(fn, { maxRetries: 3, initialDelay: 100, onRetry });

        await vi.advanceTimersByTimeAsync(100);
        await promise;

        expect(onRetry).toHaveBeenCalledTimes(1);
        expect(onRetry).toHaveBeenCalledWith(expect.any(Error), 1);
    });

    it('should throw after all retries exhausted', async () => {
        const fn = createFailFn('Permanent failure');

        const promise = retry(fn, { maxRetries: 2, initialDelay: 100 });

        // Avançar tempo para todos os retries
        await vi.advanceTimersByTimeAsync(100); // 1º retry
        await vi.advanceTimersByTimeAsync(200); // 2º retry

        await expect(promise).rejects.toThrow('Permanent failure');
        expect(fn).toHaveBeenCalledTimes(3); // 1 inicial + 2 retries
    });
});

// ============================================
// EXPONENTIAL BACKOFF
// ============================================

describe('retry - Exponential Backoff', () => {
    beforeEach(() => {
        vi.useFakeTimers();
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it('should use exponential backoff for delays', async () => {
        const fn = createFailFn();

        const promise = retry(fn, {
            maxRetries: 3,
            initialDelay: 100,
            backoffFactor: 2,
        });

        // Primeira tentativa falha imediatamente
        expect(fn).toHaveBeenCalledTimes(1);

        // Avançar 100ms para primeiro retry
        await vi.advanceTimersByTimeAsync(100);
        expect(fn).toHaveBeenCalledTimes(2);

        // Avançar 200ms (100 * 2) para segundo retry
        await vi.advanceTimersByTimeAsync(200);
        expect(fn).toHaveBeenCalledTimes(3);

        // Avançar 400ms (200 * 2) para terceiro retry
        await vi.advanceTimersByTimeAsync(400);
        expect(fn).toHaveBeenCalledTimes(4);

        await expect(promise).rejects.toThrow();
    });

    it('should respect maxDelay limit', async () => {
        const fn = createFailFn();

        const promise = retry(fn, {
            maxRetries: 3,
            initialDelay: 5000,
            backoffFactor: 3,
            maxDelay: 6000, // Limita delay máximo
        });

        // Primeira tentativa
        expect(fn).toHaveBeenCalledTimes(1);

        // 5000ms para primeiro retry
        await vi.advanceTimersByTimeAsync(5000);
        expect(fn).toHaveBeenCalledTimes(2);

        // Próximo delay seria 15000ms mas limitado a 6000ms
        await vi.advanceTimersByTimeAsync(6000);
        expect(fn).toHaveBeenCalledTimes(3);

        await vi.advanceTimersByTimeAsync(6000);
        expect(fn).toHaveBeenCalledTimes(4);

        await expect(promise).rejects.toThrow();
    });
});

// ============================================
// SHOULDRETRY
// ============================================

describe('retry - shouldRetry', () => {
    beforeEach(() => {
        vi.useFakeTimers();
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it('should not retry when shouldRetry returns false', async () => {
        const fn = createFailFn('Do not retry this');
        const shouldRetry = vi.fn().mockReturnValue(false);

        await expect(
            retry(fn, { maxRetries: 3, shouldRetry })
        ).rejects.toThrow('Do not retry this');

        expect(fn).toHaveBeenCalledTimes(1);
        expect(shouldRetry).toHaveBeenCalledWith(expect.any(Error));
    });

    it('should retry when shouldRetry returns true', async () => {
        const fn = createFailThenSuccessFn(1);
        const shouldRetry = vi.fn().mockReturnValue(true);

        const promise = retry(fn, {
            maxRetries: 3,
            initialDelay: 100,
            shouldRetry,
        });

        await vi.advanceTimersByTimeAsync(100);

        const result = await promise;
        expect(result).toBe('success');
        expect(fn).toHaveBeenCalledTimes(2);
    });
});

// ============================================
// RETRYWITHRESULT
// ============================================

describe('retryWithResult', () => {
    beforeEach(() => {
        vi.useFakeTimers();
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it('should return success result with data', async () => {
        const fn = createSuccessFn('data');

        const result = await retryWithResult(fn, { maxRetries: 3 });

        expect(result.success).toBe(true);
        expect(result.data).toBe('data');
        expect(result.attempts).toBe(1);
    });

    it('should return failure result with error', async () => {
        const fn = createFailFn('Failed');

        const promise = retryWithResult(fn, { maxRetries: 2, initialDelay: 100 });

        await vi.advanceTimersByTimeAsync(100);
        await vi.advanceTimersByTimeAsync(200);

        const result = await promise;

        expect(result.success).toBe(false);
        expect(result.error?.message).toBe('Failed');
        expect(result.attempts).toBe(3);
    });

    it('should track correct number of attempts', async () => {
        const fn = createFailThenSuccessFn(2);

        const promise = retryWithResult(fn, { maxRetries: 3, initialDelay: 100 });

        await vi.advanceTimersByTimeAsync(100);
        await vi.advanceTimersByTimeAsync(200);

        const result = await promise;

        expect(result.success).toBe(true);
        expect(result.attempts).toBe(3);
    });
});

// ============================================
// PRESETS DE RETRY
// ============================================

describe('Retry Presets - Configurações', () => {
    it('OPENAI_RETRY_OPTIONS should have correct configuration', () => {
        expect(OPENAI_RETRY_OPTIONS.maxRetries).toBe(3);
        expect(OPENAI_RETRY_OPTIONS.initialDelay).toBe(1000);
        expect(OPENAI_RETRY_OPTIONS.backoffFactor).toBe(2);
        expect(OPENAI_RETRY_OPTIONS.maxDelay).toBe(8000);
        expect(OPENAI_RETRY_OPTIONS.shouldRetry).toBeDefined();
        expect(OPENAI_RETRY_OPTIONS.onRetry).toBeDefined();
    });

    it('WPPCONNECT_RETRY_OPTIONS should have correct configuration', () => {
        expect(WPPCONNECT_RETRY_OPTIONS.maxRetries).toBe(2);
        expect(WPPCONNECT_RETRY_OPTIONS.initialDelay).toBe(500);
        expect(WPPCONNECT_RETRY_OPTIONS.backoffFactor).toBe(2);
        expect(WPPCONNECT_RETRY_OPTIONS.maxDelay).toBe(2000);
        expect(WPPCONNECT_RETRY_OPTIONS.shouldRetry).toBeDefined();
    });

    it('WEBHOOK_RETRY_OPTIONS should have correct configuration', () => {
        expect(WEBHOOK_RETRY_OPTIONS.maxRetries).toBe(3);
        expect(WEBHOOK_RETRY_OPTIONS.initialDelay).toBe(2000);
        expect(WEBHOOK_RETRY_OPTIONS.backoffFactor).toBe(2);
        expect(WEBHOOK_RETRY_OPTIONS.maxDelay).toBe(10000);
    });
});

// ============================================
// OPENAI SHOULDRETRY
// ============================================

describe('OPENAI_RETRY_OPTIONS - shouldRetry', () => {
    const { shouldRetry } = OPENAI_RETRY_OPTIONS;

    it('should not retry on invalid API key', () => {
        const error = new Error('Invalid API key');
        expect(shouldRetry!(error)).toBe(false);
    });

    it('should not retry on authentication errors', () => {
        const error = new Error('Authentication failed');
        expect(shouldRetry!(error)).toBe(false);
    });

    it('should not retry on rate limit exceeded', () => {
        const error = new Error('Rate limit exceeded');
        expect(shouldRetry!(error)).toBe(false);
    });

    it('should not retry on quota errors', () => {
        const error = new Error('Quota exceeded');
        expect(shouldRetry!(error)).toBe(false);
    });

    it('should retry on timeout errors', () => {
        const error = new Error('Request timeout');
        expect(shouldRetry!(error)).toBe(true);
    });

    it('should retry on network errors', () => {
        const error = new Error('Network error');
        expect(shouldRetry!(error)).toBe(true);
    });
});

// ============================================
// WPPCONNECT SHOULDRETRY
// ============================================

describe('WPPCONNECT_RETRY_OPTIONS - shouldRetry', () => {
    const { shouldRetry } = WPPCONNECT_RETRY_OPTIONS;

    it('should not retry on session not found', () => {
        const error = new Error('Session not found');
        expect(shouldRetry!(error)).toBe(false);
    });

    it('should not retry on not connected', () => {
        const error = new Error('WhatsApp not connected');
        expect(shouldRetry!(error)).toBe(false);
    });

    it('should retry on timeout errors', () => {
        const error = new Error('Request timeout');
        expect(shouldRetry!(error)).toBe(true);
    });
});

// ============================================
// WRAPPERS
// ============================================

describe('retryOpenAI wrapper', () => {
    beforeEach(() => {
        vi.useFakeTimers();
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it('should return result on success', async () => {
        const fn = createSuccessFn('openai-result');

        const result = await retryOpenAI(fn);

        expect(result).toBe('openai-result');
    });

    it('should use OpenAI retry configuration', async () => {
        const fn = createFailFn('Temporary error');

        const promise = retryOpenAI(fn);

        // OpenAI config: maxRetries=3, initialDelay=1000
        expect(fn).toHaveBeenCalledTimes(1);

        await vi.advanceTimersByTimeAsync(1000);
        expect(fn).toHaveBeenCalledTimes(2);

        await vi.advanceTimersByTimeAsync(2000);
        expect(fn).toHaveBeenCalledTimes(3);

        await vi.advanceTimersByTimeAsync(4000);
        expect(fn).toHaveBeenCalledTimes(4);

        await expect(promise).rejects.toThrow();
    });
});

describe('retryWPPConnect wrapper', () => {
    beforeEach(() => {
        vi.useFakeTimers();
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it('should return result on success', async () => {
        const fn = createSuccessFn('wpp-result');

        const result = await retryWPPConnect(fn);

        expect(result).toBe('wpp-result');
    });

    it('should use WPPConnect retry configuration', async () => {
        const fn = createFailFn('Connection error');

        const promise = retryWPPConnect(fn);

        // WPPConnect config: maxRetries=2, initialDelay=500
        expect(fn).toHaveBeenCalledTimes(1);

        await vi.advanceTimersByTimeAsync(500);
        expect(fn).toHaveBeenCalledTimes(2);

        await vi.advanceTimersByTimeAsync(1000);
        expect(fn).toHaveBeenCalledTimes(3);

        await expect(promise).rejects.toThrow();
    });
});

// ============================================
// EDGE CASES
// ============================================

describe('retry - Edge Cases', () => {
    beforeEach(() => {
        vi.useFakeTimers();
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it('should handle maxRetries = 0', async () => {
        const fn = createFailFn();

        await expect(
            retry(fn, { maxRetries: 0 })
        ).rejects.toThrow();

        expect(fn).toHaveBeenCalledTimes(1);
    });

    it('should handle non-Error throws', async () => {
        const fn = vi.fn().mockRejectedValue('string error');

        await expect(
            retry(fn, { maxRetries: 0 })
        ).rejects.toThrow();

        expect(fn).toHaveBeenCalledTimes(1);
    });
});
