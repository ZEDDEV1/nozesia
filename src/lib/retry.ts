/**
 * Retry Pattern - Resiliência para chamadas externas
 * 
 * PARA QUE SERVE:
 * - Quando APIs externas (OpenAI, WPPConnect) falham temporariamente
 * - O sistema tenta de novo automaticamente
 * - Usa "exponential backoff" (espera 1s, depois 2s, depois 4s)
 * 
 * BENEFÍCIOS:
 * - 90% dos erros temporários são resolvidos no retry
 * - Cliente nem percebe que houve problema
 * - Evita frustração do usuário
 * 
 * EXEMPLO:
 * OpenAI timeout → Espera 1s → Tenta de novo → Funciona! ✅
 */

import { logger } from "./logger";

// ============================================
// TIPOS
// ============================================

export interface RetryOptions {
    /** Número máximo de tentativas (default: 3) */
    maxRetries?: number;
    /** Delay inicial em ms (default: 1000) */
    initialDelay?: number;
    /** Fator de multiplicação do delay (default: 2) */
    backoffFactor?: number;
    /** Delay máximo em ms (default: 10000) */
    maxDelay?: number;
    /** Callback chamado em cada retry */
    onRetry?: (error: Error, attempt: number) => void;
    /** Função para decidir se deve fazer retry (default: sempre) */
    shouldRetry?: (error: Error) => boolean;
}

export interface RetryResult<T> {
    success: boolean;
    data?: T;
    error?: Error;
    attempts: number;
}

// ============================================
// CONFIGURAÇÕES PADRÃO
// ============================================

const DEFAULT_OPTIONS: Required<Omit<RetryOptions, "onRetry" | "shouldRetry">> = {
    maxRetries: 3,
    initialDelay: 1000,     // 1 segundo
    backoffFactor: 2,       // Dobra a cada tentativa
    maxDelay: 10000,        // Máximo 10 segundos
};

// ============================================
// FUNÇÕES DE RETRY
// ============================================

/**
 * Executa uma função com retry automático
 * 
 * @example
 * const result = await retry(
 *     async () => await openai.chat.completions.create(...),
 *     { maxRetries: 3 }
 * );
 */
export async function retry<T>(
    fn: () => Promise<T>,
    options: RetryOptions = {}
): Promise<T> {
    const opts = { ...DEFAULT_OPTIONS, ...options };
    let lastError: Error = new Error("Unknown error");
    let delay = opts.initialDelay;

    for (let attempt = 1; attempt <= opts.maxRetries + 1; attempt++) {
        try {
            return await fn();
        } catch (error) {
            lastError = error instanceof Error ? error : new Error(String(error));

            // Última tentativa? Não faz retry
            if (attempt > opts.maxRetries) {
                break;
            }

            // Verificar se deve fazer retry
            if (opts.shouldRetry && !opts.shouldRetry(lastError)) {
                logger.debug(`[Retry] Skipping retry - error not retryable`, {
                    error: lastError.message,
                    attempt,
                });
                break;
            }

            // Callback de retry
            if (opts.onRetry) {
                opts.onRetry(lastError, attempt);
            }

            logger.warn(`[Retry] Attempt ${attempt} failed, retrying in ${delay}ms`, {
                error: lastError.message,
                attempt,
                nextDelay: delay,
            });

            // Aguardar antes do próximo retry
            await sleep(delay);

            // Calcular próximo delay (exponential backoff)
            delay = Math.min(delay * opts.backoffFactor, opts.maxDelay);
        }
    }

    // Todas as tentativas falharam
    logger.error(`[Retry] All attempts failed`, {
        error: lastError.message,
        totalAttempts: opts.maxRetries + 1,
    });

    throw lastError;
}

/**
 * Versão que retorna resultado em vez de throw
 */
export async function retryWithResult<T>(
    fn: () => Promise<T>,
    options: RetryOptions = {}
): Promise<RetryResult<T>> {
    const opts = { ...DEFAULT_OPTIONS, ...options };
    let lastError: Error = new Error("Unknown error");
    let delay = opts.initialDelay;
    let attempts = 0;

    for (let attempt = 1; attempt <= opts.maxRetries + 1; attempt++) {
        attempts = attempt;
        try {
            const data = await fn();
            return { success: true, data, attempts };
        } catch (error) {
            lastError = error instanceof Error ? error : new Error(String(error));

            if (attempt > opts.maxRetries) {
                break;
            }

            if (opts.shouldRetry && !opts.shouldRetry(lastError)) {
                break;
            }

            if (opts.onRetry) {
                opts.onRetry(lastError, attempt);
            }

            await sleep(delay);
            delay = Math.min(delay * opts.backoffFactor, opts.maxDelay);
        }
    }

    return { success: false, error: lastError, attempts };
}

// ============================================
// PRESETS DE RETRY
// ============================================

/**
 * Configuração para chamadas OpenAI
 * - 3 tentativas
 * - Backoff exponencial: 1s → 2s → 4s
 * - Não faz retry em erros de autenticação ou rate limit
 */
export const OPENAI_RETRY_OPTIONS: RetryOptions = {
    maxRetries: 3,
    initialDelay: 1000,
    backoffFactor: 2,
    maxDelay: 8000,
    shouldRetry: (error) => {
        const message = error.message.toLowerCase();
        // Não fazer retry em erros permanentes
        if (message.includes("invalid api key")) return false;
        if (message.includes("authentication")) return false;
        if (message.includes("rate limit") && message.includes("exceeded")) return false;
        if (message.includes("quota")) return false;
        return true;
    },
    onRetry: (error, attempt) => {
        logger.warn(`[OpenAI] Retry attempt ${attempt}`, { error: error.message });
    },
};

/**
 * Configuração para chamadas WPPConnect
 * - 2 tentativas (mais rápido)
 * - Backoff: 500ms → 1s
 */
export const WPPCONNECT_RETRY_OPTIONS: RetryOptions = {
    maxRetries: 2,
    initialDelay: 500,
    backoffFactor: 2,
    maxDelay: 2000,
    shouldRetry: (error) => {
        const message = error.message.toLowerCase();
        // Não fazer retry se sessão não existe
        if (message.includes("session not found")) return false;
        if (message.includes("not connected")) return false;
        return true;
    },
    onRetry: (error, attempt) => {
        logger.warn(`[WPPConnect] Retry attempt ${attempt}`, { error: error.message });
    },
};

/**
 * Configuração para webhooks
 * - 3 tentativas
 * - Backoff mais lento: 2s → 4s → 8s
 */
export const WEBHOOK_RETRY_OPTIONS: RetryOptions = {
    maxRetries: 3,
    initialDelay: 2000,
    backoffFactor: 2,
    maxDelay: 10000,
    onRetry: (error, attempt) => {
        logger.warn(`[Webhook] Retry attempt ${attempt}`, { error: error.message });
    },
};

// ============================================
// HELPERS
// ============================================

function sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Wrapper para usar retry com OpenAI
 * 
 * @example
 * const completion = await retryOpenAI(() => 
 *     openai.chat.completions.create({...})
 * );
 */
export async function retryOpenAI<T>(fn: () => Promise<T>): Promise<T> {
    return retry(fn, OPENAI_RETRY_OPTIONS);
}

/**
 * Wrapper para usar retry com WPPConnect
 */
export async function retryWPPConnect<T>(fn: () => Promise<T>): Promise<T> {
    return retry(fn, WPPCONNECT_RETRY_OPTIONS);
}
