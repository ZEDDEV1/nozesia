/**
 * Test Setup - AgenteDeia
 * 
 * Configuração global para todos os testes.
 * Inclui mocks para APIs do Next.js e Prisma.
 */

import { vi, beforeEach } from 'vitest';
import '@testing-library/jest-dom/vitest';

// ============================================
// MOCK: next/headers
// ============================================
const mockCookieStore = {
    get: vi.fn(),
    set: vi.fn(),
    delete: vi.fn(),
};

vi.mock('next/headers', () => ({
    cookies: vi.fn(() => Promise.resolve(mockCookieStore)),
    headers: vi.fn(() => new Map()),
}));

// ============================================
// MOCK: Prisma Client
// ============================================
export const mockPrisma = {
    user: {
        findUnique: vi.fn(),
        findFirst: vi.fn(),
        findMany: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
        delete: vi.fn(),
        count: vi.fn(),
    },
    company: {
        findUnique: vi.fn(),
        findFirst: vi.fn(),
        findMany: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
        delete: vi.fn(),
    },
    plan: {
        findUnique: vi.fn(),
        findFirst: vi.fn(),
        findMany: vi.fn(),
    },
    aIAgent: {
        findUnique: vi.fn(),
        findFirst: vi.fn(),
        findMany: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
        delete: vi.fn(),
        count: vi.fn(),
        updateMany: vi.fn(),
    },
    auditLog: {
        findFirst: vi.fn(),
        create: vi.fn(),
    },
    $transaction: vi.fn((callback) => callback(mockPrisma)),
};

vi.mock('@/lib/prisma', () => ({
    prisma: mockPrisma,
}));

// ============================================
// MOCK: Environment Variables
// ============================================
vi.stubEnv('NEXTAUTH_SECRET', 'test-secret-for-jwt');
vi.stubEnv('NODE_ENV', 'test');

// ============================================
// UTILITIES
// ============================================
export { mockCookieStore };

// Reset all mocks between tests
beforeEach(() => {
    vi.clearAllMocks();
});
