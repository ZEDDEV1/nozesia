/**
 * RAG (Retrieval-Augmented Generation) Service
 * 
 * Provides semantic search capabilities for AI agent training data.
 * Uses OpenAI embeddings + PostgreSQL for vector storage.
 */

import OpenAI from "openai";
import { prisma } from "./prisma";

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});

// Configuration
const CHUNK_SIZE = 500; // tokens (~2000 characters)
const CHUNK_OVERLAP = 100; // tokens of overlap between chunks
const EMBEDDING_MODEL = "text-embedding-3-small";
const TOP_K = 5; // Number of relevant chunks to retrieve

// ============================
// CHUNKING
// ============================

/**
 * Split text into overlapping chunks for better context preservation
 */
export function splitIntoChunks(text: string): string[] {
    const chunks: string[] = [];

    // Approximate 4 characters per token for Portuguese
    const charPerToken = 4;
    const chunkChars = CHUNK_SIZE * charPerToken;
    const overlapChars = CHUNK_OVERLAP * charPerToken;

    // Clean and normalize text
    const cleanText = text
        .replace(/\s+/g, " ")
        .trim();

    if (cleanText.length <= chunkChars) {
        return [cleanText];
    }

    let startIndex = 0;

    while (startIndex < cleanText.length) {
        let endIndex = startIndex + chunkChars;

        // Try to break at sentence boundary
        if (endIndex < cleanText.length) {
            const possibleBreaks = [". ", "! ", "? ", "\n", "; "];
            let bestBreak = endIndex;

            for (const breakChar of possibleBreaks) {
                const breakIdx = cleanText.lastIndexOf(breakChar, endIndex);
                if (breakIdx > startIndex + (chunkChars / 2)) {
                    bestBreak = breakIdx + breakChar.length;
                    break;
                }
            }

            endIndex = bestBreak;
        } else {
            endIndex = cleanText.length;
        }

        const chunk = cleanText.slice(startIndex, endIndex).trim();
        if (chunk.length > 0) {
            chunks.push(chunk);
        }

        // Move start with overlap
        startIndex = endIndex - overlapChars;
        if (startIndex >= cleanText.length) break;
    }

    return chunks;
}

// ============================
// EMBEDDINGS
// ============================

/**
 * Generate embedding vector for a text using OpenAI
 */
export async function generateEmbedding(text: string): Promise<number[]> {
    const response = await openai.embeddings.create({
        model: EMBEDDING_MODEL,
        input: text,
    });

    return response.data[0].embedding;
}

/**
 * Calculate cosine similarity between two vectors
 */
export function cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length) return 0;

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < a.length; i++) {
        dotProduct += a[i] * b[i];
        normA += a[i] * a[i];
        normB += b[i] * b[i];
    }

    const magnitude = Math.sqrt(normA) * Math.sqrt(normB);
    return magnitude === 0 ? 0 : dotProduct / magnitude;
}

// ============================
// INDEXING (Process Training Data)
// ============================

/**
 * Process a single training data entry: chunk it and generate embeddings
 */
export async function processTrainingData(trainingId: string): Promise<void> {
    const training = await prisma.trainingData.findUnique({
        where: { id: trainingId },
    });

    if (!training) {
        throw new Error(`Training data not found: ${trainingId}`);
    }

    // Update status to processing
    await prisma.trainingData.update({
        where: { id: trainingId },
        data: { embeddingStatus: "processing" },
    });

    try {
        // Delete existing embeddings
        await prisma.trainingEmbedding.deleteMany({
            where: { trainingId },
        });

        // Combine title and content for chunking
        const fullText = `${training.title}\n\n${training.content}`;
        const chunks = splitIntoChunks(fullText);

        // Generate embeddings for each chunk
        for (let i = 0; i < chunks.length; i++) {
            const chunkText = chunks[i];
            const embedding = await generateEmbedding(chunkText);

            await prisma.trainingEmbedding.create({
                data: {
                    trainingId,
                    chunkIndex: i,
                    chunkText,
                    embedding: JSON.stringify(embedding),
                },
            });
        }

        // Update status to completed
        await prisma.trainingData.update({
            where: { id: trainingId },
            data: { embeddingStatus: "completed" },
        });

        console.log(`[RAG] Processed training ${trainingId}: ${chunks.length} chunks`);
    } catch (error) {
        console.error(`[RAG] Error processing training ${trainingId}:`, error);

        await prisma.trainingData.update({
            where: { id: trainingId },
            data: { embeddingStatus: "error" },
        });

        throw error;
    }
}

/**
 * Process all pending training data for an agent
 */
export async function processAgentTrainingData(agentId: string): Promise<void> {
    const pendingTraining = await prisma.trainingData.findMany({
        where: {
            agentId,
            embeddingStatus: "pending",
        },
    });

    for (const training of pendingTraining) {
        await processTrainingData(training.id);
    }
}

// ============================
// RETRIEVAL (Semantic Search)
// ============================

interface RetrievedChunk {
    text: string;
    score: number;
    trainingTitle: string;
    trainingType: string;
}

/**
 * Search for relevant chunks based on a query
 */
export async function searchRelevantContext(
    agentId: string,
    query: string,
    topK: number = TOP_K
): Promise<RetrievedChunk[]> {
    // Get all embeddings for this agent
    const embeddings = await prisma.trainingEmbedding.findMany({
        where: {
            training: {
                agentId,
                embeddingStatus: "completed",
            },
        },
        include: {
            training: {
                select: {
                    title: true,
                    type: true,
                },
            },
        },
    });

    if (embeddings.length === 0) {
        return [];
    }

    // Generate embedding for the query
    const queryEmbedding = await generateEmbedding(query);

    // Calculate similarity scores
    const scored = embeddings.map((emb) => {
        const embeddingVector = JSON.parse(emb.embedding) as number[];
        const score = cosineSimilarity(queryEmbedding, embeddingVector);

        return {
            text: emb.chunkText,
            score,
            trainingTitle: emb.training.title,
            trainingType: emb.training.type,
        };
    });

    // Sort by score and take top K
    scored.sort((a, b) => b.score - a.score);

    // Filter by minimum relevance threshold
    const RELEVANCE_THRESHOLD = 0.3;
    const relevant = scored.filter((s) => s.score >= RELEVANCE_THRESHOLD);

    return relevant.slice(0, topK);
}

/**
 * Build context string from retrieved chunks for the AI prompt
 */
export function buildContextFromChunks(chunks: RetrievedChunk[]): string {
    if (chunks.length === 0) {
        return "";
    }

    const contextParts = chunks.map((chunk, i) => {
        return `[Fonte ${i + 1}: ${chunk.trainingTitle}]\n${chunk.text}`;
    });

    return `
## Informações Relevantes (Base de Conhecimento)

${contextParts.join("\n\n---\n\n")}

---
Use as informações acima para responder à pergunta do cliente de forma precisa.
Se a informação não estiver na base de conhecimento, responda com base no seu conhecimento geral, mas deixe claro se não tiver certeza.
`;
}

// ============================
// HIGH-LEVEL API
// ============================

/**
 * Main function to get relevant context for a customer message
 */
export async function getRelevantContext(
    agentId: string,
    customerMessage: string
): Promise<string> {
    try {
        const chunks = await searchRelevantContext(agentId, customerMessage);
        return buildContextFromChunks(chunks);
    } catch (error) {
        console.error("[RAG] Error getting relevant context:", error);
        return "";
    }
}

/**
 * Check if agent has any embedded training data
 */
export async function hasEmbeddedTrainingData(agentId: string): Promise<boolean> {
    const count = await prisma.trainingEmbedding.count({
        where: {
            training: {
                agentId,
                embeddingStatus: "completed",
            },
        },
    });

    return count > 0;
}
