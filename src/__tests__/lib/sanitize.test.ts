/**
 * Tests for lib/sanitize.ts
 * 
 * Testa funções de sanitização contra XSS e injeção de código.
 */

import { describe, it, expect } from 'vitest';
import {
    stripHtml,
    sanitizeHtml,
    escapeHtml,
    sanitizeUrl,
    sanitizeWhatsAppMessage,
    hasXss,
    sanitizeObject,
    sanitizeInput,
} from '@/lib/sanitize';

// ============================================
// stripHtml
// ============================================

describe('stripHtml', () => {
    it('should remove all HTML tags', () => {
        expect(stripHtml('<p>Hello</p>')).toBe('Hello');
        expect(stripHtml('<div><span>Test</span></div>')).toBe('Test');
    });

    it('should remove script tags with content', () => {
        expect(stripHtml('<script>alert("xss")</script>Hello')).toBe('Hello');
    });

    it('should remove style tags with content', () => {
        expect(stripHtml('<style>body{color:red}</style>Text')).toBe('Text');
    });

    it('should handle empty input', () => {
        expect(stripHtml('')).toBe('');
        expect(stripHtml(null as unknown as string)).toBe('');
    });

    it('should normalize whitespace', () => {
        expect(stripHtml('Hello   World')).toBe('Hello World');
    });
});

// ============================================
// sanitizeHtml
// ============================================

describe('sanitizeHtml', () => {
    it('should remove dangerous tags', () => {
        const result = sanitizeHtml('<p>Hello</p><script>bad()</script>');
        expect(result).not.toContain('<script');
    });

    it('should remove event handlers', () => {
        const result = sanitizeHtml('<div onclick="alert()">Click</div>');
        expect(result).not.toContain('onclick');
    });

    it('should remove javascript: protocols', () => {
        const result = sanitizeHtml('<a href="javascript:alert()">Link</a>');
        expect(result).not.toContain('javascript:');
    });
});

// ============================================
// escapeHtml
// ============================================

describe('escapeHtml', () => {
    it('should escape special characters', () => {
        expect(escapeHtml('<script>')).toBe('&lt;script&gt;');
        expect(escapeHtml('a & b')).toBe('a &amp; b');
        expect(escapeHtml('"quotes"')).toBe('&quot;quotes&quot;');
    });

    it('should handle empty input', () => {
        expect(escapeHtml('')).toBe('');
    });
});

// ============================================
// sanitizeUrl
// ============================================

describe('sanitizeUrl', () => {
    it('should allow safe URLs', () => {
        expect(sanitizeUrl('https://example.com')).toBe('https://example.com');
        expect(sanitizeUrl('http://example.com')).toBe('http://example.com');
        expect(sanitizeUrl('mailto:test@example.com')).toBe('mailto:test@example.com');
    });

    it('should block javascript URLs', () => {
        expect(sanitizeUrl('javascript:alert()')).toBe('');
        expect(sanitizeUrl('JAVASCRIPT:alert()')).toBe('');
    });

    it('should block data URLs', () => {
        expect(sanitizeUrl('data:text/html,<script>')).toBe('');
    });

    it('should handle empty input', () => {
        expect(sanitizeUrl('')).toBe('');
    });
});

// ============================================
// sanitizeWhatsAppMessage
// ============================================

describe('sanitizeWhatsAppMessage', () => {
    it('should preserve WhatsApp formatting', () => {
        expect(sanitizeWhatsAppMessage('*bold* and _italic_')).toBe('*bold* and _italic_');
        expect(sanitizeWhatsAppMessage('~strikethrough~')).toBe('~strikethrough~');
        expect(sanitizeWhatsAppMessage('```code```')).toBe('```code```');
    });

    it('should remove HTML', () => {
        expect(sanitizeWhatsAppMessage('<b>bold</b>')).toBe('bold');
    });

    it('should remove script tags', () => {
        expect(sanitizeWhatsAppMessage('<script>alert()</script>Hello')).toBe('Hello');
    });
});

// ============================================
// hasXss
// ============================================

describe('hasXss', () => {
    it('should detect script tags', () => {
        expect(hasXss('<script>alert()</script>')).toBe(true);
        expect(hasXss('<SCRIPT>bad()</SCRIPT>')).toBe(true);
    });

    it('should detect event handlers', () => {
        expect(hasXss('<div onclick="alert()">x</div>')).toBe(true);
        expect(hasXss('<img onerror="bad()">')).toBe(true);
    });

    it('should detect javascript: protocol', () => {
        expect(hasXss('javascript:alert()')).toBe(true);
    });

    it('should return false for safe content', () => {
        expect(hasXss('Hello World')).toBe(false);
        expect(hasXss('Normal text with *formatting*')).toBe(false);
    });

    it('should handle empty input', () => {
        expect(hasXss('')).toBe(false);
    });
});

// ============================================
// sanitizeObject
// ============================================

describe('sanitizeObject', () => {
    it('should sanitize string values', () => {
        const input = { name: '<script>bad</script>John' };
        const result = sanitizeObject(input);
        expect(result.name).toBe('John');
    });

    it('should sanitize nested objects', () => {
        const input = {
            user: {
                name: '<b>John</b>',
                bio: '<script>xss</script>Hello',
            },
        };
        const result = sanitizeObject(input);
        expect(result.user.name).toBe('John');
        expect(result.user.bio).toBe('Hello');
    });

    it('should sanitize arrays', () => {
        const input = ['<b>Item1</b>', '<script>bad</script>Item2'];
        const result = sanitizeObject(input);
        expect(result[0]).toBe('Item1');
        expect(result[1]).toBe('Item2');
    });

    it('should preserve non-string values', () => {
        const input = { count: 42, active: true, nothing: null };
        const result = sanitizeObject(input);
        expect(result.count).toBe(42);
        expect(result.active).toBe(true);
        expect(result.nothing).toBeNull();
    });

    it('should handle null and undefined', () => {
        expect(sanitizeObject(null)).toBeNull();
        expect(sanitizeObject(undefined)).toBeUndefined();
    });
});

// ============================================
// sanitizeInput
// ============================================

describe('sanitizeInput', () => {
    it('should remove script tags', () => {
        expect(sanitizeInput('<script>bad()</script>Hello')).toBe('Hello');
    });

    it('should remove iframes', () => {
        expect(sanitizeInput('<iframe src="evil.com"></iframe>Text')).toBe('Text');
    });

    it('should remove event handlers', () => {
        const result = sanitizeInput('<div onclick="alert()">Click</div>');
        expect(result).not.toContain('onclick');
    });

    it('should preserve normal text', () => {
        expect(sanitizeInput('Hello World')).toBe('Hello World');
    });
});
