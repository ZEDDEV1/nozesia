/**
 * useAuth Hook - Centralized Authentication State
 * 
 * Manages user authentication state across the application.
 * Reduces code duplication in dashboard components.
 */

"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";

interface User {
    id: string;
    name: string;
    email: string;
    role: "SUPER_ADMIN" | "COMPANY_ADMIN" | "COMPANY_USER";
    avatar?: string;
    emailVerified?: boolean;
    companyId?: string;
}

interface TrialInfo {
    isActive: boolean;
    daysRemaining?: number;
    message?: string;
}

interface UseAuthReturn {
    user: User | null;
    loading: boolean;
    trial: TrialInfo | null;
    logout: () => Promise<void>;
    refresh: () => Promise<void>;
    isAuthenticated: boolean;
    isAdmin: boolean;
    companyId: string | null;
}

export function useAuth(): UseAuthReturn {
    const [user, setUser] = useState<User | null>(null);
    const [trial, setTrial] = useState<TrialInfo | null>(null);
    const [loading, setLoading] = useState(true);
    const router = useRouter();

    const fetchUser = useCallback(async () => {
        try {
            const response = await fetch("/api/auth/me");
            const data = await response.json();

            if (data.success) {
                setUser(data.data);
                if (data.data.trial) {
                    setTrial(data.data.trial);
                }
            } else {
                setUser(null);
            }
        } catch {
            setUser(null);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchUser();
    }, [fetchUser]);

    const logout = useCallback(async () => {
        try {
            await fetch("/api/auth/logout", { method: "POST" });
            setUser(null);
            router.push("/login");
        } catch (error) {
            console.error("Logout failed:", error);
        }
    }, [router]);

    const refresh = useCallback(async () => {
        setLoading(true);
        await fetchUser();
    }, [fetchUser]);

    return {
        user,
        loading,
        trial,
        logout,
        refresh,
        isAuthenticated: !!user,
        isAdmin: user?.role === "SUPER_ADMIN",
        companyId: user?.companyId || null,
    };
}
