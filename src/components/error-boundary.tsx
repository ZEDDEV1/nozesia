"use client";

import { Component, ReactNode } from "react";

interface Props {
    children: ReactNode;
    fallback?: ReactNode;
}

interface State {
    hasError: boolean;
    error: Error | null;
}

/**
 * Error Boundary para capturar erros em componentes filhos.
 * Exibe uma UI de fallback ao invés de quebrar toda a página.
 */
export class ErrorBoundary extends Component<Props, State> {
    constructor(props: Props) {
        super(props);
        this.state = { hasError: false, error: null };
    }

    static getDerivedStateFromError(error: Error): State {
        return { hasError: true, error };
    }

    componentDidCatch(error: Error, info: React.ErrorInfo) {
        // Log the error - in a real app, send to error tracking service
        console.error("[ErrorBoundary] Caught error:", error, info);
    }

    render() {
        if (this.state.hasError) {
            if (this.props.fallback) {
                return this.props.fallback;
            }

            return (
                <div className="error-boundary-fallback">
                    <div className="error-boundary-content">
                        <span className="error-boundary-icon">⚠️</span>
                        <h3>Algo deu errado</h3>
                        <p>Ocorreu um erro ao carregar este componente.</p>
                        <button
                            onClick={() => this.setState({ hasError: false, error: null })}
                            className="dash-btn primary sm"
                        >
                            Tentar novamente
                        </button>
                    </div>
                </div>
            );
        }

        return this.props.children;
    }
}
