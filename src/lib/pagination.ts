/**
 * Helper de Paginação
 * 
 * Sistema reutilizável para paginação cursor-based e offset-based.
 * 
 * CURSOR-BASED: Mais eficiente para grandes datasets
 * OFFSET-BASED: Mais simples, bom para datasets menores
 */

import { z } from "zod";

// ============================================
// TIPOS
// ============================================

export interface PaginationParams {
    page?: number;
    limit?: number;
    cursor?: string;
    sortBy?: string;
    sortOrder?: "asc" | "desc";
}

export interface PaginatedResponse<T> {
    data: T[];
    pagination: {
        page: number;
        limit: number;
        total: number;
        totalPages: number;
        hasMore: boolean;
        nextCursor?: string;
        prevCursor?: string;
    };
}

export interface CursorPaginatedResponse<T> {
    data: T[];
    pagination: {
        limit: number;
        hasMore: boolean;
        nextCursor?: string;
    };
}

// ============================================
// SCHEMAS DE VALIDAÇÃO
// ============================================

export const paginationSchema = z.object({
    page: z.coerce.number().int().positive().default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
    sortBy: z.string().optional(),
    sortOrder: z.enum(["asc", "desc"]).default("desc"),
});

export const cursorPaginationSchema = z.object({
    cursor: z.string().optional(),
    limit: z.coerce.number().int().min(1).max(100).default(20),
    sortOrder: z.enum(["asc", "desc"]).default("desc"),
});

// ============================================
// FUNÇÕES HELPER
// ============================================

/**
 * Parseia parâmetros de paginação da URL
 */
export function parsePaginationParams(searchParams: URLSearchParams): PaginationParams {
    const parsed = paginationSchema.safeParse({
        page: searchParams.get("page"),
        limit: searchParams.get("limit"),
        sortBy: searchParams.get("sortBy"),
        sortOrder: searchParams.get("sortOrder"),
    });

    if (!parsed.success) {
        return { page: 1, limit: 20, sortOrder: "desc" };
    }

    return parsed.data;
}

/**
 * Parseia parâmetros de paginação cursor-based
 */
export function parseCursorParams(searchParams: URLSearchParams): { cursor?: string; limit: number; sortOrder: "asc" | "desc" } {
    const parsed = cursorPaginationSchema.safeParse({
        cursor: searchParams.get("cursor"),
        limit: searchParams.get("limit"),
        sortOrder: searchParams.get("sortOrder"),
    });

    if (!parsed.success) {
        return { limit: 20, sortOrder: "desc" };
    }

    return parsed.data;
}

/**
 * Calcula skip e take para Prisma (offset-based)
 */
export function getPrismaOffsetParams(params: PaginationParams): { skip: number; take: number } {
    const page = params.page || 1;
    const limit = params.limit || 20;

    return {
        skip: (page - 1) * limit,
        take: limit,
    };
}

/**
 * Calcula cursor params para Prisma (cursor-based)
 */
export function getPrismaCursorParams(cursor?: string, limit: number = 20): {
    cursor?: { id: string };
    skip?: number;
    take: number;
} {
    if (!cursor) {
        return { take: limit + 1 }; // +1 para verificar se há mais
    }

    return {
        cursor: { id: cursor },
        skip: 1, // Pular o cursor atual
        take: limit + 1,
    };
}

/**
 * Formata resposta paginada (offset-based)
 */
export function formatPaginatedResponse<T>(
    data: T[],
    total: number,
    params: PaginationParams
): PaginatedResponse<T> {
    const page = params.page || 1;
    const limit = params.limit || 20;
    const totalPages = Math.ceil(total / limit);

    return {
        data,
        pagination: {
            page,
            limit,
            total,
            totalPages,
            hasMore: page < totalPages,
        },
    };
}

/**
 * Formata resposta paginada (cursor-based)
 */
export function formatCursorPaginatedResponse<T extends { id: string }>(
    data: T[],
    limit: number
): CursorPaginatedResponse<T> {
    const hasMore = data.length > limit;
    const items = hasMore ? data.slice(0, limit) : data;
    const nextCursor = hasMore ? items[items.length - 1]?.id : undefined;

    return {
        data: items,
        pagination: {
            limit,
            hasMore,
            nextCursor,
        },
    };
}

/**
 * Gera link de paginação
 */
export function getPaginationLinks(
    baseUrl: string,
    currentPage: number,
    totalPages: number
): { prev?: string; next?: string; first: string; last: string } {
    const url = new URL(baseUrl);

    return {
        prev: currentPage > 1
            ? `${url.pathname}?page=${currentPage - 1}`
            : undefined,
        next: currentPage < totalPages
            ? `${url.pathname}?page=${currentPage + 1}`
            : undefined,
        first: `${url.pathname}?page=1`,
        last: `${url.pathname}?page=${totalPages}`,
    };
}

// ============================================
// DEFAULTS
// ============================================

export const DEFAULT_PAGE_SIZE = 20;
export const MAX_PAGE_SIZE = 100;
