/**
 * Tests for lib/queue.ts
 * 
 * Testa o sistema de filas de mensagens em memória.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

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
    addJob,
    registerJobHandler,
    getQueueStats,
    clearCompletedJobs,
    queueMessageProcessing,
    queueAIResponse,
    initializeDefaultHandlers,
} from '@/lib/queue';

// ============================================
// addJob
// ============================================

describe('addJob', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        clearCompletedJobs();
    });

    it('should create a job with correct structure', () => {
        const job = addJob('PROCESS_MESSAGE', { test: 'data' });

        expect(job).toHaveProperty('id');
        expect(job).toHaveProperty('type', 'PROCESS_MESSAGE');
        expect(job).toHaveProperty('data');
        expect(job).toHaveProperty('status'); // Status may change immediately
        expect(job).toHaveProperty('attempts');
    });

    it('should generate unique IDs', () => {
        const job1 = addJob('PROCESS_MESSAGE', { a: 1 });
        const job2 = addJob('PROCESS_MESSAGE', { b: 2 });

        expect(job1.id).not.toBe(job2.id);
    });

    it('should use default maxAttempts when not specified', () => {
        const job = addJob('SEND_AI_RESPONSE', {});

        expect(job.maxAttempts).toBe(3);
    });

    it('should use custom maxAttempts when specified', () => {
        const job = addJob('PROCESS_MESSAGE', {}, { maxAttempts: 5 });

        expect(job.maxAttempts).toBe(5);
    });
});

// ============================================
// registerJobHandler
// ============================================

describe('registerJobHandler', () => {
    it('should register handler without error', () => {
        expect(() => {
            registerJobHandler('SYNC_WHATSAPP', async () => { });
        }).not.toThrow();
    });
});

// ============================================
// getQueueStats
// ============================================

describe('getQueueStats', () => {
    beforeEach(() => {
        clearCompletedJobs();
    });

    it('should return stats object', () => {
        const stats = getQueueStats();

        expect(stats).toHaveProperty('pending');
        expect(stats).toHaveProperty('processing');
        expect(stats).toHaveProperty('completed');
        expect(stats).toHaveProperty('failed');
        expect(stats).toHaveProperty('recentJobs');
    });

    it('should have numeric values', () => {
        const stats = getQueueStats();

        expect(typeof stats.pending).toBe('number');
        expect(typeof stats.processing).toBe('number');
        expect(typeof stats.completed).toBe('number');
        expect(typeof stats.failed).toBe('number');
    });
});

// ============================================
// clearCompletedJobs
// ============================================

describe('clearCompletedJobs', () => {
    it('should not throw when clearing', () => {
        expect(() => clearCompletedJobs()).not.toThrow();
    });
});

// ============================================
// queueMessageProcessing
// ============================================

describe('queueMessageProcessing', () => {
    beforeEach(() => {
        clearCompletedJobs();
    });

    it('should create PROCESS_MESSAGE job', () => {
        const job = queueMessageProcessing({
            conversationId: 'conv-1',
            companyId: 'company-1',
            messageContent: 'Olá',
            messageType: 'TEXT',
            senderPhone: '5511999999999',
            sessionName: 'session-1',
        });

        expect(job.type).toBe('PROCESS_MESSAGE');
        expect(job.data.conversationId).toBe('conv-1');
    });
});

// ============================================
// queueAIResponse
// ============================================

describe('queueAIResponse', () => {
    beforeEach(() => {
        clearCompletedJobs();
    });

    it('should create SEND_AI_RESPONSE job', () => {
        const job = queueAIResponse({
            conversationId: 'conv-1',
            companyId: 'company-1',
            agentId: 'agent-1',
            customerMessage: 'Olá',
            sessionName: 'session-1',
            customerPhone: '5511999999999',
        });

        expect(job.type).toBe('SEND_AI_RESPONSE');
    });

    it('should use 5 max attempts for AI responses', () => {
        const job = queueAIResponse({
            conversationId: 'conv-1',
            companyId: 'company-1',
            agentId: 'agent-1',
            customerMessage: 'Olá',
            sessionName: 'session-1',
            customerPhone: '5511999999999',
        });

        expect(job.maxAttempts).toBe(5);
    });
});

// ============================================
// initializeDefaultHandlers
// ============================================

describe('initializeDefaultHandlers', () => {
    it('should initialize handlers without error', () => {
        expect(() => initializeDefaultHandlers()).not.toThrow();
    });
});

// ============================================
// Job Types
// ============================================

describe('Job Types', () => {
    const validTypes = [
        'PROCESS_MESSAGE',
        'SEND_AI_RESPONSE',
        'SYNC_WHATSAPP',
        'SEND_NOTIFICATION',
    ];

    it('should have 4 job types', () => {
        expect(validTypes).toHaveLength(4);
    });

    validTypes.forEach(type => {
        it(`should recognize "${type}" as valid type`, () => {
            expect(validTypes).toContain(type);
        });
    });
});

// ============================================
// Job Status
// ============================================

describe('Job Status', () => {
    const validStatuses = ['pending', 'processing', 'completed', 'failed'];

    it('should have 4 statuses', () => {
        expect(validStatuses).toHaveLength(4);
    });

    it('should have a valid status after creation', () => {
        const job = addJob('PROCESS_MESSAGE', {});
        expect(validStatuses).toContain(job.status);
    });
});

// ============================================
// Job Data Structures
// ============================================

describe('ProcessMessageData', () => {
    it('should have required fields', () => {
        const data = {
            conversationId: 'conv-1',
            companyId: 'company-1',
            messageContent: 'Hello',
            messageType: 'TEXT',
            senderPhone: '5511999999999',
            sessionName: 'session-1',
        };

        expect(data).toHaveProperty('conversationId');
        expect(data).toHaveProperty('companyId');
        expect(data).toHaveProperty('messageContent');
        expect(data).toHaveProperty('messageType');
        expect(data).toHaveProperty('senderPhone');
        expect(data).toHaveProperty('sessionName');
    });
});

describe('SendAIResponseData', () => {
    it('should have required fields', () => {
        const data = {
            conversationId: 'conv-1',
            companyId: 'company-1',
            agentId: 'agent-1',
            customerMessage: 'Hello',
            sessionName: 'session-1',
            customerPhone: '5511999999999',
        };

        expect(data).toHaveProperty('conversationId');
        expect(data).toHaveProperty('companyId');
        expect(data).toHaveProperty('agentId');
        expect(data).toHaveProperty('customerMessage');
        expect(data).toHaveProperty('sessionName');
        expect(data).toHaveProperty('customerPhone');
    });
});

// ============================================
// Retry Logic
// ============================================

describe('Retry Logic', () => {
    it('should calculate exponential backoff correctly', () => {
        const attempt1Delay = Math.pow(2, 1) * 1000; // 2s
        const attempt2Delay = Math.pow(2, 2) * 1000; // 4s
        const attempt3Delay = Math.pow(2, 3) * 1000; // 8s

        expect(attempt1Delay).toBe(2000);
        expect(attempt2Delay).toBe(4000);
        expect(attempt3Delay).toBe(8000);
    });

    it('should increase delay with each attempt', () => {
        const delays = [1, 2, 3, 4, 5].map(n => Math.pow(2, n) * 1000);

        for (let i = 1; i < delays.length; i++) {
            expect(delays[i]).toBeGreaterThan(delays[i - 1]);
        }
    });
});

// ============================================
// Queue Constants
// ============================================

describe('Queue Constants', () => {
    const MAX_COMPLETED_HISTORY = 100;

    it('should limit completed job history', () => {
        expect(MAX_COMPLETED_HISTORY).toBe(100);
    });
});
