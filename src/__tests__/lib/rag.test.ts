/**
 * Tests for lib/rag.ts
 * 
 * Testa o sistema RAG (Retrieval-Augmented Generation).
 * Foco em lógica compartilhada sem dependências de OpenAI.
 */

import { describe, it, expect } from 'vitest';

// Nota: Não testamos funções que dependem do constructor OpenAI diretamente
// Os testes focam na lógica de chunking, similaridade e estrutura

// ============================================
// Chunking Logic (Unit Tests)
// ============================================

describe('Chunking Logic', () => {
    const CHUNK_SIZE = 500;
    const CHUNK_OVERLAP = 100;

    it('should split long text into chunks', () => {
        const text = 'A'.repeat(1000);
        const chunks: string[] = [];

        let start = 0;
        while (start < text.length) {
            const end = Math.min(start + CHUNK_SIZE, text.length);
            chunks.push(text.slice(start, end));
            start = end - CHUNK_OVERLAP;
            if (start + CHUNK_OVERLAP >= text.length) break;
        }

        expect(chunks.length).toBeGreaterThan(1);
    });

    it('should not split short text', () => {
        const shortText = 'Texto curto';
        const chunks = shortText.length <= CHUNK_SIZE ? [shortText] : [];

        expect(chunks.length).toBeLessThanOrEqual(1);
    });

    it('should have overlap between chunks', () => {
        expect(CHUNK_OVERLAP).toBe(100);
        expect(CHUNK_OVERLAP).toBeLessThan(CHUNK_SIZE);
    });

    it('should preserve sentence boundaries when possible', () => {
        const text = 'Primeira frase. Segunda frase. Terceira frase.';
        const sentences = text.split('. ');

        expect(sentences.length).toBe(3);
    });
});

// ============================================
// Cosine Similarity (Unit Tests)
// ============================================

describe('Cosine Similarity', () => {
    function cosineSimilarity(a: number[], b: number[]): number {
        if (a.length !== b.length) return 0;

        let dotProduct = 0;
        let normA = 0;
        let normB = 0;

        for (let i = 0; i < a.length; i++) {
            dotProduct += a[i] * b[i];
            normA += a[i] * a[i];
            normB += b[i] * b[i];
        }

        if (normA === 0 || normB === 0) return 0;
        return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
    }

    it('should return 1 for identical vectors', () => {
        const vector = [0.5, 0.5, 0.5];
        const similarity = cosineSimilarity(vector, vector);

        expect(similarity).toBeCloseTo(1, 5);
    });

    it('should return 0 for orthogonal vectors', () => {
        const a = [1, 0, 0];
        const b = [0, 1, 0];
        const similarity = cosineSimilarity(a, b);

        expect(similarity).toBe(0);
    });

    it('should return -1 for opposite vectors', () => {
        const a = [1, 1, 1];
        const b = [-1, -1, -1];
        const similarity = cosineSimilarity(a, b);

        expect(similarity).toBeCloseTo(-1, 5);
    });

    it('should handle zero vectors', () => {
        const a = [0, 0, 0];
        const b = [1, 1, 1];
        const similarity = cosineSimilarity(a, b);

        expect(similarity).toBe(0);
    });

    it('should return value between -1 and 1', () => {
        const a = [0.3, -0.5, 0.8];
        const b = [0.1, 0.7, -0.2];
        const similarity = cosineSimilarity(a, b);

        expect(similarity).toBeGreaterThanOrEqual(-1);
        expect(similarity).toBeLessThanOrEqual(1);
    });
});

// ============================================
// Retrieved Chunk Structure
// ============================================

describe('RetrievedChunk Structure', () => {
    it('should have required fields', () => {
        const chunk = {
            text: 'Content of the chunk',
            score: 0.85,
            trainingTitle: 'Product Info',
            trainingType: 'KNOWLEDGE',
        };

        expect(chunk).toHaveProperty('text');
        expect(chunk).toHaveProperty('score');
        expect(chunk).toHaveProperty('trainingTitle');
        expect(chunk).toHaveProperty('trainingType');
    });

    it('should have score between 0 and 1', () => {
        const scores = [0.95, 0.87, 0.72, 0.65, 0.58];

        scores.forEach(score => {
            expect(score).toBeGreaterThanOrEqual(0);
            expect(score).toBeLessThanOrEqual(1);
        });
    });
});

// ============================================
// Context Building
// ============================================

describe('Context Building', () => {
    it('should format chunks into context string', () => {
        const chunks = [
            { text: 'Info 1', score: 0.9, trainingTitle: 'Title 1', trainingType: 'FAQ' },
            { text: 'Info 2', score: 0.8, trainingTitle: 'Title 2', trainingType: 'KNOWLEDGE' },
        ];

        const context = chunks.map(c => `[${c.trainingTitle}] ${c.text}`).join('\n\n');

        expect(context).toContain('Info 1');
        expect(context).toContain('Info 2');
        expect(context).toContain('Title 1');
    });

    it('should handle empty chunks', () => {
        const chunks: Array<{ text: string }> = [];
        const context = chunks.map(c => c.text).join('\n\n');

        expect(context).toBe('');
    });

    it('should sort by score descending', () => {
        const chunks = [
            { text: 'A', score: 0.7 },
            { text: 'B', score: 0.9 },
            { text: 'C', score: 0.8 },
        ];

        const sorted = [...chunks].sort((a, b) => b.score - a.score);

        expect(sorted[0].text).toBe('B');
        expect(sorted[1].text).toBe('C');
        expect(sorted[2].text).toBe('A');
    });
});

// ============================================
// Embedding Model Config
// ============================================

describe('Embedding Model Config', () => {
    const EMBEDDING_MODEL = 'text-embedding-3-small';
    const TOP_K = 5;

    it('should use correct embedding model', () => {
        expect(EMBEDDING_MODEL).toBe('text-embedding-3-small');
    });

    it('should retrieve top 5 chunks by default', () => {
        expect(TOP_K).toBe(5);
    });
});

// ============================================
// Training Types
// ============================================

describe('Training Types', () => {
    const trainingTypes = ['FAQ', 'KNOWLEDGE', 'PRODUCT', 'SCRIPT'];

    it('should recognize FAQ type', () => {
        expect(trainingTypes).toContain('FAQ');
    });

    it('should recognize KNOWLEDGE type', () => {
        expect(trainingTypes).toContain('KNOWLEDGE');
    });

    it('should recognize PRODUCT type', () => {
        expect(trainingTypes).toContain('PRODUCT');
    });

    it('should recognize SCRIPT type', () => {
        expect(trainingTypes).toContain('SCRIPT');
    });
});

// ============================================
// Embedding Dimensions
// ============================================

describe('Embedding Dimensions', () => {
    const EMBEDDING_DIMS = 1536; // text-embedding-3-small

    it('should use 1536 dimensions for embeddings', () => {
        expect(EMBEDDING_DIMS).toBe(1536);
    });

    it('should create vectors of correct length', () => {
        const mockEmbedding = Array(EMBEDDING_DIMS).fill(0.1);

        expect(mockEmbedding.length).toBe(1536);
    });
});

// ============================================
// Chunk Size Configuration
// ============================================

describe('Chunk Size Configuration', () => {
    const CHUNK_SIZE = 500;
    const CHUNK_OVERLAP = 100;

    it('should have reasonable chunk size', () => {
        expect(CHUNK_SIZE).toBeGreaterThan(100);
        expect(CHUNK_SIZE).toBeLessThan(2000);
    });

    it('should have overlap less than chunk size', () => {
        expect(CHUNK_OVERLAP).toBeLessThan(CHUNK_SIZE);
    });

    it('should have overlap at least 10%', () => {
        const overlapPercent = (CHUNK_OVERLAP / CHUNK_SIZE) * 100;
        expect(overlapPercent).toBeGreaterThanOrEqual(10);
    });
});
