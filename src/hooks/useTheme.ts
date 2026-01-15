/**
 * useTheme Hook - Dark/Light/System Mode Toggle
 * 
 * Manages theme preference with localStorage persistence.
 * Supports: dark, light, and system (auto) modes.
 */

"use client";

import { useState, useEffect, useCallback, useMemo } from "react";

type Theme = "dark" | "light" | "system";
type ResolvedTheme = "dark" | "light";

interface UseThemeReturn {
    theme: Theme;
    resolvedTheme: ResolvedTheme;
    setTheme: (theme: Theme) => void;
    toggleTheme: () => void;
    cycleTheme: () => void;
    isDark: boolean;
    isLight: boolean;
    isSystem: boolean;
}

const THEME_KEY = "theme-preference";

function getSystemTheme(): ResolvedTheme {
    if (typeof window === "undefined") return "dark";
    return window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark";
}

function getSavedTheme(): Theme | null {
    if (typeof window === "undefined") return null;
    return localStorage.getItem(THEME_KEY) as Theme | null;
}

function resolveTheme(theme: Theme, systemTheme: ResolvedTheme): ResolvedTheme {
    if (theme === "system") return systemTheme;
    return theme;
}

export function useTheme(): UseThemeReturn {
    // Initialize with saved preference or default to dark
    const [theme, setThemeState] = useState<Theme>(() => {
        if (typeof window === "undefined") return "dark";
        const saved = getSavedTheme();
        return saved || "dark";
    });

    // Track system theme separately to handle system preference changes
    const [systemTheme, setSystemTheme] = useState<ResolvedTheme>(() => {
        if (typeof window === "undefined") return "dark";
        return getSystemTheme();
    });

    // Compute resolved theme from state (no effect needed)
    const resolvedTheme = useMemo(() => {
        return resolveTheme(theme, systemTheme);
    }, [theme, systemTheme]);

    // Apply theme to DOM only (no setState)
    const applyThemeToDOM = useCallback((resolved: ResolvedTheme) => {
        if (typeof document === "undefined") return;
        document.documentElement.setAttribute("data-theme", resolved);
        document.documentElement.style.transition = "background-color 0.3s ease, color 0.3s ease";
    }, []);

    // Apply theme on mount and when resolved theme changes
    useEffect(() => {
        applyThemeToDOM(resolvedTheme);
    }, [resolvedTheme, applyThemeToDOM]);

    // Listen for system theme changes
    useEffect(() => {
        if (typeof window === "undefined") return;

        const mediaQuery = window.matchMedia("(prefers-color-scheme: light)");

        const handleChange = () => {
            // Update system theme state - this will trigger resolvedTheme recalculation
            setSystemTheme(getSystemTheme());
        };

        mediaQuery.addEventListener("change", handleChange);
        return () => mediaQuery.removeEventListener("change", handleChange);
    }, []);

    const setTheme = useCallback((newTheme: Theme) => {
        setThemeState(newTheme);
        localStorage.setItem(THEME_KEY, newTheme);
    }, []);

    // Simple toggle between dark and light
    const toggleTheme = useCallback(() => {
        const newTheme = resolvedTheme === "dark" ? "light" : "dark";
        setTheme(newTheme);
    }, [resolvedTheme, setTheme]);

    // Cycle through: dark -> system -> light -> dark
    const cycleTheme = useCallback(() => {
        const themeOrder: Theme[] = ["dark", "system", "light"];
        const currentIndex = themeOrder.indexOf(theme);
        const nextIndex = (currentIndex + 1) % themeOrder.length;
        setTheme(themeOrder[nextIndex]);
    }, [theme, setTheme]);

    return {
        theme,
        resolvedTheme,
        setTheme,
        toggleTheme,
        cycleTheme,
        isDark: resolvedTheme === "dark",
        isLight: resolvedTheme === "light",
        isSystem: theme === "system",
    };
}

