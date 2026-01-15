"use client";

import React, { Component, ReactNode } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";

interface Props {
    children: ReactNode;
    fallback?: ReactNode;
    onError?: (error: Error, errorInfo: React.ErrorInfo) => void;
}

interface State {
    hasError: boolean;
    error: Error | null;
}

/**
 * Error Boundary Component
 * 
 * Catches JavaScript errors in child component tree and displays
 * a fallback UI instead of crashing the whole page.
 * 
 * Usage:
 * <ErrorBoundary fallback={<CustomError />}>
 *     <MyComponent />
 * </ErrorBoundary>
 */
export class ErrorBoundary extends Component<Props, State> {
    constructor(props: Props) {
        super(props);
        this.state = { hasError: false, error: null };
    }

    static getDerivedStateFromError(error: Error): State {
        return { hasError: true, error };
    }

    componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void {
        console.error("ErrorBoundary caught an error:", error, errorInfo);
        this.props.onError?.(error, errorInfo);
    }

    handleRetry = (): void => {
        this.setState({ hasError: false, error: null });
    };

    render(): ReactNode {
        if (this.state.hasError) {
            if (this.props.fallback) {
                return this.props.fallback;
            }

            return (
                <div className="dash-card" style={{ textAlign: "center", padding: "2rem" }}>
                    <AlertTriangle
                        size={48}
                        style={{ color: "var(--warning)", marginBottom: "1rem" }}
                    />
                    <h3 style={{ marginBottom: "0.5rem" }}>Algo deu errado</h3>
                    <p style={{ color: "var(--text-muted)", marginBottom: "1rem" }}>
                        {this.state.error?.message || "Erro inesperado ao carregar este componente."}
                    </p>
                    <button
                        className="dash-btn dash-btn-primary"
                        onClick={this.handleRetry}
                        style={{ display: "inline-flex", alignItems: "center", gap: "0.5rem" }}
                    >
                        <RefreshCw size={16} />
                        Tentar novamente
                    </button>
                </div>
            );
        }

        return this.props.children;
    }
}

/**
 * Higher-order component to wrap any component with error boundary
 */
export function withErrorBoundary<P extends object>(
    WrappedComponent: React.ComponentType<P>,
    fallback?: ReactNode
): React.FC<P> {
    return function WithErrorBoundaryWrapper(props: P) {
        return (
            <ErrorBoundary fallback={fallback}>
                <WrappedComponent {...props} />
            </ErrorBoundary>
        );
    };
}
