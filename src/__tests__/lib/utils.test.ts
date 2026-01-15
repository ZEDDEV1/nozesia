/**
 * Tests for lib/utils.ts
 * 
 * Testa funções utilitárias: formatação de data, moeda, telefone, etc.
 */

import { describe, it, expect } from 'vitest';
import {
    formatDate,
    formatDateTime,
    formatTime,
    formatCurrency,
    formatPhone,
    truncate,
    generateId,
} from '@/lib/utils';

// ============================================
// formatDate
// ============================================

describe('formatDate', () => {
    it('should format Date object to DD/MM/YYYY', () => {
        const date = new Date('2024-12-25T10:30:00');
        const result = formatDate(date);
        expect(result).toBe('25/12/2024');
    });

    it('should format ISO string to DD/MM/YYYY', () => {
        const result = formatDate('2024-01-15T00:00:00');
        expect(result).toBe('15/01/2024');
    });

    it('should handle different months correctly', () => {
        // Use Date objects to avoid timezone issues
        const march = new Date(2024, 2, 15); // Month is 0-indexed, so 2 = March
        const november = new Date(2024, 10, 15); // 10 = November

        expect(formatDate(march)).toContain('03');
        expect(formatDate(november)).toContain('11');
    });
});

// ============================================
// formatDateTime
// ============================================

describe('formatDateTime', () => {
    it('should format date with time', () => {
        const date = new Date('2024-12-25T14:30:00');
        const result = formatDateTime(date);

        expect(result).toContain('25');
        expect(result).toContain('12');
        expect(result).toContain('2024');
        expect(result).toContain('14');
        expect(result).toContain('30');
    });

    it('should handle midnight correctly', () => {
        const date = new Date('2024-01-01T00:00:00');
        const result = formatDateTime(date);
        expect(result).toContain('00');
    });
});

// ============================================
// formatTime
// ============================================

describe('formatTime', () => {
    it('should format time only (HH:MM)', () => {
        const date = new Date('2024-12-25T09:05:00');
        const result = formatTime(date);

        expect(result).toContain('09');
        expect(result).toContain('05');
    });

    it('should handle afternoon time', () => {
        const date = new Date('2024-12-25T15:45:00');
        const result = formatTime(date);

        expect(result).toContain('15');
        expect(result).toContain('45');
    });
});

// ============================================
// formatCurrency
// ============================================

describe('formatCurrency', () => {
    it('should format as Brazilian Real', () => {
        const result = formatCurrency(99.90);

        expect(result).toContain('R$');
        expect(result).toContain('99');
    });

    it('should format integer values', () => {
        const result = formatCurrency(100);

        expect(result).toContain('R$');
        expect(result).toContain('100');
    });

    it('should format zero', () => {
        const result = formatCurrency(0);

        expect(result).toContain('R$');
        expect(result).toContain('0');
    });

    it('should format large numbers', () => {
        const result = formatCurrency(1234.56);

        expect(result).toContain('R$');
        expect(result).toContain('1');
        expect(result).toContain('234');
    });
});

// ============================================
// formatPhone
// ============================================

describe('formatPhone', () => {
    it('should format 11 digit phone (with 9)', () => {
        const result = formatPhone('11999999999');
        expect(result).toBe('(11) 99999-9999');
    });

    it('should format 10 digit phone (without 9)', () => {
        const result = formatPhone('1133333333');
        expect(result).toBe('(11) 3333-3333');
    });

    it('should handle phone with country code', () => {
        // If phone doesn't match expected formats, returns as-is
        const result = formatPhone('5511999999999');
        // 13 digits - doesn't match 10 or 11, so returns original
        expect(result).toBe('5511999999999');
    });

    it('should clean non-numeric characters', () => {
        const result = formatPhone('(11) 99999-9999');
        expect(result).toBe('(11) 99999-9999');
    });

    it('should return original if invalid length', () => {
        const result = formatPhone('123');
        expect(result).toBe('123');
    });
});

// ============================================
// truncate
// ============================================

describe('truncate', () => {
    it('should not truncate short strings', () => {
        const result = truncate('Hello', 10);
        expect(result).toBe('Hello');
    });

    it('should truncate long strings with ellipsis', () => {
        const result = truncate('This is a very long string', 10);
        expect(result).toBe('This is a ...');
    });

    it('should handle exact length', () => {
        const result = truncate('Hello', 5);
        expect(result).toBe('Hello');
    });

    it('should handle empty string', () => {
        const result = truncate('', 10);
        expect(result).toBe('');
    });
});

// ============================================
// generateId
// ============================================

describe('generateId', () => {
    it('should generate unique IDs', () => {
        const id1 = generateId();
        const id2 = generateId();

        expect(id1).not.toBe(id2);
    });

    it('should generate string IDs', () => {
        const id = generateId();

        expect(typeof id).toBe('string');
        expect(id.length).toBeGreaterThan(0);
    });

    it('should generate alphanumeric IDs', () => {
        const id = generateId();

        // Should contain only alphanumeric characters
        expect(id).toMatch(/^[a-z0-9]+$/i);
    });
});
