"use client";

import React, { createContext, useContext, useState, useCallback, ReactNode } from "react";

interface ModulesContextType {
    enabledModules: string[];
    setEnabledModules: (modules: string[]) => void;
    refreshModules: () => Promise<void>;
}

const ModulesContext = createContext<ModulesContextType | null>(null);

export function useModules() {
    const context = useContext(ModulesContext);
    if (!context) {
        throw new Error("useModules must be used within a ModulesProvider");
    }
    return context;
}

interface ModulesProviderProps {
    children: ReactNode;
    initialModules?: string[];
}

export function ModulesProvider({ children, initialModules = [] }: ModulesProviderProps) {
    const [enabledModules, setEnabledModulesState] = useState<string[]>(initialModules);

    const setEnabledModules = useCallback((modules: string[]) => {
        setEnabledModulesState(modules);
    }, []);

    const refreshModules = useCallback(async () => {
        try {
            const response = await fetch("/api/company");
            const data = await response.json();
            if (data.success && data.data?.enabledModules) {
                const modules = JSON.parse(data.data.enabledModules || "[]");
                if (Array.isArray(modules)) {
                    setEnabledModulesState(modules);
                }
            }
        } catch (error) {
            console.error("Error refreshing modules:", error);
        }
    }, []);

    return (
        <ModulesContext.Provider value={{ enabledModules, setEnabledModules, refreshModules }}>
            {children}
        </ModulesContext.Provider>
    );
}
