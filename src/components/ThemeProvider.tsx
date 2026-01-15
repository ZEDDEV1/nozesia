"use client";

import { useEffect } from "react";

type Theme = "dark" | "light" | "system";
type ResolvedTheme = "dark" | "light";

const THEME_KEY = "theme-preference";

function getSystemTheme(): ResolvedTheme {
    if (typeof window === "undefined") return "dark";
    return window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark";
}

function getSavedTheme(): Theme | null {
    if (typeof window === "undefined") return null;
    return localStorage.getItem(THEME_KEY) as Theme | null;
}

function resolveTheme(theme: Theme): ResolvedTheme {
    if (theme === "system") return getSystemTheme();
    return theme;
}

function applyTheme(resolved: ResolvedTheme) {
    if (typeof document === "undefined") return;
    document.documentElement.setAttribute("data-theme", resolved);
}

/**
 * ThemeProvider - Initializes theme on app mount
 * 
 * This component ensures the theme is applied on initial page load,
 * regardless of which page the user lands on. Default is "dark".
 */
export function ThemeProvider({ children }: { children: React.ReactNode }) {
    useEffect(() => {
        // Get saved theme or default to dark
        const savedTheme = getSavedTheme() || "dark";
        const resolvedTheme = resolveTheme(savedTheme);
        applyTheme(resolvedTheme);

        // Listen for system theme changes (only relevant if theme is "system")
        const mediaQuery = window.matchMedia("(prefers-color-scheme: light)");
        const handleChange = () => {
            const currentTheme = getSavedTheme() || "dark";
            if (currentTheme === "system") {
                applyTheme(resolveTheme("system"));
            }
        };

        mediaQuery.addEventListener("change", handleChange);
        return () => mediaQuery.removeEventListener("change", handleChange);
    }, []);

    return <>{children}</>;
}
