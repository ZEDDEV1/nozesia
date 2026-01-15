/**
 * Tests for lib/date-utils.ts
 * 
 * Testa as funções de formatação de datas.
 * 
 * PARA QUE SERVE:
 * - Datas são críticas para agendamentos
 * - Formatação consistente em pt-BR
 * - Timezone não deve causar bugs
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
    formatTime,
    formatRelativeDate,
    formatFullDate,
    formatDateTime,
    formatTimeAgo,
} from '@/lib/date-utils';

// ============================================
// formatTime
// ============================================

describe('formatTime', () => {
    it('should format time as HH:mm', () => {
        // Criando data no timezone local
        const date = new Date(2024, 0, 15, 14, 30, 0); // 15 Jan 2024 14:30:00
        const result = formatTime(date);

        expect(result).toBe('14:30');
    });

    it('should handle Date objects', () => {
        const date = new Date(2024, 0, 15, 9, 5, 0); // 09:05
        const result = formatTime(date);

        expect(result).toBe('09:05');
    });

    it('should handle string dates', () => {
        // ISO string em horário local
        const date = new Date(2024, 0, 15, 23, 59, 0);
        const result = formatTime(date.toISOString());

        // O resultado depende do timezone, mas deve ter formato HH:mm
        expect(result).toMatch(/^\d{2}:\d{2}$/);
    });

    it('should pad single digit hours and minutes', () => {
        const date = new Date(2024, 0, 15, 8, 5, 0); // 08:05
        const result = formatTime(date);

        expect(result).toBe('08:05');
    });
});

// ============================================
// formatFullDate
// ============================================

describe('formatFullDate', () => {
    it('should format date as DD/MM/YYYY', () => {
        const date = new Date(2024, 0, 15); // 15 Jan 2024
        const result = formatFullDate(date);

        expect(result).toBe('15/01/2024');
    });

    it('should handle different months', () => {
        const date = new Date(2024, 11, 25); // 25 Dec 2024
        const result = formatFullDate(date);

        expect(result).toBe('25/12/2024');
    });

    it('should handle string dates', () => {
        const result = formatFullDate('2024-06-20');

        // O resultado depende do timezone
        expect(result).toMatch(/^\d{2}\/\d{2}\/\d{4}$/);
    });
});

// ============================================
// formatDateTime
// ============================================

describe('formatDateTime', () => {
    it('should format as DD/MM/YYYY HH:mm', () => {
        const date = new Date(2024, 0, 15, 14, 30, 0);
        const result = formatDateTime(date);

        expect(result).toBe('15/01/2024 14:30');
    });

    it('should handle midnight', () => {
        const date = new Date(2024, 5, 1, 0, 0, 0); // 01 Jun 2024 00:00
        const result = formatDateTime(date);

        expect(result).toBe('01/06/2024 00:00');
    });
});

// ============================================
// formatRelativeDate
// ============================================

describe('formatRelativeDate', () => {
    beforeEach(() => {
        vi.useFakeTimers();
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it('should return time for today', () => {
        const now = new Date(2024, 0, 15, 14, 0, 0);
        vi.setSystemTime(now);

        const earlier = new Date(2024, 0, 15, 10, 30, 0); // Mesmo dia
        const result = formatRelativeDate(earlier);

        expect(result).toBe('10:30');
    });

    it('should return "Ontem" for yesterday', () => {
        const now = new Date(2024, 0, 15, 14, 0, 0);
        vi.setSystemTime(now);

        const yesterday = new Date(2024, 0, 14, 10, 0, 0);
        const result = formatRelativeDate(yesterday);

        expect(result).toBe('Ontem');
    });

    it('should return DD/MM for older dates', () => {
        const now = new Date(2024, 0, 15, 14, 0, 0);
        vi.setSystemTime(now);

        const oldDate = new Date(2024, 0, 10, 10, 0, 0); // 5 days ago
        const result = formatRelativeDate(oldDate);

        expect(result).toBe('10/01');
    });
});

// ============================================
// formatTimeAgo
// ============================================

describe('formatTimeAgo', () => {
    beforeEach(() => {
        vi.useFakeTimers();
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it('should return "agora" for less than 60 seconds', () => {
        const now = new Date(2024, 0, 15, 14, 0, 30);
        vi.setSystemTime(now);

        const recent = new Date(2024, 0, 15, 14, 0, 0); // 30 seconds ago
        const result = formatTimeAgo(recent);

        expect(result).toBe('agora');
    });

    it('should return minutes for less than 60 minutes', () => {
        const now = new Date(2024, 0, 15, 14, 30, 0);
        vi.setSystemTime(now);

        const fifteenMinAgo = new Date(2024, 0, 15, 14, 15, 0);
        const result = formatTimeAgo(fifteenMinAgo);

        expect(result).toBe('há 15 min');
    });

    it('should return hours for less than 24 hours', () => {
        const now = new Date(2024, 0, 15, 14, 0, 0);
        vi.setSystemTime(now);

        const threeHoursAgo = new Date(2024, 0, 15, 11, 0, 0);
        const result = formatTimeAgo(threeHoursAgo);

        expect(result).toBe('há 3h');
    });

    it('should return "ontem" for 1 day ago', () => {
        const now = new Date(2024, 0, 15, 14, 0, 0);
        vi.setSystemTime(now);

        const yesterday = new Date(2024, 0, 14, 14, 0, 0); // 24h ago
        const result = formatTimeAgo(yesterday);

        expect(result).toBe('ontem');
    });

    it('should return days for less than 7 days', () => {
        const now = new Date(2024, 0, 15, 14, 0, 0);
        vi.setSystemTime(now);

        const fiveDaysAgo = new Date(2024, 0, 10, 14, 0, 0);
        const result = formatTimeAgo(fiveDaysAgo);

        expect(result).toBe('há 5 dias');
    });

    it('should return formatted date for 7+ days', () => {
        const now = new Date(2024, 0, 15, 14, 0, 0);
        vi.setSystemTime(now);

        const tenDaysAgo = new Date(2024, 0, 5, 14, 0, 0);
        const result = formatTimeAgo(tenDaysAgo);

        expect(result).toBe('05/01');
    });
});

// ============================================
// EDGE CASES
// ============================================

describe('Date Utils - Edge Cases', () => {
    it('should handle end of year dates', () => {
        const date = new Date(2024, 11, 31, 23, 59, 59);

        expect(formatFullDate(date)).toBe('31/12/2024');
        expect(formatTime(date)).toBe('23:59');
    });

    it('should handle beginning of year dates', () => {
        const date = new Date(2024, 0, 1, 0, 0, 0);

        expect(formatFullDate(date)).toBe('01/01/2024');
        expect(formatTime(date)).toBe('00:00');
    });

    it('should handle leap year dates', () => {
        const date = new Date(2024, 1, 29, 12, 0, 0); // Feb 29, 2024

        expect(formatFullDate(date)).toBe('29/02/2024');
    });
});
