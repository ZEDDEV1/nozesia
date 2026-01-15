/**
 * useFetch Hook - Generic Data Fetching with Loading and Error States
 * 
 * Provides a consistent pattern for fetching data with:
 * - Loading states
 * - Error handling
 * - Automatic refetch capabilities
 */

"use client";

import { useState, useEffect, useCallback } from "react";

interface UseFetchOptions {
    /** Skip initial fetch - useful for conditional fetching */
    skip?: boolean;
    /** Dependencies that trigger refetch */
    deps?: unknown[];
}

interface UseFetchReturn<T> {
    data: T | null;
    loading: boolean;
    error: string | null;
    refetch: () => Promise<void>;
    setData: (data: T | null) => void;
}

export function useFetch<T>(
    url: string,
    options: UseFetchOptions = {}
): UseFetchReturn<T> {
    const { skip = false, deps = [] } = options;

    const [data, setData] = useState<T | null>(null);
    const [loading, setLoading] = useState(!skip);
    const [error, setError] = useState<string | null>(null);

    const fetchData = useCallback(async () => {
        if (skip) return;

        setLoading(true);
        setError(null);

        try {
            const response = await fetch(url);
            const result = await response.json();

            if (result.success) {
                setData(result.data);
            } else {
                setError(result.error || "Erro ao carregar dados");
            }
        } catch (err) {
            console.error("Fetch error:", err);
            setError("Erro de conexão");
        } finally {
            setLoading(false);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [url, skip, ...deps]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const refetch = useCallback(async () => {
        await fetchData();
    }, [fetchData]);

    return { data, loading, error, refetch, setData };
}
