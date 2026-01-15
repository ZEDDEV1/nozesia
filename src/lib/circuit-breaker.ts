/**
 * Circuit Breaker Pattern - Proteção contra falhas em cascata
 * 
 * PARA QUE SERVE:
 * - Quando um serviço externo (WPPConnect) cai
 * - Em vez de 1000 requests esperando timeout de 30s
 * - Após 5 falhas, "abre" o circuito e retorna erro imediato
 * 
 * ESTADOS:
 * - FECHADO: Tudo normal, requests passam
 * - ABERTO: Serviço caiu, bloqueia requests por 60s
 * - SEMI-ABERTO: Após 60s, testa com 1 request
 * 
 * BENEFÍCIOS:
 * - Não sobrecarrega serviço que já está com problemas
 * - Resposta imediata em vez de timeout longo
 * - Sistema se recupera automaticamente
 * 
 * EXEMPLO:
 * WPPConnect caiu → 5 falhas → Circuit ABRE
 * Próximos 995 requests: "Serviço indisponível" em 10ms
 * Após 60s: Testa 1 request → Se OK, volta ao normal
 */

import { logger } from "./logger";

// ============================================
// TIPOS
// ============================================

export type CircuitState = "CLOSED" | "OPEN" | "HALF_OPEN";

export interface CircuitBreakerOptions {
    /** Nome do serviço (para logs) */
    name: string;
    /** Número de falhas antes de abrir o circuito (default: 5) */
    failureThreshold?: number;
    /** Tempo em ms que o circuito fica aberto (default: 60000) */
    resetTimeout?: number;
    /** Número de sucessos em HALF_OPEN para fechar (default: 2) */
    successThreshold?: number;
    /** Callback quando estado muda */
    onStateChange?: (from: CircuitState, to: CircuitState) => void;
}

export interface CircuitBreakerState {
    state: CircuitState;
    failures: number;
    successes: number;
    lastFailure: number;
    lastSuccess: number;
}

// ============================================
// CIRCUIT BREAKER CLASS
// ============================================

export class CircuitBreaker {
    private state: CircuitState = "CLOSED";
    private failures = 0;
    private successes = 0;
    private lastFailure = 0;
    private lastSuccess = 0;

    private readonly name: string;
    private readonly failureThreshold: number;
    private readonly resetTimeout: number;
    private readonly successThreshold: number;
    private readonly onStateChange?: (from: CircuitState, to: CircuitState) => void;

    constructor(options: CircuitBreakerOptions) {
        this.name = options.name;
        this.failureThreshold = options.failureThreshold ?? 5;
        this.resetTimeout = options.resetTimeout ?? 60000;
        this.successThreshold = options.successThreshold ?? 2;
        this.onStateChange = options.onStateChange;
    }

    /**
     * Executa uma função através do circuit breaker
     */
    async execute<T>(fn: () => Promise<T>): Promise<T> {
        // Verificar se deve tentar
        if (!this.canExecute()) {
            throw new CircuitBreakerError(
                `[${this.name}] Circuit breaker is OPEN - service unavailable`,
                this.name,
                this.state
            );
        }

        try {
            const result = await fn();
            this.onSuccess();
            return result;
        } catch (error) {
            this.onFailure();
            throw error;
        }
    }

    /**
     * Verifica se pode executar
     */
    private canExecute(): boolean {
        if (this.state === "CLOSED") {
            return true;
        }

        if (this.state === "OPEN") {
            // Verificar se já passou o timeout
            const now = Date.now();
            if (now - this.lastFailure >= this.resetTimeout) {
                this.transitionTo("HALF_OPEN");
                return true;
            }
            return false;
        }

        // HALF_OPEN: permite algumas requisições de teste
        return true;
    }

    /**
     * Chamado quando a operação tem sucesso
     */
    private onSuccess(): void {
        this.lastSuccess = Date.now();

        if (this.state === "HALF_OPEN") {
            this.successes++;
            if (this.successes >= this.successThreshold) {
                this.transitionTo("CLOSED");
            }
        } else if (this.state === "CLOSED") {
            // Reset failures on success
            this.failures = 0;
        }
    }

    /**
     * Chamado quando a operação falha
     */
    private onFailure(): void {
        this.lastFailure = Date.now();
        this.failures++;

        if (this.state === "HALF_OPEN") {
            // Falhou no teste, volta para OPEN
            this.transitionTo("OPEN");
        } else if (this.state === "CLOSED") {
            if (this.failures >= this.failureThreshold) {
                this.transitionTo("OPEN");
            }
        }
    }

    /**
     * Transição de estado
     */
    private transitionTo(newState: CircuitState): void {
        const oldState = this.state;
        this.state = newState;

        // Reset counters based on state transition
        if (newState === "CLOSED") {
            this.failures = 0;
            this.successes = 0;
        } else if (newState === "HALF_OPEN") {
            this.successes = 0;
        }

        logger.info(`[CircuitBreaker:${this.name}] State changed: ${oldState} → ${newState}`, {
            failures: this.failures,
            successes: this.successes,
        });

        if (this.onStateChange) {
            this.onStateChange(oldState, newState);
        }
    }

    /**
     * Força reset do circuit breaker (para testes/admin)
     */
    reset(): void {
        this.transitionTo("CLOSED");
        this.failures = 0;
        this.successes = 0;
    }

    /**
     * Retorna estado atual
     */
    getState(): CircuitBreakerState {
        return {
            state: this.state,
            failures: this.failures,
            successes: this.successes,
            lastFailure: this.lastFailure,
            lastSuccess: this.lastSuccess,
        };
    }

    /**
     * Verifica se está permitindo requests
     */
    isAvailable(): boolean {
        return this.canExecute();
    }
}

// ============================================
// ERRO CUSTOMIZADO
// ============================================

export class CircuitBreakerError extends Error {
    constructor(
        message: string,
        public readonly serviceName: string,
        public readonly circuitState: CircuitState
    ) {
        super(message);
        this.name = "CircuitBreakerError";
    }
}

// ============================================
// INSTÂNCIAS PARA SERVIÇOS
// ============================================

/**
 * Circuit breaker para WPPConnect
 * - Abre após 5 falhas
 * - Reseta após 60 segundos
 */
export const wppConnectCircuit = new CircuitBreaker({
    name: "WPPConnect",
    failureThreshold: 5,
    resetTimeout: 60000,  // 1 minuto
    successThreshold: 2,
    onStateChange: (from, to) => {
        if (to === "OPEN") {
            logger.error("[WPPConnect] Circuit breaker OPEN - WhatsApp service unavailable");
        } else if (to === "CLOSED") {
            logger.info("[WPPConnect] Circuit breaker CLOSED - WhatsApp service recovered");
        }
    },
});

/**
 * Circuit breaker para OpenAI
 * - Abre após 3 falhas (mais sensível)
 * - Reseta após 30 segundos (tenta mais rápido)
 */
export const openaiCircuit = new CircuitBreaker({
    name: "OpenAI",
    failureThreshold: 3,
    resetTimeout: 30000,  // 30 segundos
    successThreshold: 1,
    onStateChange: (from, to) => {
        if (to === "OPEN") {
            logger.error("[OpenAI] Circuit breaker OPEN - AI service unavailable");
        } else if (to === "CLOSED") {
            logger.info("[OpenAI] Circuit breaker CLOSED - AI service recovered");
        }
    },
});

// ============================================
// HELPERS
// ============================================

/**
 * Wrapper para executar com circuit breaker do WPPConnect
 */
export async function withWPPConnectCircuit<T>(fn: () => Promise<T>): Promise<T> {
    return wppConnectCircuit.execute(fn);
}

/**
 * Wrapper para executar com circuit breaker do OpenAI
 */
export async function withOpenAICircuit<T>(fn: () => Promise<T>): Promise<T> {
    return openaiCircuit.execute(fn);
}

/**
 * Verifica se todos os serviços estão disponíveis
 */
export function getCircuitBreakerStatus(): Record<string, CircuitBreakerState> {
    return {
        wppconnect: wppConnectCircuit.getState(),
        openai: openaiCircuit.getState(),
    };
}
