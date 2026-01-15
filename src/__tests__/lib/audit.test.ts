/**
 * Tests for lib/audit.ts
 * 
 * Testa o sistema de auditoria que registra ações importantes.
 * 
 * PARA QUE SERVE:
 * - Compliance com regulamentações
 * - Rastreabilidade de ações
 * - Investigação de incidentes
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
    audit,
    auditLogin,
    auditAgentCreated,
    auditAgentUpdated,
    auditWhatsAppSession,
    auditConversationTransferred,
    auditOrderCreated,
    auditSettingsChanged,
    auditWebhook,
    getAuditLogs,
    getUserAuditLogs,
    getCompanyAuditLogs,
} from '@/lib/audit';
import { mockPrisma } from '../setup';

// Mock do logger
vi.mock('@/lib/logger', () => ({
    logger: {
        info: vi.fn(),
        error: vi.fn(),
        warn: vi.fn(),
        debug: vi.fn(),
    },
}));

// ============================================
// FUNÇÃO PRINCIPAL: audit
// ============================================

describe('audit - Função Principal', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockPrisma.auditLog = {
            create: vi.fn().mockResolvedValue({ id: 'log-1' }),
            findMany: vi.fn().mockResolvedValue([]),
        };
    });

    it('should create audit log with all fields', async () => {
        await audit({
            action: 'LOGIN',
            entity: 'User',
            entityId: 'user-123',
            companyId: 'company-456',
            userEmail: 'user@example.com',
            details: { browser: 'Chrome' },
            ipAddress: '192.168.1.100',
        });

        expect(mockPrisma.auditLog.create).toHaveBeenCalledWith({
            data: {
                action: 'LOGIN',
                entity: 'User',
                entityId: 'user-123',
                companyId: 'company-456',
                userEmail: 'user@example.com',
                changes: JSON.stringify({ browser: 'Chrome' }),
                ipAddress: '192.168.1.100',
            },
        });
    });

    it('should use "system" when no user provided', async () => {
        await audit({
            action: 'AGENT_CREATED',
            entity: 'Agent',
        });

        expect(mockPrisma.auditLog.create).toHaveBeenCalledWith({
            data: expect.objectContaining({
                userEmail: 'system',
            }),
        });
    });

    it('should handle null details', async () => {
        await audit({
            action: 'LOGOUT',
            entity: 'User',
            userEmail: 'user@example.com',
        });

        expect(mockPrisma.auditLog.create).toHaveBeenCalledWith({
            data: expect.objectContaining({
                changes: null,
            }),
        });
    });

    it('should not throw when prisma fails', async () => {
        mockPrisma.auditLog.create.mockRejectedValue(new Error('DB Error'));

        // Não deve lançar erro
        await expect(
            audit({
                action: 'LOGIN',
                entity: 'User',
            })
        ).resolves.not.toThrow();
    });
});

// ============================================
// auditLogin
// ============================================

describe('auditLogin', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockPrisma.auditLog = {
            create: vi.fn().mockResolvedValue({ id: 'log-1' }),
            findMany: vi.fn().mockResolvedValue([]),
        };
    });

    it('should log successful login', async () => {
        await auditLogin('user@example.com', true, '10.0.0.1');

        expect(mockPrisma.auditLog.create).toHaveBeenCalledWith({
            data: expect.objectContaining({
                action: 'LOGIN',
                entity: 'User',
                userEmail: 'user@example.com',
                ipAddress: '10.0.0.1',
            }),
        });
    });

    it('should log failed login', async () => {
        await auditLogin('hacker@example.com', false, '1.2.3.4');

        expect(mockPrisma.auditLog.create).toHaveBeenCalledWith({
            data: expect.objectContaining({
                action: 'LOGIN_FAILED',
                entity: 'User',
                userEmail: 'hacker@example.com',
            }),
        });
    });

    it('should include additional details', async () => {
        await auditLogin('user@example.com', true, undefined, {
            userAgent: 'Mozilla/5.0',
        });

        expect(mockPrisma.auditLog.create).toHaveBeenCalledWith({
            data: expect.objectContaining({
                changes: expect.stringContaining('userAgent'),
            }),
        });
    });
});

// ============================================
// auditAgentCreated / auditAgentUpdated
// ============================================

describe('Agent Audit Functions', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockPrisma.auditLog = {
            create: vi.fn().mockResolvedValue({ id: 'log-1' }),
            findMany: vi.fn().mockResolvedValue([]),
        };
    });

    it('should log agent creation', async () => {
        await auditAgentCreated(
            'agent-123',
            'Vendas Bot',
            'company-456',
            'admin@company.com'
        );

        expect(mockPrisma.auditLog.create).toHaveBeenCalledWith({
            data: expect.objectContaining({
                action: 'AGENT_CREATED',
                entity: 'Agent',
                entityId: 'agent-123',
                companyId: 'company-456',
                userEmail: 'admin@company.com',
            }),
        });
    });

    it('should log agent update with changes', async () => {
        await auditAgentUpdated(
            'agent-123',
            'company-456',
            'admin@company.com',
            { name: 'Novo Nome', temperature: 0.7 }
        );

        expect(mockPrisma.auditLog.create).toHaveBeenCalledWith({
            data: expect.objectContaining({
                action: 'AGENT_UPDATED',
                changes: expect.stringContaining('name'),
            }),
        });
    });
});

// ============================================
// auditWhatsAppSession
// ============================================

describe('auditWhatsAppSession', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockPrisma.auditLog = {
            create: vi.fn().mockResolvedValue({ id: 'log-1' }),
            findMany: vi.fn().mockResolvedValue([]),
        };
    });

    it('should log session created', async () => {
        await auditWhatsAppSession(
            'SESSION_CREATED',
            'session-123',
            'company-456',
            'admin@company.com'
        );

        expect(mockPrisma.auditLog.create).toHaveBeenCalledWith({
            data: expect.objectContaining({
                action: 'SESSION_CREATED',
                entity: 'WhatsAppSession',
                entityId: 'session-123',
            }),
        });
    });

    it('should log session disconnected', async () => {
        await auditWhatsAppSession(
            'SESSION_DISCONNECTED',
            'session-123',
            'company-456',
            undefined,
            { reason: 'Manual disconnect' }
        );

        expect(mockPrisma.auditLog.create).toHaveBeenCalledWith({
            data: expect.objectContaining({
                action: 'SESSION_DISCONNECTED',
                changes: expect.stringContaining('reason'),
            }),
        });
    });
});

// ============================================
// auditConversationTransferred
// ============================================

describe('auditConversationTransferred', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockPrisma.auditLog = {
            create: vi.fn().mockResolvedValue({ id: 'log-1' }),
            findMany: vi.fn().mockResolvedValue([]),
        };
    });

    it('should log conversation transfer', async () => {
        await auditConversationTransferred(
            'conv-123',
            'company-456',
            'Customer requested human'
        );

        expect(mockPrisma.auditLog.create).toHaveBeenCalledWith({
            data: expect.objectContaining({
                action: 'CONVERSATION_TRANSFERRED',
                entity: 'Conversation',
                entityId: 'conv-123',
            }),
        });
    });
});

// ============================================
// auditOrderCreated
// ============================================

describe('auditOrderCreated', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockPrisma.auditLog = {
            create: vi.fn().mockResolvedValue({ id: 'log-1' }),
            findMany: vi.fn().mockResolvedValue([]),
        };
    });

    it('should log order creation with value', async () => {
        await auditOrderCreated(
            'order-123',
            'company-456',
            299.90,
            '+5511999999999'
        );

        expect(mockPrisma.auditLog.create).toHaveBeenCalledWith({
            data: expect.objectContaining({
                action: 'ORDER_CREATED',
                entity: 'Order',
                entityId: 'order-123',
                changes: expect.stringContaining('299.9'),
            }),
        });
    });
});

// ============================================
// auditSettingsChanged
// ============================================

describe('auditSettingsChanged', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockPrisma.auditLog = {
            create: vi.fn().mockResolvedValue({ id: 'log-1' }),
            findMany: vi.fn().mockResolvedValue([]),
        };
    });

    it('should log settings change with old and new values', async () => {
        await auditSettingsChanged(
            'company-456',
            'admin@company.com',
            'aiEnabled',
            false,
            true
        );

        expect(mockPrisma.auditLog.create).toHaveBeenCalledWith({
            data: expect.objectContaining({
                action: 'SETTINGS_CHANGED',
                entity: 'Settings',
                changes: expect.stringContaining('aiEnabled'),
            }),
        });
    });
});

// ============================================
// auditWebhook
// ============================================

describe('auditWebhook', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockPrisma.auditLog = {
            create: vi.fn().mockResolvedValue({ id: 'log-1' }),
            findMany: vi.fn().mockResolvedValue([]),
        };
    });

    it('should log webhook created', async () => {
        await auditWebhook(
            'WEBHOOK_CREATED',
            'webhook-123',
            'company-456',
            'admin@company.com',
            { url: 'https://example.com/webhook' }
        );

        expect(mockPrisma.auditLog.create).toHaveBeenCalledWith({
            data: expect.objectContaining({
                action: 'WEBHOOK_CREATED',
                entity: 'Webhook',
                entityId: 'webhook-123',
            }),
        });
    });

    it('should log webhook deleted', async () => {
        await auditWebhook(
            'WEBHOOK_DELETED',
            'webhook-123',
            'company-456',
            'admin@company.com'
        );

        expect(mockPrisma.auditLog.create).toHaveBeenCalledWith({
            data: expect.objectContaining({
                action: 'WEBHOOK_DELETED',
            }),
        });
    });
});

// ============================================
// getAuditLogs
// ============================================

describe('getAuditLogs', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockPrisma.auditLog = {
            create: vi.fn().mockResolvedValue({ id: 'log-1' }),
            findMany: vi.fn().mockResolvedValue([
                { id: 'log-1', action: 'LOGIN' },
                { id: 'log-2', action: 'LOGOUT' },
            ]),
        };
    });

    it('should fetch logs with default limit', async () => {
        await getAuditLogs();

        expect(mockPrisma.auditLog.findMany).toHaveBeenCalledWith(
            expect.objectContaining({ take: 100 })
        );
    });

    it('should filter by companyId', async () => {
        await getAuditLogs({ companyId: 'company-123' });

        expect(mockPrisma.auditLog.findMany).toHaveBeenCalledWith(
            expect.objectContaining({
                where: expect.objectContaining({ companyId: 'company-123' }),
            })
        );
    });

    it('should filter by action', async () => {
        await getAuditLogs({ action: 'LOGIN' });

        expect(mockPrisma.auditLog.findMany).toHaveBeenCalledWith(
            expect.objectContaining({
                where: expect.objectContaining({ action: 'LOGIN' }),
            })
        );
    });

    it('should order by createdAt desc', async () => {
        await getAuditLogs();

        expect(mockPrisma.auditLog.findMany).toHaveBeenCalledWith(
            expect.objectContaining({
                orderBy: { createdAt: 'desc' },
            })
        );
    });
});

// ============================================
// getUserAuditLogs / getCompanyAuditLogs
// ============================================

describe('Convenience Log Functions', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockPrisma.auditLog = {
            create: vi.fn().mockResolvedValue({ id: 'log-1' }),
            findMany: vi.fn().mockResolvedValue([]),
        };
    });

    it('getUserAuditLogs should filter by userEmail', async () => {
        await getUserAuditLogs('user@example.com', 25);

        expect(mockPrisma.auditLog.findMany).toHaveBeenCalledWith(
            expect.objectContaining({
                where: expect.objectContaining({ userEmail: 'user@example.com' }),
                take: 25,
            })
        );
    });

    it('getCompanyAuditLogs should filter by companyId', async () => {
        await getCompanyAuditLogs('company-123', 50);

        expect(mockPrisma.auditLog.findMany).toHaveBeenCalledWith(
            expect.objectContaining({
                where: expect.objectContaining({ companyId: 'company-123' }),
                take: 50,
            })
        );
    });
});
