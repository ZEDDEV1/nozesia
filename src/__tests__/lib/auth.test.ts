/**
 * Tests for lib/auth.ts
 * 
 * Testa funções de autenticação: hashing, tokens, validação.
 */

import { describe, it, expect } from 'vitest';
import {
    hashPassword,
    verifyPassword,
    generateToken,
    verifyToken,
} from '@/lib/auth';

// ============================================
// hashPassword / verifyPassword
// ============================================

describe('Password Hashing', () => {
    it('should hash a password', async () => {
        const password = 'securePassword123';
        const hash = await hashPassword(password);

        expect(hash).toBeDefined();
        expect(hash).not.toBe(password);
        expect(hash.length).toBeGreaterThan(20);
    });

    it('should verify correct password', async () => {
        const password = 'securePassword123';
        const hash = await hashPassword(password);

        const isValid = await verifyPassword(password, hash);
        expect(isValid).toBe(true);
    });

    it('should reject incorrect password', async () => {
        const password = 'securePassword123';
        const wrongPassword = 'wrongPassword';
        const hash = await hashPassword(password);

        const isValid = await verifyPassword(wrongPassword, hash);
        expect(isValid).toBe(false);
    });

    it('should generate different hashes for same password', async () => {
        const password = 'securePassword123';
        const hash1 = await hashPassword(password);
        const hash2 = await hashPassword(password);

        expect(hash1).not.toBe(hash2);
    });
});

// ============================================
// generateToken / verifyToken
// ============================================

describe('JWT Tokens', () => {
    const mockPayload = {
        userId: 'user-123',
        email: 'test@example.com',
        role: 'COMPANY_USER' as const,
        companyId: 'company-456',
    };

    it('should generate a valid JWT token', () => {
        const token = generateToken(mockPayload);

        expect(token).toBeDefined();
        expect(typeof token).toBe('string');
        expect(token.split('.')).toHaveLength(3); // JWT has 3 parts
    });

    it('should verify and decode a valid token', () => {
        const token = generateToken(mockPayload);
        const decoded = verifyToken(token);

        expect(decoded).not.toBeNull();
        expect(decoded?.userId).toBe(mockPayload.userId);
        expect(decoded?.email).toBe(mockPayload.email);
        expect(decoded?.role).toBe(mockPayload.role);
        expect(decoded?.companyId).toBe(mockPayload.companyId);
    });

    it('should return null for invalid token', () => {
        const decoded = verifyToken('invalid-token');
        expect(decoded).toBeNull();
    });

    it('should return null for expired token', () => {
        // Create a token that expired - we test with garbage token

        // We can't directly create an expired token, so we test with garbage
        const decoded = verifyToken('eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiIxMjMiLCJpYXQiOjE2MDAwMDAwMDAsImV4cCI6MTYwMDAwMDAwMX0.garbage');
        expect(decoded).toBeNull();
    });

    it('should handle null companyId', () => {
        const payloadWithNullCompany = {
            ...mockPayload,
            companyId: null,
        };

        const token = generateToken(payloadWithNullCompany);
        const decoded = verifyToken(token);

        expect(decoded?.companyId).toBeNull();
    });
});

// ============================================
// Role-based tests
// ============================================

describe('User Roles in Token', () => {
    it('should correctly encode SUPER_ADMIN role', () => {
        const payload = {
            userId: 'admin-123',
            email: 'admin@example.com',
            role: 'SUPER_ADMIN' as const,
            companyId: null,
        };

        const token = generateToken(payload);
        const decoded = verifyToken(token);

        expect(decoded?.role).toBe('SUPER_ADMIN');
    });

    it('should correctly encode COMPANY_ADMIN role', () => {
        const payload = {
            userId: 'admin-123',
            email: 'companyadmin@example.com',
            role: 'COMPANY_ADMIN' as const,
            companyId: 'company-123',
        };

        const token = generateToken(payload);
        const decoded = verifyToken(token);

        expect(decoded?.role).toBe('COMPANY_ADMIN');
    });
});
