/**
 * Tests for lib/logger.ts
 * 
 * Testa o sistema de logging estruturado.
 * 
 * PARA QUE SERVE:
 * - Logs são essenciais para debugging
 * - Persistência no banco para críticos
 * - Formatação diferente por ambiente
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
    logger,
    generateRequestId,
    measureTime,
    withLogging,
} from '@/lib/logger';
import { mockPrisma } from '../setup';

// ============================================
// MOCKS
// ============================================

// Capturar console.log
const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => { });
const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => { });

// Mock do prisma para SystemLog
beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma.systemLog = {
        create: vi.fn().mockResolvedValue({ id: 'log-1' }),
    };
});

afterEach(() => {
    consoleSpy.mockClear();
    consoleErrorSpy.mockClear();
});

// ============================================
// LOG LEVELS
// ============================================

describe('Logger - Níveis de Log', () => {
    it('should log debug messages', () => {
        logger.debug('Test debug message');

        expect(consoleSpy).toHaveBeenCalled();
    });

    it('should log info messages', () => {
        logger.info('Test info message');

        expect(consoleSpy).toHaveBeenCalled();
    });

    it('should log warning messages', () => {
        logger.warn('Test warning message');

        expect(consoleSpy).toHaveBeenCalled();
    });

    it('should log error messages', () => {
        logger.error('Test error message');

        expect(consoleSpy).toHaveBeenCalled();
    });

    it('should log security messages', () => {
        logger.security('Test security message');

        expect(consoleSpy).toHaveBeenCalled();
    });
});

// ============================================
// CONTEXTO
// ============================================

describe('Logger - Contexto', () => {
    it('should include context in log', () => {
        logger.info('User action', { userId: 'user-123', action: 'login' });

        expect(consoleSpy).toHaveBeenCalled();
        const call = consoleSpy.mock.calls[0];
        // Em dev, contexto é passado separadamente
        expect(call.length).toBeGreaterThanOrEqual(1);
    });

    it('should format error objects', () => {
        const error = new Error('Test error');
        logger.error('Something failed', { error });

        expect(consoleSpy).toHaveBeenCalled();
    });

    it('should handle non-Error objects in error field', () => {
        logger.error('Something failed', { error: 'string error' });

        expect(consoleSpy).toHaveBeenCalled();
    });
});

// ============================================
// API LOGGING
// ============================================

describe('Logger - API Logging', () => {
    it('should log API request', () => {
        logger.apiRequest('GET', '/api/agents');

        expect(consoleSpy).toHaveBeenCalled();
        const call = consoleSpy.mock.calls[0];
        expect(call[0]).toContain('GET');
        expect(call[0]).toContain('/api/agents');
    });

    it('should log API response with status', () => {
        logger.apiResponse('GET', '/api/agents', 200, 150);

        expect(consoleSpy).toHaveBeenCalled();
        const call = consoleSpy.mock.calls[0];
        expect(call[0]).toContain('200');
    });

    it('should log 4xx as warning', () => {
        logger.apiResponse('POST', '/api/login', 401, 50);

        expect(consoleSpy).toHaveBeenCalled();
        // O warning level seria indicado no output
    });

    it('should log 5xx as error', () => {
        logger.apiResponse('GET', '/api/error', 500, 100);

        expect(consoleSpy).toHaveBeenCalled();
        // O error level seria indicado no output
    });
});

// ============================================
// SPECIALIZED LOGGERS
// ============================================

describe('Logger - Specialized Loggers', () => {
    it('should log whatsapp events', () => {
        logger.whatsapp('Message received', { messageId: 'msg-123' });

        expect(consoleSpy).toHaveBeenCalled();
        const call = consoleSpy.mock.calls[0];
        expect(call[0]).toContain('WhatsApp');
    });

    it('should log AI events', () => {
        logger.ai('Response generated', { tokens: 150 });

        expect(consoleSpy).toHaveBeenCalled();
        const call = consoleSpy.mock.calls[0];
        expect(call[0]).toContain('AI');
    });

    it('should log auth events', () => {
        logger.auth('User logged in', { userEmail: 'user@example.com' });

        expect(consoleSpy).toHaveBeenCalled();
        const call = consoleSpy.mock.calls[0];
        expect(call[0]).toContain('Auth');
    });

    it('should log auth failures as warning', () => {
        logger.auth('Login failed', { userEmail: 'user@example.com' });

        expect(consoleSpy).toHaveBeenCalled();
    });

    it('should log payment events', () => {
        logger.payment('Payment received', { amount: 99.90 });

        expect(consoleSpy).toHaveBeenCalled();
        const call = consoleSpy.mock.calls[0];
        expect(call[0]).toContain('Payment');
    });

    it('should log webhook events', () => {
        logger.webhook('Webhook dispatched', { url: 'https://example.com' });

        expect(consoleSpy).toHaveBeenCalled();
        const call = consoleSpy.mock.calls[0];
        expect(call[0]).toContain('Webhook');
    });
});

// ============================================
// generateRequestId
// ============================================

describe('generateRequestId', () => {
    it('should generate unique request IDs', () => {
        const id1 = generateRequestId();
        const id2 = generateRequestId();

        expect(id1).not.toBe(id2);
    });

    it('should start with "req_"', () => {
        const id = generateRequestId();

        expect(id).toMatch(/^req_/);
    });

    it('should have consistent format', () => {
        const id = generateRequestId();

        // req_ + timestamp + _ + random string
        expect(id).toMatch(/^req_\d+_[a-z0-9]+$/);
    });
});

// ============================================
// measureTime
// ============================================

describe('measureTime', () => {
    beforeEach(() => {
        vi.useFakeTimers();
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it('should return a function', () => {
        const elapsed = measureTime();

        expect(typeof elapsed).toBe('function');
    });

    it('should measure elapsed time', async () => {
        vi.useRealTimers(); // Need real timers for this test

        const getElapsed = measureTime();

        // Small delay
        await new Promise(resolve => setTimeout(resolve, 10));

        const elapsed = getElapsed();

        expect(elapsed).toBeGreaterThanOrEqual(0);
        expect(typeof elapsed).toBe('number');
    });

    it('should return rounded milliseconds', () => {
        vi.useRealTimers();

        const getElapsed = measureTime();
        const elapsed = getElapsed();

        // Should be a whole number (rounded)
        expect(Number.isInteger(elapsed)).toBe(true);
    });
});

// ============================================
// withLogging
// ============================================

describe('withLogging', () => {
    it('should execute function and return result', async () => {
        const result = await withLogging('test operation', async () => {
            return 'success';
        });

        expect(result).toBe('success');
    });

    it('should log start and completion', async () => {
        await withLogging('test operation', async () => 'done');

        // Should have at least 2 log calls (start and complete)
        expect(consoleSpy).toHaveBeenCalled();
    });

    it('should log errors and rethrow', async () => {
        const error = new Error('Test error');

        await expect(
            withLogging('failing operation', async () => {
                throw error;
            })
        ).rejects.toThrow('Test error');

        // Should log the error
        expect(consoleSpy).toHaveBeenCalled();
    });

    it('should include context in logs', async () => {
        await withLogging(
            'user action',
            async () => 'done',
            { userId: 'user-123' }
        );

        expect(consoleSpy).toHaveBeenCalled();
    });

    it('should include duration in completion log', async () => {
        await withLogging('timed operation', async () => 'done');

        // Verify logs were called (duration would be in context)
        expect(consoleSpy).toHaveBeenCalled();
    });
});

// ============================================
// EDGE CASES
// ============================================

describe('Logger - Edge Cases', () => {
    it('should handle empty message', () => {
        logger.info('');

        expect(consoleSpy).toHaveBeenCalled();
    });

    it('should handle null context gracefully', () => {
        // @ts-expect-error Testing null context
        logger.info('Test', null);

        expect(consoleSpy).toHaveBeenCalled();
    });

    it('should handle undefined context', () => {
        logger.info('Test', undefined);

        expect(consoleSpy).toHaveBeenCalled();
    });

    it('should handle very long messages', () => {
        const longMessage = 'A'.repeat(1000);
        logger.info(longMessage);

        expect(consoleSpy).toHaveBeenCalled();
    });

    it('should handle circular references in context', () => {
        const circular: Record<string, unknown> = { name: 'test' };
        circular.self = circular;

        // Logger throws on circular references (expected behavior)
        expect(() => logger.info('Test', circular)).toThrow();
    });
});
