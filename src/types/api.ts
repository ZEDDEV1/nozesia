/**
 * Centralized Type Definitions - API Types
 * 
 * Re-usable types for API responses.
 */

export interface ApiResponse<T = unknown> {
    success: boolean;
    data?: T;
    error?: string;
    message?: string;
}

export interface PaginatedResponse<T> {
    success: boolean;
    data: T[];
    pagination: {
        page: number;
        limit: number;
        total: number;
        pages: number;
    };
}

export interface ApiErrorInfo {
    message: string;
    status: number;
}
