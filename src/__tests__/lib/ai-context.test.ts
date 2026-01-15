/**
 * Tests for lib/ai-context.ts
 * 
 * Testa detecção de fim de conversa e classificação de despedida.
 * Funções que usam OpenAI são testadas com mock no setup.ts
 */

import { describe, it, expect, vi } from 'vitest';

// Mock OpenAI antes de importar ai-context
vi.mock('openai', () => ({
    default: class {
        chat = {
            completions: {
                create: vi.fn().mockResolvedValue({
                    choices: [{ message: { content: 'Resposta mockada' } }],
                    usage: { prompt_tokens: 100, completion_tokens: 50 },
                }),
            },
        };
    },
}));

import {
    detectEndOfConversation,
    detectFarewellType,
    formatContextForPrompt,
} from '@/lib/ai-context';
import type { ConversationContext } from '@/lib/ai-context';


// ============================================
// detectEndOfConversation
// ============================================

describe('detectEndOfConversation', () => {
    describe('should detect end of conversation', () => {
        const endMessages = [
            'tchau',
            'Tchau!',
            'flw',
            'vlw flw',
            'adeus',
            'bye',
            'xau',
            'muito obrigado',
            'muito obrigada',
            'obrigado pela ajuda',
            'valeu pela ajuda',
            'era isso',
            'só isso mesmo',
            'era só isso',
            'valeu',
            'vlw',
            'perfeito',
            'show',
            'top',
            '👋',
            '🙏',
            'obrigado',
            'obrigada',
        ];

        endMessages.forEach(msg => {
            it(`should detect "${msg}" as end of conversation`, () => {
                expect(detectEndOfConversation(msg)).toBe(true);
            });
        });
    });

    describe('should NOT detect as end of conversation', () => {
        const notEndMessages = [
            'quero comprar',
            'quanto custa?',
            'ok, mas preciso de mais informação',
            'valeu, mas tem outra coisa',
            'show, mas quero saber mais',
            'qual o preço?',
            'me manda o catálogo',
            '',
            'posso pagar com pix?',
            'ok e o prazo de entrega?',
        ];

        notEndMessages.forEach(msg => {
            it(`should NOT detect "${msg}" as end of conversation`, () => {
                expect(detectEndOfConversation(msg)).toBe(false);
            });
        });
    });

    describe('edge cases', () => {
        it('should handle empty string', () => {
            expect(detectEndOfConversation('')).toBe(false);
        });

        it('should handle very long messages', () => {
            const longMessage = 'a'.repeat(150);
            expect(detectEndOfConversation(longMessage)).toBe(false);
        });

        it('should handle message with punctuation', () => {
            expect(detectEndOfConversation('tchau!!')).toBe(true);
            expect(detectEndOfConversation('obrigado.')).toBe(true);
        });

        it('should be case insensitive', () => {
            expect(detectEndOfConversation('TCHAU')).toBe(true);
            expect(detectEndOfConversation('ObRiGaDo')).toBe(true);
        });

        it('should handle message with question mark (not end)', () => {
            expect(detectEndOfConversation('valeu?')).toBe(false);
        });
    });
});

// ============================================
// detectFarewellType
// ============================================

describe('detectFarewellType', () => {
    describe('THANKING type', () => {
        it('should detect "obrigado" as THANKING', () => {
            expect(detectFarewellType('muito obrigado')).toBe('THANKING');
        });

        it('should detect "obrigada" as THANKING', () => {
            expect(detectFarewellType('obrigada pela ajuda')).toBe('THANKING');
        });

        it('should detect "valeu pela ajuda" as THANKING', () => {
            expect(detectFarewellType('valeu pela ajuda')).toBe('THANKING');
        });
    });

    describe('GOODBYE type', () => {
        it('should detect "tchau" as GOODBYE', () => {
            expect(detectFarewellType('tchau')).toBe('GOODBYE');
        });

        it('should detect "adeus" as GOODBYE', () => {
            expect(detectFarewellType('adeus')).toBe('GOODBYE');
        });

        it('should detect "flw" as GOODBYE', () => {
            expect(detectFarewellType('flw')).toBe('GOODBYE');
        });

        it('should detect "bye" as GOODBYE', () => {
            expect(detectFarewellType('bye')).toBe('GOODBYE');
        });
    });

    describe('CONFIRMATION type', () => {
        it('should detect "era isso" as CONFIRMATION', () => {
            expect(detectFarewellType('era isso')).toBe('CONFIRMATION');
        });

        it('should detect "só isso" as CONFIRMATION', () => {
            expect(detectFarewellType('só isso mesmo')).toBe('CONFIRMATION');
        });
    });

    describe('BRIEF type', () => {
        it('should detect "valeu" as BRIEF', () => {
            expect(detectFarewellType('valeu')).toBe('BRIEF');
        });

        it('should detect "show" as BRIEF', () => {
            expect(detectFarewellType('show')).toBe('BRIEF');
        });

        it('should detect "perfeito" as BRIEF', () => {
            expect(detectFarewellType('perfeito')).toBe('BRIEF');
        });
    });

    describe('null (not farewell)', () => {
        it('should return null for non-farewell messages', () => {
            expect(detectFarewellType('quero comprar')).toBeNull();
        });

        it('should return null for questions', () => {
            expect(detectFarewellType('quanto custa?')).toBeNull();
        });
    });
});

// ============================================
// formatContextForPrompt
// ============================================

describe('formatContextForPrompt', () => {
    it('should return empty string if no summary', () => {
        const context: ConversationContext = {
            summary: null,
            recentMessages: [],
            detectedIntent: null,
            totalMessages: 5,
        };

        expect(formatContextForPrompt(context)).toBe('');
    });

    it('should include summary if present', () => {
        const context: ConversationContext = {
            summary: 'Cliente perguntou sobre camisas',
            recentMessages: [],
            detectedIntent: null,
            totalMessages: 15,
        };

        const result = formatContextForPrompt(context);
        expect(result).toContain('RESUMO DA CONVERSA');
        expect(result).toContain('Cliente perguntou sobre camisas');
    });

    it('should include detected intent if present', () => {
        const context: ConversationContext = {
            summary: 'Cliente quer comprar',
            recentMessages: [],
            detectedIntent: 'COMPRAR',
            totalMessages: 15,
        };

        const result = formatContextForPrompt(context);
        expect(result).toContain('Intenção detectada');
        expect(result).toContain('COMPRAR');
    });

    it('should not include intent if OUTRO', () => {
        const context: ConversationContext = {
            summary: 'Conversa geral',
            recentMessages: [],
            detectedIntent: 'OUTRO',
            totalMessages: 10,
        };

        const result = formatContextForPrompt(context);
        expect(result).not.toContain('Intenção detectada');
    });
});
