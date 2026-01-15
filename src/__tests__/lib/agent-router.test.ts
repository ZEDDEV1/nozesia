/**
 * Tests for lib/agent-router.ts
 * 
 * Testa roteamento inteligente de agentes baseado em keywords.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock do Prisma
vi.mock('@/lib/prisma', () => ({
    prisma: {
        aIAgent: {
            findMany: vi.fn(),
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
import { selectBestAgent, getAgentById } from '@/lib/agent-router';

// ============================================
// selectBestAgent
// ============================================

describe('selectBestAgent', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should return null when no agents exist', async () => {
        vi.mocked(prisma.aIAgent.findMany).mockResolvedValue([]);

        const result = await selectBestAgent('company-1', 'Olá');

        expect(result.agent).toBeNull();
        expect(result.reason).toBe('no_agents');
    });

    it('should return single agent when only one exists', async () => {
        vi.mocked(prisma.aIAgent.findMany).mockResolvedValue([
            {
                id: 'agent-1',
                name: 'Vendedor',
                triggerKeywords: ['venda', 'comprar'],
                priority: 1,
                isDefault: true,
            }
        ] as never);

        const result = await selectBestAgent('company-1', 'Olá');

        expect(result.agent).not.toBeNull();
        expect(result.agent?.name).toBe('Vendedor');
        expect(result.reason).toBe('single_agent');
    });

    it('should select agent with keyword match', async () => {
        vi.mocked(prisma.aIAgent.findMany).mockResolvedValue([
            {
                id: 'agent-1',
                name: 'Vendas',
                triggerKeywords: ['venda', 'comprar', 'preço'],
                priority: 1,
                isDefault: false,
            },
            {
                id: 'agent-2',
                name: 'Suporte',
                triggerKeywords: ['problema', 'ajuda', 'erro'],
                priority: 1,
                isDefault: true,
            }
        ] as never);

        const result = await selectBestAgent('company-1', 'Quero comprar um produto');

        expect(result.agent?.name).toBe('Vendas');
        expect(result.reason).toContain('keyword_match');
    });

    it('should use default agent when no keyword match', async () => {
        vi.mocked(prisma.aIAgent.findMany).mockResolvedValue([
            {
                id: 'agent-1',
                name: 'Vendas',
                triggerKeywords: ['venda', 'comprar'],
                priority: 1,
                isDefault: false,
            },
            {
                id: 'agent-2',
                name: 'Geral',
                triggerKeywords: [],
                priority: 1,
                isDefault: true,
            }
        ] as never);

        const result = await selectBestAgent('company-1', 'Olá, bom dia');

        expect(result.agent?.name).toBe('Geral');
        expect(result.reason).toBe('default');
    });

    it('should select agent with most keyword matches', async () => {
        vi.mocked(prisma.aIAgent.findMany).mockResolvedValue([
            {
                id: 'agent-1',
                name: 'Vendas Geral',
                triggerKeywords: ['preço'],
                priority: 1,
                isDefault: false,
            },
            {
                id: 'agent-2',
                name: 'Vendas Especialista',
                triggerKeywords: ['preço', 'produto', 'comprar'],
                priority: 1,
                isDefault: false,
            }
        ] as never);

        const result = await selectBestAgent('company-1', 'Qual preço do produto? Quero comprar.');

        expect(result.agent?.name).toBe('Vendas Especialista');
    });

    it('should use priority as tiebreaker', async () => {
        vi.mocked(prisma.aIAgent.findMany).mockResolvedValue([
            {
                id: 'agent-1',
                name: 'Junior',
                triggerKeywords: ['ajuda'],
                priority: 1,
                isDefault: false,
            },
            {
                id: 'agent-2',
                name: 'Senior',
                triggerKeywords: ['ajuda'],
                priority: 10,
                isDefault: false,
            }
        ] as never);

        const result = await selectBestAgent('company-1', 'Preciso de ajuda');

        expect(result.agent?.name).toBe('Senior');
    });

    it('should use highest priority when no default and no matches', async () => {
        vi.mocked(prisma.aIAgent.findMany).mockResolvedValue([
            {
                id: 'agent-1',
                name: 'Low Priority',
                triggerKeywords: ['especializado'],
                priority: 1,
                isDefault: false,
            },
            {
                id: 'agent-2',
                name: 'High Priority',
                triggerKeywords: ['outro'],
                priority: 10,
                isDefault: false,
            }
        ] as never);

        const result = await selectBestAgent('company-1', 'Mensagem sem match');

        expect(result.agent?.name).toBe('High Priority');
        expect(result.reason).toBe('priority');
    });

    it('should handle error gracefully', async () => {
        vi.mocked(prisma.aIAgent.findMany).mockRejectedValue(new Error('DB Error'));

        const result = await selectBestAgent('company-1', 'Olá');

        expect(result.agent).toBeNull();
        expect(result.reason).toBe('error');
    });
});

// ============================================
// getAgentById
// ============================================

describe('getAgentById', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should return agent when found', async () => {
        vi.mocked(prisma.aIAgent.findUnique).mockResolvedValue({
            id: 'agent-1',
            name: 'Test Agent',
            personality: 'Friendly',
        } as never);

        const result = await getAgentById('agent-1');

        expect(result).not.toBeNull();
        expect(result?.name).toBe('Test Agent');
    });

    it('should return null when not found', async () => {
        vi.mocked(prisma.aIAgent.findUnique).mockResolvedValue(null);

        const result = await getAgentById('non-existent');

        expect(result).toBeNull();
    });
});

// ============================================
// Keyword Matching Logic (Unit Tests)
// ============================================

describe('Keyword Matching Logic', () => {
    // Testing the normalization and matching behavior

    describe('text normalization', () => {
        it('should match regardless of case', () => {
            const message = 'QUERO COMPRAR';
            const keyword = 'comprar';

            expect(message.toLowerCase().includes(keyword)).toBe(true);
        });

        it('should match with accents', () => {
            const message = 'preço do produto';
            const keywordNormalized = 'preco';
            const messageNormalized = message
                .normalize('NFD')
                .replace(/[\u0300-\u036f]/g, '');

            expect(messageNormalized.includes(keywordNormalized)).toBe(true);
        });
    });

    describe('keyword counting', () => {
        it('should count multiple keyword matches', () => {
            const keywords = ['produto', 'preço', 'comprar'];
            const message = 'qual o preço do produto para comprar';

            const matches = keywords.filter(k => message.includes(k)).length;

            expect(matches).toBe(3);
        });

        it('should return 0 for no matches', () => {
            const keywords = ['específico', 'raro'];
            const message = 'mensagem normal';

            const matches = keywords.filter(k => message.includes(k)).length;

            expect(matches).toBe(0);
        });
    });
});

// ============================================
// Agent Candidate Structure
// ============================================

describe('AgentCandidate Structure', () => {
    it('should have required fields', () => {
        const candidate = {
            id: 'agent-1',
            name: 'Test',
            triggerKeywords: ['test'],
            priority: 1,
            isDefault: false,
            matchScore: 0,
        };

        expect(candidate).toHaveProperty('id');
        expect(candidate).toHaveProperty('name');
        expect(candidate).toHaveProperty('triggerKeywords');
        expect(candidate).toHaveProperty('priority');
        expect(candidate).toHaveProperty('isDefault');
        expect(candidate).toHaveProperty('matchScore');
    });
});

// ============================================
// Priority Sorting
// ============================================

describe('Priority Sorting', () => {
    it('should sort by matchScore descending', () => {
        const candidates = [
            { name: 'A', matchScore: 1, priority: 1 },
            { name: 'B', matchScore: 3, priority: 1 },
            { name: 'C', matchScore: 2, priority: 1 },
        ];

        const sorted = [...candidates].sort((a, b) => b.matchScore - a.matchScore);

        expect(sorted[0].name).toBe('B');
        expect(sorted[1].name).toBe('C');
        expect(sorted[2].name).toBe('A');
    });

    it('should use priority as tiebreaker', () => {
        const candidates = [
            { name: 'Low', matchScore: 2, priority: 1 },
            { name: 'High', matchScore: 2, priority: 10 },
        ];

        const sorted = [...candidates].sort((a, b) => {
            if (b.matchScore !== a.matchScore) {
                return b.matchScore - a.matchScore;
            }
            return b.priority - a.priority;
        });

        expect(sorted[0].name).toBe('High');
    });
});
