/**
 * Tests for lib/api-response.ts
 * 
 * Testa os helpers para respostas padronizadas de API.
 * 
 * PARA QUE SERVE:
 * - Consistência nas respostas da API
 * - Tratamento correto de erros
 * - Formato JSON uniforme
 */

import { describe, it, expect, vi } from 'vitest';
import {
    successResponse,
    errorResponse,
    jsonSuccess,
    jsonSuccessMessage,
    jsonError,
    jsonCreated,
    jsonNoContent,
    jsonApiError,
    handleApiError,
    handleApiErrorResponse,
    ApiErrors,
} from '@/lib/api-response';

// Mock do logger
vi.mock('@/lib/logger', () => ({
    logger: {
        info: vi.fn(),
        error: vi.fn(),
        warn: vi.fn(),
        debug: vi.fn(),
    },
}));

// ============================================
// successResponse / errorResponse
// ============================================

describe('successResponse', () => {
    it('should return success response with data', () => {
        const result = successResponse({ id: 1, name: 'Test' });

        expect(result.success).toBe(true);
        expect(result.data).toEqual({ id: 1, name: 'Test' });
    });

    it('should include message when provided', () => {
        const result = successResponse('data', 'Operation completed');

        expect(result.success).toBe(true);
        expect(result.message).toBe('Operation completed');
    });

    it('should handle null data', () => {
        const result = successResponse(null);

        expect(result.success).toBe(true);
        expect(result.data).toBeNull();
    });

    it('should handle array data', () => {
        const result = successResponse([1, 2, 3]);

        expect(result.success).toBe(true);
        expect(result.data).toEqual([1, 2, 3]);
    });
});

describe('errorResponse', () => {
    it('should return error response', () => {
        const result = errorResponse('Something went wrong');

        expect(result.success).toBe(false);
        expect(result.error).toBe('Something went wrong');
    });

    it('should not include data field', () => {
        const result = errorResponse('Error');

        expect(result.data).toBeUndefined();
    });
});

// ============================================
// jsonSuccess
// ============================================

describe('jsonSuccess', () => {
    it('should return NextResponse with status 200', () => {
        const response = jsonSuccess({ name: 'test' });

        expect(response.status).toBe(200);
    });

    it('should accept custom status code', () => {
        const response = jsonSuccess({ name: 'test' }, 202);

        expect(response.status).toBe(202);
    });

    it('should return JSON body', async () => {
        const response = jsonSuccess({ id: 1 });
        const body = await response.json();

        expect(body.success).toBe(true);
        expect(body.data).toEqual({ id: 1 });
    });
});

describe('jsonSuccessMessage', () => {
    it('should include message in response', async () => {
        const response = jsonSuccessMessage(
            { id: 1 },
            'Recurso criado com sucesso'
        );
        const body = await response.json();

        expect(body.success).toBe(true);
        expect(body.message).toBe('Recurso criado com sucesso');
    });
});

// ============================================
// jsonError
// ============================================

describe('jsonError', () => {
    it('should return error with default status 400', () => {
        const response = jsonError('Dados inválidos');

        expect(response.status).toBe(400);
    });

    it('should use custom status code', () => {
        const response = jsonError('Not found', 404);

        expect(response.status).toBe(404);
    });

    it('should return JSON error body', async () => {
        const response = jsonError('Erro de validação');
        const body = await response.json();

        expect(body.success).toBe(false);
        expect(body.error).toBe('Erro de validação');
    });
});

// ============================================
// jsonCreated / jsonNoContent
// ============================================

describe('jsonCreated', () => {
    it('should return status 201', () => {
        const response = jsonCreated({ id: 'new-123' });

        expect(response.status).toBe(201);
    });

    it('should include data in body', async () => {
        const response = jsonCreated({ id: 'new-123', name: 'New Item' });
        const body = await response.json();

        expect(body.success).toBe(true);
        expect(body.data.id).toBe('new-123');
    });
});

describe('jsonNoContent', () => {
    it('should return status 204', () => {
        const response = jsonNoContent();

        expect(response.status).toBe(204);
    });

    it('should have empty body', async () => {
        const response = jsonNoContent();
        const text = await response.text();

        expect(text).toBe('');
    });
});

// ============================================
// ApiErrors
// ============================================

describe('ApiErrors', () => {
    it('should have correct status codes for auth errors', () => {
        expect(ApiErrors.UNAUTHORIZED.status).toBe(401);
        expect(ApiErrors.INVALID_TOKEN.status).toBe(401);
        expect(ApiErrors.FORBIDDEN.status).toBe(403);
    });

    it('should have correct status codes for not found errors', () => {
        expect(ApiErrors.NOT_FOUND.status).toBe(404);
        expect(ApiErrors.USER_NOT_FOUND.status).toBe(404);
        expect(ApiErrors.AGENT_NOT_FOUND.status).toBe(404);
    });

    it('should have correct status codes for other errors', () => {
        expect(ApiErrors.BAD_REQUEST.status).toBe(400);
        expect(ApiErrors.CONFLICT.status).toBe(409);
        expect(ApiErrors.RATE_LIMIT.status).toBe(429);
        expect(ApiErrors.INTERNAL_ERROR.status).toBe(500);
    });

    it('should have messages in Portuguese', () => {
        expect(ApiErrors.UNAUTHORIZED.message).toContain('autorizado');
        expect(ApiErrors.FORBIDDEN.message).toContain('permissão');
        expect(ApiErrors.RATE_LIMIT.message).toContain('requisições');
    });
});

// ============================================
// jsonApiError
// ============================================

describe('jsonApiError', () => {
    it('should return predefined error with correct status', () => {
        const response = jsonApiError('UNAUTHORIZED');

        expect(response.status).toBe(401);
    });

    it('should use predefined message', async () => {
        const response = jsonApiError('NOT_FOUND');
        const body = await response.json();

        expect(body.error).toBe('Recurso não encontrado');
    });

    it('should allow custom message override', async () => {
        const response = jsonApiError('NOT_FOUND', 'Agente não existe');
        const body = await response.json();

        expect(body.error).toBe('Agente não existe');
    });
});

// ============================================
// handleApiError
// ============================================

describe('handleApiError', () => {
    it('should return error response for Error instance', () => {
        const result = handleApiError(new Error('Something failed'));

        expect(result.success).toBe(false);
        expect(result.error).toBe('Something failed');
    });

    it('should map Unauthorized error', () => {
        const result = handleApiError(new Error('Unauthorized'));

        expect(result.error).toBe('Não autorizado. Faça login novamente.');
    });

    it('should map Forbidden error', () => {
        const result = handleApiError(new Error('Forbidden'));

        expect(result.error).toBe('Acesso negado. Você não tem permissão.');
    });

    it('should handle non-Error objects', () => {
        const result = handleApiError('string error');

        expect(result.success).toBe(false);
        expect(result.error).toBe('Erro interno do servidor');
    });
});

// ============================================
// handleApiErrorResponse
// ============================================

describe('handleApiErrorResponse', () => {
    it('should return NextResponse for Error', () => {
        const response = handleApiErrorResponse(new Error('DB connection failed'));

        expect(response.status).toBe(500);
    });

    it('should return 401 for Unauthorized error', () => {
        const response = handleApiErrorResponse(new Error('Unauthorized'));

        expect(response.status).toBe(401);
    });

    it('should return 403 for Forbidden error', () => {
        const response = handleApiErrorResponse(new Error('Forbidden'));

        expect(response.status).toBe(403);
    });

    it('should return 500 for unknown errors', () => {
        const response = handleApiErrorResponse(null);

        expect(response.status).toBe(500);
    });

    it('should include error message in body', async () => {
        const response = handleApiErrorResponse(new Error('Custom error'));
        const body = await response.json();

        expect(body.success).toBe(false);
        expect(body.error).toBe('Custom error');
    });
});
