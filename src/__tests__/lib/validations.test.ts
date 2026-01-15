/**
 * Tests for lib/validations.ts
 * 
 * Testa schemas Zod para validação de dados.
 */

import { describe, it, expect } from 'vitest';
import {
    loginSchema,
    registerSchema,
    agentSchema,
    trainingDataSchema,
    companySchema,
    planSchema,
    userProfileSchema,
    passwordChangeSchema,
    teamInviteSchema,
    sendMessageSchema,
    forgotPasswordSchema,
    resetPasswordSchema,
    validateRequest,
} from '@/lib/validations';

// ============================================
// loginSchema
// ============================================

describe('loginSchema', () => {
    it('should validate correct login data', () => {
        const validData = {
            email: 'user@example.com',
            password: 'password123',
        };

        const result = loginSchema.safeParse(validData);
        expect(result.success).toBe(true);
    });

    it('should reject invalid email', () => {
        const invalidData = {
            email: 'invalid-email',
            password: 'password123',
        };

        const result = loginSchema.safeParse(invalidData);
        expect(result.success).toBe(false);
    });

    it('should reject short password', () => {
        const invalidData = {
            email: 'user@example.com',
            password: '12345', // less than 6 chars
        };

        const result = loginSchema.safeParse(invalidData);
        expect(result.success).toBe(false);
    });
});

// ============================================
// registerSchema
// ============================================

describe('registerSchema', () => {
    const validData = {
        name: 'John Doe',
        email: 'john@example.com',
        password: 'password123',
        companyName: 'Acme Inc',
        companyNiche: 'Technology',
    };

    it('should validate correct registration data', () => {
        const result = registerSchema.safeParse(validData);
        expect(result.success).toBe(true);
    });

    it('should reject short name', () => {
        const result = registerSchema.safeParse({ ...validData, name: 'J' });
        expect(result.success).toBe(false);
    });

    it('should reject missing companyNiche', () => {
        const { companyNiche: _companyNiche, ...dataWithoutNiche } = validData;
        const result = registerSchema.safeParse(dataWithoutNiche);
        expect(result.success).toBe(false);
    });

    it('should accept optional fields', () => {
        const dataWithOptional = {
            ...validData,
            companyDescription: 'A great company',
            phone: '+55 11 99999-9999',
        };
        const result = registerSchema.safeParse(dataWithOptional);
        expect(result.success).toBe(true);
    });
});

// ============================================
// agentSchema
// ============================================

describe('agentSchema', () => {
    const validData = {
        name: 'Sales Agent',
        personality: 'Friendly and professional sales representative',
    };

    it('should validate correct agent data', () => {
        const result = agentSchema.safeParse(validData);
        expect(result.success).toBe(true);
    });

    it('should reject short personality', () => {
        const result = agentSchema.safeParse({ ...validData, personality: 'short' });
        expect(result.success).toBe(false);
    });

    it('should apply default values', () => {
        const result = agentSchema.safeParse(validData);
        expect(result.success).toBe(true);
        if (result.success) {
            expect(result.data.canSell).toBe(false);
            expect(result.data.canNegotiate).toBe(false);
            expect(result.data.transferToHuman).toBe(true);
            expect(result.data.isActive).toBe(true);
        }
    });

    it('should validate workingHours structure', () => {
        const dataWithHours = {
            ...validData,
            workingHours: {
                start: '09:00',
                end: '18:00',
                days: [1, 2, 3, 4, 5],
            },
        };
        const result = agentSchema.safeParse(dataWithHours);
        expect(result.success).toBe(true);
    });
});

// ============================================
// trainingDataSchema
// ============================================

describe('trainingDataSchema', () => {
    it('should validate correct training data', () => {
        const validData = {
            type: 'QA',
            title: 'FAQ Item',
            content: 'This is a frequently asked question answer',
        };

        const result = trainingDataSchema.safeParse(validData);
        expect(result.success).toBe(true);
    });

    it('should validate all training types', () => {
        const types = ['QA', 'DOCUMENT', 'PRODUCT', 'FAQ', 'SCRIPT', 'POLICY'];

        types.forEach((type) => {
            const result = trainingDataSchema.safeParse({
                type,
                title: 'Test',
                content: 'Content here',
            });
            expect(result.success).toBe(true);
        });
    });

    it('should reject invalid training type', () => {
        const result = trainingDataSchema.safeParse({
            type: 'INVALID_TYPE',
            title: 'Test',
            content: 'Content here',
        });
        expect(result.success).toBe(false);
    });
});

// ============================================
// planSchema
// ============================================

describe('planSchema', () => {
    const validPlan = {
        name: 'Pro Plan',
        type: 'PRO',
        price: 99.90,
        maxWhatsAppNumbers: 3,
        maxAgents: 5,
        maxMessagesMonth: 10000,
        maxTokensMonth: 500000,
    };

    it('should validate correct plan data', () => {
        const result = planSchema.safeParse(validPlan);
        expect(result.success).toBe(true);
    });

    it('should accept -1 for unlimited messages', () => {
        const unlimitedPlan = { ...validPlan, maxMessagesMonth: -1 };
        const result = planSchema.safeParse(unlimitedPlan);
        expect(result.success).toBe(true);
    });

    it('should reject negative price', () => {
        const result = planSchema.safeParse({ ...validPlan, price: -10 });
        expect(result.success).toBe(false);
    });

    it('should apply feature defaults', () => {
        const result = planSchema.safeParse(validPlan);
        expect(result.success).toBe(true);
        if (result.success) {
            expect(result.data.allowAudio).toBe(false);
            expect(result.data.allowVoice).toBe(false);
            expect(result.data.features).toEqual([]);
        }
    });
});

// ============================================
// passwordChangeSchema / resetPasswordSchema
// ============================================

describe('Password Schemas', () => {
    describe('passwordChangeSchema', () => {
        it('should validate correct password change', () => {
            const result = passwordChangeSchema.safeParse({
                currentPassword: 'oldPassword123',
                newPassword: 'newPassword456',
            });
            expect(result.success).toBe(true);
        });

        it('should reject short new password', () => {
            const result = passwordChangeSchema.safeParse({
                currentPassword: 'oldPassword123',
                newPassword: '12345',
            });
            expect(result.success).toBe(false);
        });
    });

    describe('resetPasswordSchema', () => {
        it('should validate matching passwords', () => {
            const result = resetPasswordSchema.safeParse({
                token: 'valid-token',
                password: 'newPassword123',
                confirmPassword: 'newPassword123',
            });
            expect(result.success).toBe(true);
        });

        it('should reject mismatched passwords', () => {
            const result = resetPasswordSchema.safeParse({
                token: 'valid-token',
                password: 'newPassword123',
                confirmPassword: 'differentPassword',
            });
            expect(result.success).toBe(false);
        });
    });
});

// ============================================
// validateRequest helper
// ============================================

describe('validateRequest helper', () => {
    it('should return success with parsed data', () => {
        const result = validateRequest(loginSchema, {
            email: 'test@example.com',
            password: 'password123',
        });

        expect(result.success).toBe(true);
        if (result.success) {
            expect(result.data.email).toBe('test@example.com');
        }
    });

    it('should return error response for invalid data', () => {
        const result = validateRequest(loginSchema, {
            email: 'invalid',
            password: '123',
        });

        expect(result.success).toBe(false);
        if (!result.success) {
            expect(result.response).toBeDefined();
        }
    });
});

// ============================================
// Other schemas quick tests
// ============================================

describe('Other Schemas', () => {
    it('companySchema should validate', () => {
        const result = companySchema.safeParse({
            name: 'Company',
            email: 'company@example.com',
        });
        expect(result.success).toBe(true);
    });

    it('userProfileSchema should validate', () => {
        const result = userProfileSchema.safeParse({
            name: 'John Doe',
            email: 'john@example.com',
        });
        expect(result.success).toBe(true);
    });

    it('teamInviteSchema should validate', () => {
        const result = teamInviteSchema.safeParse({
            name: 'New Member',
            email: 'member@example.com',
        });
        expect(result.success).toBe(true);
    });

    it('sendMessageSchema should validate', () => {
        const result = sendMessageSchema.safeParse({
            content: 'Hello, world!',
        });
        expect(result.success).toBe(true);
    });

    it('forgotPasswordSchema should validate', () => {
        const result = forgotPasswordSchema.safeParse({
            email: 'user@example.com',
        });
        expect(result.success).toBe(true);
    });
});
