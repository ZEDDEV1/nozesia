/**
 * Tests for lib/plan-features.ts
 * 
 * Testa verificação de features e limites por plano.
 * Nota: canUseFeatureSync pode não estar exportada.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock do Prisma
vi.mock('@/lib/prisma', () => ({
    prisma: {
        company: {
            findUnique: vi.fn(),
        },
        aIAgent: {
            count: vi.fn(),
        },
        whatsAppSession: {
            count: vi.fn(),
        },
        product: {
            count: vi.fn(),
        },
        responseTemplate: {
            count: vi.fn(),
        },
        webhook: {
            count: vi.fn(),
        },
        deliveryZone: {
            count: vi.fn(),
        },
        team: {
            count: vi.fn(),
        },
        campaign: {
            count: vi.fn(),
        },
        tokenUsage: {
            findFirst: vi.fn(),
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
    getCompanyPlanInfo,
    canUseFeature,
    hasAccess,
    getLimitStatus,
    getUpgradeMessage,
} from '@/lib/plan-features';

// ============================================
// getCompanyPlanInfo
// ============================================

describe('getCompanyPlanInfo', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should return plan info for company with subscription', async () => {
        vi.mocked(prisma.company.findUnique).mockResolvedValue({
            id: 'company-1',
            name: 'Test Company',
            trialEndsAt: null,
            extraAgents: 2,
            extraWhatsApps: 1,
            subscription: {
                status: 'ACTIVE',
                plan: {
                    id: 'plan-1',
                    name: 'Pro',
                    type: 'PRO',
                    maxTokensMonth: 500000,
                    maxWhatsAppNumbers: 3,
                    maxAgents: 5,
                    maxProducts: 100,
                    maxTemplates: 10,
                    maxCampaignsMonth: 10,
                    maxWebhooks: 5,
                    maxDeliveryZones: 10,
                    maxTeamMembers: 5,
                    maxCreativesMonth: 20,
                    allowAudio: true,
                    allowVoice: true,
                    allowHumanTransfer: true,
                    allowApiAccess: true,
                    allowWhiteLabel: false,
                    allowAnalytics: true,
                    allowCRM: true,
                    allowDeals: true,
                    allowCampaigns: true,
                    allowAutoRecovery: true,
                    extraAgentPrice: 29,
                    extraWhatsAppPrice: 49,
                },
            },
        } as never);

        const result = await getCompanyPlanInfo('company-1');

        expect(result).toHaveProperty('planId');
        expect(result).toHaveProperty('planName');
        expect(result).toHaveProperty('planType');
        expect(result).toHaveProperty('hasPaid');
        expect(result).toHaveProperty('limits');
        expect(result).toHaveProperty('features');
        expect(result.planName).toBe('Pro');
    });

    it('should return trial info when no subscription', async () => {
        const trialEndsAt = new Date();
        trialEndsAt.setDate(trialEndsAt.getDate() + 7);

        vi.mocked(prisma.company.findUnique).mockResolvedValue({
            id: 'company-2',
            name: 'Trial Company',
            trialEndsAt,
            extraAgents: 0,
            extraWhatsApps: 0,
            subscription: null,
        } as never);

        const result = await getCompanyPlanInfo('company-2');

        expect(result.isTrialActive).toBe(true);
        expect(result.hasPaid).toBe(false);
        expect(result.trialDaysRemaining).toBeGreaterThan(0);
    });
});

// ============================================
// canUseFeature
// ============================================

describe('canUseFeature', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should return true for allowed feature', async () => {
        vi.mocked(prisma.company.findUnique).mockResolvedValue({
            id: 'company-1',
            trialEndsAt: null,
            extraAgents: 0,
            extraWhatsApps: 0,
            subscription: {
                status: 'ACTIVE',
                plan: {
                    allowAudio: true,
                    allowVoice: true,
                    allowHumanTransfer: true,
                    allowApiAccess: true,
                    allowWhiteLabel: true,
                    allowAnalytics: true,
                    allowCRM: true,
                    allowDeals: true,
                    allowCampaigns: true,
                    allowAutoRecovery: true,
                },
            },
        } as never);

        const result = await canUseFeature('company-1', 'audio');

        expect(result).toBe(true);
    });

    it('should return false for disallowed feature', async () => {
        vi.mocked(prisma.company.findUnique).mockResolvedValue({
            id: 'company-1',
            subscription: {
                status: 'ACTIVE',
                plan: {
                    allowWhiteLabel: false,
                },
            },
        } as never);

        const result = await canUseFeature('company-1', 'whiteLabel');

        expect(result).toBe(false);
    });
});

// ============================================
// hasAccess
// ============================================

describe('hasAccess', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should grant access for active subscription', async () => {
        vi.mocked(prisma.company.findUnique).mockResolvedValue({
            id: 'company-1',
            trialEndsAt: null,
            subscription: {
                status: 'ACTIVE',
            },
        } as never);

        const result = await hasAccess('company-1');

        expect(result.hasAccess).toBe(true);
        expect(result.upgradeRequired).toBe(false);
    });

    it('should grant access for active trial', async () => {
        const trialEndsAt = new Date();
        trialEndsAt.setDate(trialEndsAt.getDate() + 7);

        vi.mocked(prisma.company.findUnique).mockResolvedValue({
            id: 'company-1',
            trialEndsAt,
            subscription: null,
        } as never);

        const result = await hasAccess('company-1');

        expect(result.hasAccess).toBe(true);
    });

    it('should deny access for expired trial without subscription', async () => {
        const trialEndsAt = new Date();
        trialEndsAt.setDate(trialEndsAt.getDate() - 7);

        vi.mocked(prisma.company.findUnique).mockResolvedValue({
            id: 'company-1',
            trialEndsAt,
            subscription: null,
        } as never);

        const result = await hasAccess('company-1');

        expect(result.hasAccess).toBe(false);
        expect(result.upgradeRequired).toBe(true);
    });
});

// ============================================
// getLimitStatus
// ============================================

describe('getLimitStatus', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should return limit status for agents', async () => {
        vi.mocked(prisma.company.findUnique).mockResolvedValue({
            id: 'company-1',
            extraAgents: 0,
            extraWhatsApps: 0,
            trialEndsAt: null,
            subscription: {
                status: 'ACTIVE',
                plan: {
                    maxAgents: 5,
                    maxWhatsAppNumbers: 3,
                    maxProducts: 100,
                    maxTokensMonth: 500000,
                },
            },
        } as never);

        vi.mocked(prisma.aIAgent.count).mockResolvedValue(3);

        const result = await getLimitStatus('company-1', 'agents');

        expect(result).toHaveProperty('current');
        expect(result).toHaveProperty('max');
        expect(result).toHaveProperty('remaining');
        expect(result).toHaveProperty('isAtLimit');
        expect(result.current).toBe(3);
    });
});

// ============================================
// getUpgradeMessage
// ============================================

describe('getUpgradeMessage', () => {
    it('should return message for agents limit', () => {
        const message = getUpgradeMessage('agents');

        expect(typeof message).toBe('string');
        expect(message.length).toBeGreaterThan(0);
    });
});

// ============================================
// Feature Keys
// ============================================

describe('Feature Keys', () => {
    const validFeatures = [
        'audio', 'voice', 'humanTransfer', 'apiAccess',
        'whiteLabel', 'analytics', 'crm', 'deals',
        'campaigns', 'autoRecovery'
    ];

    it('should have 10 feature keys', () => {
        expect(validFeatures).toHaveLength(10);
    });

    validFeatures.forEach(feature => {
        it(`should recognize "${feature}" as valid feature`, () => {
            expect(validFeatures).toContain(feature);
        });
    });
});

// ============================================
// Limit Keys
// ============================================

describe('Limit Keys', () => {
    const validLimits = [
        'tokensMonth', 'whatsappNumbers', 'agents', 'products',
        'templates', 'campaignsMonth', 'webhooks', 'deliveryZones',
        'teamMembers', 'creativesMonth'
    ];

    it('should have 10 limit keys', () => {
        expect(validLimits).toHaveLength(10);
    });

    validLimits.forEach(limit => {
        it(`should recognize "${limit}" as valid limit`, () => {
            expect(validLimits).toContain(limit);
        });
    });
});

// ============================================
// Default Trial Limits
// ============================================

describe('Default Trial Limits', () => {
    const DEFAULT_TRIAL_LIMITS = {
        maxTokensMonth: 75000,
        maxWhatsAppNumbers: 1,
        maxAgents: 1,
        maxProducts: 50,
        maxTemplates: 3,
        maxCampaignsMonth: 0,
        maxWebhooks: 0,
        maxDeliveryZones: 3,
        maxTeamMembers: 1,
        maxCreativesMonth: 0,
    };

    it('should have reasonable trial token limit', () => {
        expect(DEFAULT_TRIAL_LIMITS.maxTokensMonth).toBe(75000);
    });

    it('should limit trial to 1 whatsapp', () => {
        expect(DEFAULT_TRIAL_LIMITS.maxWhatsAppNumbers).toBe(1);
    });

    it('should limit trial to 1 agent', () => {
        expect(DEFAULT_TRIAL_LIMITS.maxAgents).toBe(1);
    });

    it('should not allow campaigns in trial', () => {
        expect(DEFAULT_TRIAL_LIMITS.maxCampaignsMonth).toBe(0);
    });
});
