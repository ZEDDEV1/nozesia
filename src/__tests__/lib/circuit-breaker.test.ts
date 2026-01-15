/**
 * Tests for lib/circuit-breaker.ts
 * 
 * Testa o Circuit Breaker Pattern que protege contra falhas em cascata.
 * 
 * PARA QUE SERVE:
 * - Evita sobrecarregar serviços que já estão com problemas
 * - Responde imediatamente em vez de esperar timeout
 * - Sistema se recupera automaticamente
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
    CircuitBreaker,
    CircuitBreakerError,
    type CircuitState,
} from '@/lib/circuit-breaker';

// Mock do logger para não poluir output dos testes
vi.mock('@/lib/logger', () => ({
    logger: {
        info: vi.fn(),
        error: vi.fn(),
        warn: vi.fn(),
        debug: vi.fn(),
    },
}));

// ============================================
// HELPER FUNCTIONS
// ============================================

const createCircuit = (options?: Partial<{
    failureThreshold: number;
    resetTimeout: number;
    successThreshold: number;
    onStateChange: (from: CircuitState, to: CircuitState) => void;
}>) => {
    return new CircuitBreaker({
        name: 'TestService',
        failureThreshold: options?.failureThreshold ?? 3,
        resetTimeout: options?.resetTimeout ?? 1000,
        successThreshold: options?.successThreshold ?? 2,
        onStateChange: options?.onStateChange,
    });
};

const successFn = async () => 'success';
const failFn = async () => { throw new Error('Service failed'); };

// ============================================
// ESTADO INICIAL
// ============================================

describe('CircuitBreaker - Estado Inicial', () => {
    it('should start in CLOSED state', () => {
        const circuit = createCircuit();
        const state = circuit.getState();

        expect(state.state).toBe('CLOSED');
        expect(state.failures).toBe(0);
        expect(state.successes).toBe(0);
    });

    it('should be available when CLOSED', () => {
        const circuit = createCircuit();
        expect(circuit.isAvailable()).toBe(true);
    });
});

// ============================================
// EXECUÇÃO COM SUCESSO
// ============================================

describe('CircuitBreaker - Execução com Sucesso', () => {
    it('should execute function and return result', async () => {
        const circuit = createCircuit();
        const result = await circuit.execute(successFn);

        expect(result).toBe('success');
    });

    it('should reset failure count on success', async () => {
        const circuit = createCircuit({ failureThreshold: 3 });

        // Causar 2 falhas (abaixo do threshold)
        await expect(circuit.execute(failFn)).rejects.toThrow();
        await expect(circuit.execute(failFn)).rejects.toThrow();
        expect(circuit.getState().failures).toBe(2);

        // Sucesso deve resetar contador
        await circuit.execute(successFn);
        expect(circuit.getState().failures).toBe(0);
    });

    it('should update lastSuccess timestamp on success', async () => {
        const circuit = createCircuit();
        const before = Date.now();

        await circuit.execute(successFn);

        const state = circuit.getState();
        expect(state.lastSuccess).toBeGreaterThanOrEqual(before);
    });
});

// ============================================
// TRANSIÇÃO PARA OPEN
// ============================================

describe('CircuitBreaker - Transição para OPEN', () => {
    it('should open after reaching failure threshold', async () => {
        const circuit = createCircuit({ failureThreshold: 3 });

        // Causar 3 falhas
        for (let i = 0; i < 3; i++) {
            await expect(circuit.execute(failFn)).rejects.toThrow();
        }

        expect(circuit.getState().state).toBe('OPEN');
    });

    it('should reject immediately when OPEN', async () => {
        const circuit = createCircuit({ failureThreshold: 1 });

        // Abrir o circuito
        await expect(circuit.execute(failFn)).rejects.toThrow();
        expect(circuit.getState().state).toBe('OPEN');

        // Próxima execução deve rejeitar com CircuitBreakerError
        await expect(circuit.execute(successFn)).rejects.toThrow(CircuitBreakerError);
    });

    it('should throw CircuitBreakerError with correct properties', async () => {
        const circuit = createCircuit({ failureThreshold: 1 });

        // Abrir o circuito
        await expect(circuit.execute(failFn)).rejects.toThrow();

        try {
            await circuit.execute(successFn);
            expect.fail('Should have thrown');
        } catch (error) {
            expect(error).toBeInstanceOf(CircuitBreakerError);
            const cbError = error as CircuitBreakerError;
            expect(cbError.serviceName).toBe('TestService');
            expect(cbError.circuitState).toBe('OPEN');
        }
    });

    it('should not be available when OPEN', async () => {
        const circuit = createCircuit({ failureThreshold: 1 });

        await expect(circuit.execute(failFn)).rejects.toThrow();
        expect(circuit.isAvailable()).toBe(false);
    });
});

// ============================================
// TRANSIÇÃO PARA HALF_OPEN
// ============================================

describe('CircuitBreaker - Transição para HALF_OPEN', () => {
    beforeEach(() => {
        vi.useFakeTimers();
    });

    it('should transition to HALF_OPEN after reset timeout', async () => {
        const circuit = createCircuit({
            failureThreshold: 1,
            resetTimeout: 1000,
        });

        // Abrir o circuito
        await expect(circuit.execute(failFn)).rejects.toThrow();
        expect(circuit.getState().state).toBe('OPEN');

        // Avançar tempo
        vi.advanceTimersByTime(1001);

        // Agora deve estar disponível (HALF_OPEN)
        expect(circuit.isAvailable()).toBe(true);
    });

    it('should allow test request in HALF_OPEN', async () => {
        const circuit = createCircuit({
            failureThreshold: 1,
            resetTimeout: 1000,
        });

        // Abrir o circuito
        await expect(circuit.execute(failFn)).rejects.toThrow();

        // Avançar tempo para HALF_OPEN
        vi.advanceTimersByTime(1001);

        // Deve permitir uma requisição de teste
        const result = await circuit.execute(successFn);
        expect(result).toBe('success');
    });
});

// ============================================
// RECUPERAÇÃO (HALF_OPEN → CLOSED)
// ============================================

describe('CircuitBreaker - Recuperação', () => {
    beforeEach(() => {
        vi.useFakeTimers();
    });

    it('should close after enough successes in HALF_OPEN', async () => {
        const circuit = createCircuit({
            failureThreshold: 1,
            resetTimeout: 1000,
            successThreshold: 2,
        });

        // Abrir o circuito
        await expect(circuit.execute(failFn)).rejects.toThrow();

        // Avançar tempo para HALF_OPEN
        vi.advanceTimersByTime(1001);

        // Primeiro sucesso
        await circuit.execute(successFn);
        // Ainda em HALF_OPEN (precisa de 2 sucessos)
        expect(circuit.getState().successes).toBe(1);

        // Segundo sucesso
        await circuit.execute(successFn);
        // Deve estar CLOSED agora
        expect(circuit.getState().state).toBe('CLOSED');
    });

    it('should reopen if failure in HALF_OPEN', async () => {
        const circuit = createCircuit({
            failureThreshold: 1,
            resetTimeout: 1000,
        });

        // Abrir o circuito
        await expect(circuit.execute(failFn)).rejects.toThrow();

        // Avançar tempo para HALF_OPEN
        vi.advanceTimersByTime(1001);

        // Falha em HALF_OPEN deve reabrir
        await expect(circuit.execute(failFn)).rejects.toThrow();
        expect(circuit.getState().state).toBe('OPEN');
    });
});

// ============================================
// CALLBACK DE MUDANÇA DE ESTADO
// ============================================

describe('CircuitBreaker - State Change Callback', () => {
    it('should call onStateChange when state changes', async () => {
        const onStateChange = vi.fn();
        const circuit = createCircuit({
            failureThreshold: 1,
            onStateChange,
        });

        // Abrir o circuito
        await expect(circuit.execute(failFn)).rejects.toThrow();

        expect(onStateChange).toHaveBeenCalledWith('CLOSED', 'OPEN');
    });

    it('should call onStateChange for all transitions', async () => {
        vi.useFakeTimers();
        const onStateChange = vi.fn();
        const circuit = createCircuit({
            failureThreshold: 1,
            resetTimeout: 1000,
            successThreshold: 1,
            onStateChange,
        });

        // CLOSED → OPEN
        await expect(circuit.execute(failFn)).rejects.toThrow();
        expect(onStateChange).toHaveBeenLastCalledWith('CLOSED', 'OPEN');

        // Avançar tempo para HALF_OPEN
        vi.advanceTimersByTime(1001);
        circuit.isAvailable(); // Trigger transition check

        // OPEN → HALF_OPEN (a transição acontece no canExecute)
        await circuit.execute(successFn);

        // HALF_OPEN → CLOSED
        expect(onStateChange).toHaveBeenLastCalledWith('HALF_OPEN', 'CLOSED');
    });
});

// ============================================
// RESET MANUAL
// ============================================

describe('CircuitBreaker - Reset Manual', () => {
    it('should reset to CLOSED state', async () => {
        const circuit = createCircuit({ failureThreshold: 1 });

        // Abrir o circuito
        await expect(circuit.execute(failFn)).rejects.toThrow();
        expect(circuit.getState().state).toBe('OPEN');

        // Reset manual
        circuit.reset();

        expect(circuit.getState().state).toBe('CLOSED');
        expect(circuit.getState().failures).toBe(0);
        expect(circuit.getState().successes).toBe(0);
    });

    it('should allow requests after reset', async () => {
        const circuit = createCircuit({ failureThreshold: 1 });

        // Abrir o circuito
        await expect(circuit.execute(failFn)).rejects.toThrow();

        // Reset manual
        circuit.reset();

        // Deve permitir requisições
        const result = await circuit.execute(successFn);
        expect(result).toBe('success');
    });
});

// ============================================
// CIRCUITBREAKERERROR
// ============================================

describe('CircuitBreakerError', () => {
    it('should have correct name', () => {
        const error = new CircuitBreakerError('Test error', 'TestService', 'OPEN');
        expect(error.name).toBe('CircuitBreakerError');
    });

    it('should have correct properties', () => {
        const error = new CircuitBreakerError('Test error', 'TestService', 'OPEN');
        expect(error.serviceName).toBe('TestService');
        expect(error.circuitState).toBe('OPEN');
        expect(error.message).toBe('Test error');
    });

    it('should be instance of Error', () => {
        const error = new CircuitBreakerError('Test', 'Test', 'OPEN');
        expect(error).toBeInstanceOf(Error);
    });
});

// ============================================
// CONFIGURAÇÕES CUSTOMIZADAS
// ============================================

describe('CircuitBreaker - Configurações Customizadas', () => {
    it('should respect custom failureThreshold', async () => {
        const circuit = createCircuit({ failureThreshold: 5 });

        // 4 falhas não devem abrir
        for (let i = 0; i < 4; i++) {
            await expect(circuit.execute(failFn)).rejects.toThrow();
        }
        expect(circuit.getState().state).toBe('CLOSED');

        // 5ª falha deve abrir
        await expect(circuit.execute(failFn)).rejects.toThrow();
        expect(circuit.getState().state).toBe('OPEN');
    });

    it('should respect custom successThreshold', async () => {
        vi.useFakeTimers();
        const circuit = createCircuit({
            failureThreshold: 1,
            resetTimeout: 1000,
            successThreshold: 3,
        });

        // Abrir o circuito
        await expect(circuit.execute(failFn)).rejects.toThrow();

        // Ir para HALF_OPEN
        vi.advanceTimersByTime(1001);

        // 2 sucessos não devem fechar
        await circuit.execute(successFn);
        await circuit.execute(successFn);
        expect(circuit.getState().state).not.toBe('CLOSED');

        // 3º sucesso deve fechar
        await circuit.execute(successFn);
        expect(circuit.getState().state).toBe('CLOSED');
    });
});
