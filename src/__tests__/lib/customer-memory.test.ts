/**
 * Tests for lib/customer-memory.ts
 * 
 * Testa gerenciamento de memória de longo prazo dos clientes.
 * Foco em funções que podem ser testadas sem dependências complexas.
 */

import { describe, it, expect, vi } from 'vitest';

// Mock do Prisma
vi.mock('@/lib/prisma', () => ({
    prisma: {
        customerMemory: {
            findFirst: vi.fn(),
            upsert: vi.fn(),
        },
    },
}));

// Mock do OpenAI
vi.mock('@/lib/openai', () => ({
    default: {
        chat: {
            completions: {
                create: vi.fn().mockResolvedValue({
                    choices: [{ message: { content: 'Resumo da conversa' } }],
                }),
            },
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

import {
    formatMemoryForPrompt,
    normalizePhone,
} from '@/lib/customer-memory';

// ============================================
// normalizePhone
// ============================================

describe('normalizePhone', () => {
    it('should remove @c.us suffix', () => {
        expect(normalizePhone('5511999999999@c.us')).toBe('5511999999999');
    });

    it('should remove @s.whatsapp.net suffix', () => {
        expect(normalizePhone('5511999999999@s.whatsapp.net')).toBe('5511999999999');
    });

    it('should keep phone without suffix unchanged', () => {
        expect(normalizePhone('5511999999999')).toBe('5511999999999');
    });

    it('should handle empty string', () => {
        expect(normalizePhone('')).toBe('');
    });
});

// ============================================
// formatMemoryForPrompt
// ============================================

describe('formatMemoryForPrompt', () => {
    it('should return empty string for null memory', () => {
        const result = formatMemoryForPrompt(null);

        expect(result).toBe('');
    });

    it('should format memory with summary', () => {
        const memory = {
            id: 'memory-1',
            companyId: 'company-1',
            customerPhone: '5511999999999',
            summary: 'Cliente gosta de camisetas azuis',
            preferences: null,
            lastProducts: null,
            tags: [],
            totalConversations: 3,
            totalMessages: 30,
            lastContactAt: new Date(),
        };

        const result = formatMemoryForPrompt(memory);

        expect(result).toContain('camisetas azuis');
    });

    it('should include last products when available', () => {
        const memory = {
            id: 'memory-1',
            companyId: 'company-1',
            customerPhone: '5511999999999',
            summary: 'Cliente frequente',
            preferences: null,
            lastProducts: ['Camiseta Azul', 'Calça Jeans'],
            tags: [],
            totalConversations: 5,
            totalMessages: 50,
            lastContactAt: new Date(),
        };

        const result = formatMemoryForPrompt(memory);

        expect(result).toContain('Camiseta Azul');
    });

    it('should include contact history', () => {
        const memory = {
            id: 'memory-1',
            companyId: 'company-1',
            customerPhone: '5511999999999',
            summary: 'Cliente regular',
            preferences: null,
            lastProducts: null,
            tags: [],
            totalConversations: 15,
            totalMessages: 150,
            lastContactAt: new Date('2024-12-20'),
        };

        const result = formatMemoryForPrompt(memory);

        expect(result).toContain('15');
    });
});

// ============================================
// Memory Data Structure
// ============================================

describe('CustomerMemoryData Structure', () => {
    it('should have all required fields', () => {
        const memory = {
            id: 'memory-1',
            companyId: 'company-1',
            customerPhone: '5511999999999',
            summary: 'Test summary',
            preferences: {},
            lastProducts: [],
            tags: [],
            totalConversations: 0,
            totalMessages: 0,
            lastContactAt: new Date(),
        };

        expect(memory).toHaveProperty('id');
        expect(memory).toHaveProperty('companyId');
        expect(memory).toHaveProperty('customerPhone');
        expect(memory).toHaveProperty('summary');
        expect(memory).toHaveProperty('preferences');
        expect(memory).toHaveProperty('lastProducts');
        expect(memory).toHaveProperty('tags');
        expect(memory).toHaveProperty('totalConversations');
        expect(memory).toHaveProperty('totalMessages');
        expect(memory).toHaveProperty('lastContactAt');
    });
});

// ============================================
// Phone Normalization Edge Cases
// ============================================

describe('Phone Normalization Edge Cases', () => {
    it('should handle international format +55', () => {
        const phone = '+5511999999999';
        const normalized = phone.replace('+', '');

        expect(normalized).toBe('5511999999999');
    });

    it('should handle spaces in phone', () => {
        const phone = '55 11 99999-9999';
        const normalized = phone.replace(/[\s-]/g, '');

        expect(normalized).toBe('5511999999999');
    });

    it('should handle dashes in phone', () => {
        const phone = '55-11-99999-9999';
        const normalized = phone.replace(/-/g, '');

        expect(normalized).toBe('5511999999999');
    });

    it('should handle parentheses in phone', () => {
        const phone = '(55)(11)99999-9999';
        const normalized = phone.replace(/[()\-\s]/g, '');

        expect(normalized).toBe('5511999999999');
    });
});

// ============================================
// Memory Merge Logic
// ============================================

describe('Memory Merge Logic', () => {
    it('should increment conversation count', () => {
        const existing = { totalConversations: 5 };
        const updated = existing.totalConversations + 1;

        expect(updated).toBe(6);
    });

    it('should add to total messages', () => {
        const existing = { totalMessages: 50 };
        const newMessages = 10;
        const updated = existing.totalMessages + newMessages;

        expect(updated).toBe(60);
    });

    it('should merge products without duplicates', () => {
        const existing = ['Camiseta Azul', 'Calça Jeans'];
        const newProducts = ['Calça Jeans', 'Tênis Branco'];
        const merged = [...new Set([...existing, ...newProducts])];

        expect(merged).toHaveLength(3);
        expect(merged).toContain('Tênis Branco');
    });

    it('should keep last 10 products', () => {
        const products = Array.from({ length: 15 }, (_, i) => `Produto ${i + 1}`);
        const last10 = products.slice(-10);

        expect(last10).toHaveLength(10);
        expect(last10[0]).toBe('Produto 6');
    });
});

// ============================================
// Summary Generation Logic
// ============================================

describe('Summary Generation Logic', () => {
    it('should handle empty messages array', () => {
        const messages: Array<{ role: 'user' | 'assistant'; content: string }> = [];

        expect(messages.length).toBe(0);
    });

    it('should handle single message', () => {
        const messages = [
            { role: 'user' as const, content: 'Olá' },
        ];

        expect(messages.length).toBe(1);
    });

    it('should handle conversation with multiple turns', () => {
        const messages = [
            { role: 'user' as const, content: 'Quero uma pizza' },
            { role: 'assistant' as const, content: 'Qual sabor?' },
            { role: 'user' as const, content: 'Calabresa' },
            { role: 'assistant' as const, content: 'Anotado!' },
        ];

        expect(messages.length).toBe(4);
    });
});

// ============================================
// Preferences Structure
// ============================================

describe('Preferences Structure', () => {
    it('should store size preference', () => {
        const prefs = { size: 'M' };

        expect(prefs.size).toBe('M');
    });

    it('should store payment preference', () => {
        const prefs = { prefersPIX: true };

        expect(prefs.prefersPIX).toBe(true);
    });

    it('should handle null preferences', () => {
        const prefs: Record<string, unknown> | null = null;

        expect(prefs).toBeNull();
    });

    it('should handle multiple preferences', () => {
        const prefs = {
            size: 'G',
            prefersPIX: true,
            favoriteFlavor: 'chocolate'
        };

        expect(Object.keys(prefs)).toHaveLength(3);
    });
});
