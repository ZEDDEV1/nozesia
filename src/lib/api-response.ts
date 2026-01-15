/**
 * API Response Helpers
 * 
 * Utilitários para padronizar respostas de API.
 * Fornece helpers para sucesso, erro e tratamento de exceções.
 */

import { NextResponse } from "next/server";
import { logger } from "./logger";

// ============================================
// TYPES
// ============================================

export type ApiResponse<T = unknown> = {
    success: boolean;
    data?: T;
    error?: string;
    message?: string;
};

// ============================================
// BASIC RESPONSE BUILDERS
// ============================================

export function successResponse<T>(data: T, message?: string): ApiResponse<T> {
    return {
        success: true,
        data,
        message,
    };
}

export function errorResponse(error: string): ApiResponse {
    return {
        success: false,
        error,
    };
}

// ============================================
// NEXTJS RESPONSE HELPERS
// ============================================

/**
 * Return JSON success response with proper status code
 */
export function jsonSuccess<T>(data: T, status = 200): NextResponse {
    return NextResponse.json(successResponse(data), { status });
}

/**
 * Return JSON success with custom message
 */
export function jsonSuccessMessage<T>(data: T, message: string, status = 200): NextResponse {
    return NextResponse.json(successResponse(data, message), { status });
}

/**
 * Return JSON error response with proper status code
 */
export function jsonError(error: string, status = 400): NextResponse {
    return NextResponse.json(errorResponse(error), { status });
}

/**
 * Return 201 Created response
 */
export function jsonCreated<T>(data: T): NextResponse {
    return NextResponse.json(successResponse(data), { status: 201 });
}

/**
 * Return 204 No Content response
 */
export function jsonNoContent(): NextResponse {
    return new NextResponse(null, { status: 204 });
}

// ============================================
// STANDARD ERROR CODES
// ============================================

export const ApiErrors = {
    // 400 - Bad Request
    BAD_REQUEST: { message: "Requisição inválida", status: 400 },
    VALIDATION_ERROR: { message: "Erro de validação", status: 400 },
    MISSING_FIELDS: { message: "Campos obrigatórios faltando", status: 400 },

    // 401 - Unauthorized
    UNAUTHORIZED: { message: "Não autorizado. Faça login novamente.", status: 401 },
    INVALID_TOKEN: { message: "Token inválido ou expirado", status: 401 },

    // 403 - Forbidden
    FORBIDDEN: { message: "Acesso negado. Você não tem permissão.", status: 403 },

    // 404 - Not Found
    NOT_FOUND: { message: "Recurso não encontrado", status: 404 },
    USER_NOT_FOUND: { message: "Usuário não encontrado", status: 404 },
    AGENT_NOT_FOUND: { message: "Agente não encontrado", status: 404 },
    COMPANY_NOT_FOUND: { message: "Empresa não encontrada", status: 404 },
    CONVERSATION_NOT_FOUND: { message: "Conversa não encontrada", status: 404 },

    // 409 - Conflict
    CONFLICT: { message: "Conflito com recurso existente", status: 409 },
    ALREADY_EXISTS: { message: "Recurso já existe", status: 409 },

    // 429 - Rate Limit
    RATE_LIMIT: { message: "Muitas requisições. Tente novamente em alguns segundos.", status: 429 },

    // 500 - Server Error
    INTERNAL_ERROR: { message: "Erro interno do servidor", status: 500 },
    DATABASE_ERROR: { message: "Erro no banco de dados", status: 500 },
} as const;

export type ApiErrorCode = keyof typeof ApiErrors;

/**
 * Return error from predefined error code
 */
export function jsonApiError(code: ApiErrorCode, customMessage?: string): NextResponse {
    const error = ApiErrors[code];
    return jsonError(customMessage || error.message, error.status);
}

// ============================================
// ERROR HANDLER
// ============================================

/**
 * Handle unknown errors and return appropriate response
 */
export function handleApiError(error: unknown): ApiResponse {
    logger.error("API Error", { error });

    if (error instanceof Error) {
        // Map common error messages
        if (error.message === "Unauthorized") {
            return errorResponse(ApiErrors.UNAUTHORIZED.message);
        }
        if (error.message === "Forbidden") {
            return errorResponse(ApiErrors.FORBIDDEN.message);
        }
        return errorResponse(error.message);
    }

    return errorResponse(ApiErrors.INTERNAL_ERROR.message);
}

/**
 * Handle error and return NextResponse
 */
export function handleApiErrorResponse(error: unknown): NextResponse {
    logger.error("API Error", { error });

    if (error instanceof Error) {
        if (error.message === "Unauthorized") {
            return jsonApiError("UNAUTHORIZED");
        }
        if (error.message === "Forbidden") {
            return jsonApiError("FORBIDDEN");
        }
        // For other errors, return the message but with 500 status
        return jsonError(error.message, 500);
    }

    return jsonApiError("INTERNAL_ERROR");
}

// ============================================
// ASYNC HANDLER WRAPPER
// ============================================

type ApiHandler = (request: Request, context?: unknown) => Promise<NextResponse>;

/**
 * Wrap API handler with automatic error handling
 * 
 * Usage:
 * export const GET = withErrorHandler(async (request) => {
 *     const data = await fetchData();
 *     return jsonSuccess(data);
 * });
 */
export function withErrorHandler(handler: ApiHandler): ApiHandler {
    return async (request: Request, context?: unknown) => {
        try {
            return await handler(request, context);
        } catch (error) {
            return handleApiErrorResponse(error);
        }
    };
}

