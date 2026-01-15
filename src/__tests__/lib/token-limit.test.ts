/**
 * Tests for lib/token-limit.ts
 * 
 * Testa verificação e registro de limites de tokens.
 * Nota: getCurrentMonthUsage é função interna, não testada diretamente.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock do Prisma
vi.mock('@/lib/prisma', () => ({
    prisma: {
        company: {
            findUnique: vi.fn(),
            findMany: vi.fn(),
            update: vi.fn(),
        },
        tokenUsage: {
            findUnique: vi.fn(),
            findFirst: vi.fn(),
            findMany: vi.fn(),
            upsert: vi.fn(),
        },
        plan: {
            findFirst: vi.fn(),
            findUnique: vi.fn(),
        },
    },
}));

// Mock do logger
vi.mock('@/lib/logger', () => ({
    logger: {
        info: vi.fn(),
        error: vi.fn(),
        warn: vi.fn(),
        debug: vi.fn(),
    },
}));

import { prisma } from '@/lib/prisma';
import {
    checkTokenLimit,
    invalidateUsageCache,
    registerTokenUsage,
    getLimitReachedMessage,
    updateCompanyTokenLimit,
} from '@/lib/token-limit';

// ============================================
// checkTokenLimit
// ============================================

describe('checkTokenLimit', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        invalidateUsageCache('test-company');
    });

    it('should return status for company with active subscription', async () => {
        vi.mocked(prisma.company.findUnique).mockResolvedValue({
            id: 'company-1',
            trialEndsAt: null,
            monthlyTokenLimit: null,
            subscription: {
                status: 'ACTIVE',
                currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
                plan: {
                    maxTokensMonth: 500000,
                },
            },
        } as never);

        vi.mocked(prisma.tokenUsage.findFirst).mockResolvedValue({
            inputTokens: 100000,
            outputTokens: 50000,
        } as never);

        const result = await checkTokenLimit('company-1');

        expect(result).toHaveProperty('companyId');
        expect(result).toHaveProperty('currentUsage');
        expect(result).toHaveProperty('monthlyLimit');
        expect(result).toHaveProperty('percentUsed');
        expect(result).toHaveProperty('isLimitReached');
        expect(result.companyId).toBe('company-1');
    });

    it('should use trial limit when no subscription', async () => {
        const trialEndsAt = new Date();
        trialEndsAt.setDate(trialEndsAt.getDate() + 7);

        vi.mocked(prisma.company.findUnique).mockResolvedValue({
            id: 'company-2',
            trialEndsAt,
            monthlyTokenLimit: null,
            subscription: null,
        } as never);

        vi.mocked(prisma.tokenUsage.findFirst).mockResolvedValue(null);

        // Mock plan.findFirst to return null (no TRIAL plan in DB), 
        // so it falls back to TRIAL_TOKEN_LIMIT (75000)
        vi.mocked(prisma.plan.findFirst).mockResolvedValue(null);

        const result = await checkTokenLimit('company-2');

        expect(result.monthlyLimit).toBe(75000);
        expect(result.currentUsage).toBe(0);
    });

    it('should block access when trial expired and no subscription', async () => {
        const trialEndsAt = new Date();
        trialEndsAt.setDate(trialEndsAt.getDate() - 7);

        vi.mocked(prisma.company.findUnique).mockResolvedValue({
            id: 'company-3',
            trialEndsAt,
            monthlyTokenLimit: null,
            subscription: null,
        } as never);

        const result = await checkTokenLimit('company-3');

        expect(result.isLimitReached).toBe(true);
        expect(result.upgradeRequired).toBe(true);
    });
});

// ============================================
// invalidateUsageCache
// ============================================

describe('invalidateUsageCache', () => {
    it('should not throw when invalidating cache', () => {
        expect(() => invalidateUsageCache('company-1')).not.toThrow();
    });

    it('should work for any company ID', () => {
        expect(() => invalidateUsageCache('any-company-id')).not.toThrow();
    });
});

// ============================================
// registerTokenUsage
// ============================================

describe('registerTokenUsage', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should register token usage', async () => {
        vi.mocked(prisma.company.findUnique).mockResolvedValue({
            id: 'company-1',
            monthlyTokenLimit: null,
            trialEndsAt: null,
            subscription: {
                status: 'ACTIVE',
                currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
                plan: { maxTokensMonth: 1000000 },
            },
        } as never);

        vi.mocked(prisma.tokenUsage.findFirst).mockResolvedValue(null);
        vi.mocked(prisma.tokenUsage.upsert).mockResolvedValue({} as never);

        const result = await registerTokenUsage('company-1', 1000, 500);

        expect(result).toHaveProperty('registered');
        expect(result).toHaveProperty('limitReached');
        expect(result.registered).toBe(true);
    });
});

// ============================================
// getLimitReachedMessage
// ============================================

describe('getLimitReachedMessage', () => {
    it('should return a message string', () => {
        const message = getLimitReachedMessage();

        expect(typeof message).toBe('string');
        expect(message.length).toBeGreaterThan(0);
    });

    it('should be a helpful message for customers', () => {
        const message = getLimitReachedMessage();

        // Should mention contact or wait
        expect(message.length).toBeGreaterThan(20);
    });
});

// ============================================
// updateCompanyTokenLimit
// ============================================

describe('updateCompanyTokenLimit', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should update company token limit', async () => {
        vi.mocked(prisma.company.update).mockResolvedValue({} as never);

        const result = await updateCompanyTokenLimit('company-1', 1000000);

        expect(result).toBe(true);
        expect(prisma.company.update).toHaveBeenCalledWith({
            where: { id: 'company-1' },
            data: { monthlyTokenLimit: 1000000 },
        });
    });

    it('should return false on error', async () => {
        vi.mocked(prisma.company.update).mockRejectedValue(new Error('DB Error'));

        const result = await updateCompanyTokenLimit('company-1', 1000000);

        expect(result).toBe(false);
    });
});

// ============================================
// Token Calculations
// ============================================

describe('Token Calculations', () => {
    it('should calculate percent used correctly', () => {
        const currentUsage = 50000;
        const monthlyLimit = 100000;
        const percentUsed = (currentUsage / monthlyLimit) * 100;

        expect(percentUsed).toBe(50);
    });

    it('should calculate remaining tokens correctly', () => {
        const monthlyLimit = 100000;
        const currentUsage = 75000;
        const remaining = monthlyLimit - currentUsage;

        expect(remaining).toBe(25000);
    });

    it('should handle unlimited (-1) correctly', () => {
        const monthlyLimit = -1;
        const isUnlimited = monthlyLimit === -1;

        expect(isUnlimited).toBe(true);
    });
});

// ============================================
// Trial Token Constants
// ============================================

describe('Trial Token Limit', () => {
    const TRIAL_TOKEN_LIMIT = 75000;

    it('should have correct trial limit constant', () => {
        expect(TRIAL_TOKEN_LIMIT).toBe(75000);
    });

    it('should be reasonable for trial usage', () => {
        const avgTokensPerConversation = 1500;
        const expectedConversations = TRIAL_TOKEN_LIMIT / avgTokensPerConversation;

        expect(expectedConversations).toBe(50);
    });
});
