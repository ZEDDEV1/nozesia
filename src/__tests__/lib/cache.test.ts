/**
 * Tests for lib/cache.ts
 * 
 * Testa funções de cache.
 * Nota: Os testes de integração com Redis devem ser feitos separadamente.
 */

import { describe, it, expect } from 'vitest';

// These are structural tests - actual cache behavior requires Redis or memory store
describe('Cache Module', () => {
    describe('Cache Structure', () => {
        it('should export cacheGet function', async () => {
            const { cacheGet } = await import('@/lib/cache');
            expect(typeof cacheGet).toBe('function');
        });

        it('should export cacheSet function', async () => {
            const { cacheSet } = await import('@/lib/cache');
            expect(typeof cacheSet).toBe('function');
        });

        it('should export cacheDelete function', async () => {
            const { cacheDelete } = await import('@/lib/cache');
            expect(typeof cacheDelete).toBe('function');
        });

        it('should export cacheGetOrSet function', async () => {
            const { cacheGetOrSet } = await import('@/lib/cache');
            expect(typeof cacheGetOrSet).toBe('function');
        });

        it('should export cache helpers for training data', async () => {
            const { cacheTrainingData, invalidateTrainingDataCache } = await import('@/lib/cache');
            expect(typeof cacheTrainingData).toBe('function');
            expect(typeof invalidateTrainingDataCache).toBe('function');
        });

        it('should export cache helpers for agents', async () => {
            const { cacheAgent, invalidateAgentCache } = await import('@/lib/cache');
            expect(typeof cacheAgent).toBe('function');
            expect(typeof invalidateAgentCache).toBe('function');
        });
    });
});
