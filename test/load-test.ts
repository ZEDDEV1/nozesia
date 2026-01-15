/**
 * Load Test - Simula 100 clientes simultâneos no webhook WhatsApp
 * 
 * Uso:
 *   npx tsx test/load-test.ts
 * 
 * Requisitos:
 *   - Servidor rodando em localhost:3000
 *   - WPPConnect server NÃO é necessário (testamos apenas a API)
 */

const BASE_URL = process.env.TEST_URL || "http://localhost:3000";
const WEBHOOK_URL = `${BASE_URL}/api/whatsapp/webhook`;

// Configuração do teste
const CONFIG = {
    TOTAL_CLIENTS: 100,           // Total de clientes simulados
    CONCURRENT_BATCH: 20,         // Enviar em lotes de 20 (mais realista)
    MESSAGES_PER_CLIENT: 3,       // Cada cliente envia 3 mensagens
    DELAY_BETWEEN_BATCHES: 500,   // ms entre lotes
    TIMEOUT_PER_REQUEST: 30000,   // 30s timeout
};

// Company e session para teste (deve existir no banco)
const TEST_COMPANY_ID = "test_company_load";
const TEST_SESSION = `${TEST_COMPANY_ID}_session1`;

// Mensagens de teste variadas
const TEST_MESSAGES = [
    "Oi, tudo bem?",
    "Quais produtos vocês têm?",
    "Quanto custa?",
    "Vocês fazem entrega?",
    "Qual o horário de funcionamento?",
    "Quero fazer um pedido",
    "Manda o cardápio",
    "Tem desconto?",
    "Aceita PIX?",
    "Qual o prazo de entrega?",
];

interface TestResult {
    clientId: number;
    messageIndex: number;
    status: number;
    duration: number;
    success: boolean;
    error?: string;
}

interface LoadTestReport {
    totalRequests: number;
    successfulRequests: number;
    failedRequests: number;
    avgResponseTime: number;
    minResponseTime: number;
    maxResponseTime: number;
    p50ResponseTime: number;
    p95ResponseTime: number;
    p99ResponseTime: number;
    requestsPerSecond: number;
    totalDuration: number;
    errors: Record<string, number>;
}

// Gera payload de webhook simulado
function generateWebhookPayload(clientId: number, message: string): object {
    const phone = `5511999${String(clientId).padStart(6, "0")}`;

    return {
        event: "onmessage",
        session: TEST_SESSION,
        data: {
            from: `${phone}@c.us`,
            body: message,
            type: "chat",
            isGroupMsg: false,
            sender: {
                id: `${phone}@c.us`,
                pushname: `Cliente ${clientId}`,
            },
            notifyName: `Cliente ${clientId}`,
        },
    };
}

// Envia uma requisição de teste
async function sendTestRequest(
    clientId: number,
    messageIndex: number,
    message: string
): Promise<TestResult> {
    const startTime = Date.now();
    const payload = generateWebhookPayload(clientId, message);

    try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), CONFIG.TIMEOUT_PER_REQUEST);

        const response = await fetch(WEBHOOK_URL, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify(payload),
            signal: controller.signal,
        });

        clearTimeout(timeout);

        const duration = Date.now() - startTime;

        return {
            clientId,
            messageIndex,
            status: response.status,
            duration,
            success: response.status === 200,
        };
    } catch (error) {
        const duration = Date.now() - startTime;
        const errorMessage = error instanceof Error ? error.message : "Unknown error";

        return {
            clientId,
            messageIndex,
            status: 0,
            duration,
            success: false,
            error: errorMessage,
        };
    }
}

// Calcula percentil
function percentile(arr: number[], p: number): number {
    const sorted = arr.slice().sort((a, b) => a - b);
    const index = Math.ceil((p / 100) * sorted.length) - 1;
    return sorted[Math.max(0, index)];
}

// Gera relatório do teste
function generateReport(results: TestResult[], totalDuration: number): LoadTestReport {
    const durations = results.map(r => r.duration);
    const successCount = results.filter(r => r.success).length;
    const errors: Record<string, number> = {};

    results
        .filter(r => r.error)
        .forEach(r => {
            const key = r.error || "Unknown";
            errors[key] = (errors[key] || 0) + 1;
        });

    return {
        totalRequests: results.length,
        successfulRequests: successCount,
        failedRequests: results.length - successCount,
        avgResponseTime: Math.round(durations.reduce((a, b) => a + b, 0) / durations.length),
        minResponseTime: Math.min(...durations),
        maxResponseTime: Math.max(...durations),
        p50ResponseTime: percentile(durations, 50),
        p95ResponseTime: percentile(durations, 95),
        p99ResponseTime: percentile(durations, 99),
        requestsPerSecond: Math.round((results.length / (totalDuration / 1000)) * 100) / 100,
        totalDuration,
        errors,
    };
}

// Delay helper
function delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// Executa o teste de carga
async function runLoadTest(): Promise<void> {
    console.log("╔══════════════════════════════════════════════════════════════╗");
    console.log("║           LOAD TEST - 100 CLIENTES SIMULTÂNEOS               ║");
    console.log("╠══════════════════════════════════════════════════════════════╣");
    console.log(`║ URL: ${WEBHOOK_URL.padEnd(54)}║`);
    console.log(`║ Clientes: ${String(CONFIG.TOTAL_CLIENTS).padEnd(50)}║`);
    console.log(`║ Mensagens por cliente: ${String(CONFIG.MESSAGES_PER_CLIENT).padEnd(37)}║`);
    console.log(`║ Lote concorrente: ${String(CONFIG.CONCURRENT_BATCH).padEnd(42)}║`);
    console.log("╚══════════════════════════════════════════════════════════════╝");
    console.log("");

    const allResults: TestResult[] = [];
    const startTime = Date.now();

    // Divide clientes em lotes
    const totalMessages = CONFIG.TOTAL_CLIENTS * CONFIG.MESSAGES_PER_CLIENT;
    let completedRequests = 0;

    for (let batchStart = 0; batchStart < CONFIG.TOTAL_CLIENTS; batchStart += CONFIG.CONCURRENT_BATCH) {
        const batchEnd = Math.min(batchStart + CONFIG.CONCURRENT_BATCH, CONFIG.TOTAL_CLIENTS);
        const batchPromises: Promise<TestResult>[] = [];

        // Para cada cliente no lote
        for (let clientId = batchStart; clientId < batchEnd; clientId++) {
            // Cada cliente envia múltiplas mensagens
            for (let msgIndex = 0; msgIndex < CONFIG.MESSAGES_PER_CLIENT; msgIndex++) {
                const message = TEST_MESSAGES[Math.floor(Math.random() * TEST_MESSAGES.length)];
                batchPromises.push(sendTestRequest(clientId, msgIndex, message));
            }
        }

        // Executa lote em paralelo
        const batchResults = await Promise.all(batchPromises);
        allResults.push(...batchResults);

        completedRequests += batchResults.length;
        const progress = Math.round((completedRequests / totalMessages) * 100);
        const successInBatch = batchResults.filter(r => r.success).length;
        const avgTimeInBatch = Math.round(
            batchResults.reduce((a, b) => a + b.duration, 0) / batchResults.length
        );

        console.log(
            `[${progress.toString().padStart(3)}%] Lote ${Math.floor(batchStart / CONFIG.CONCURRENT_BATCH) + 1}: ` +
            `${successInBatch}/${batchResults.length} OK | Avg: ${avgTimeInBatch}ms`
        );

        // Delay entre lotes para não sobrecarregar
        if (batchStart + CONFIG.CONCURRENT_BATCH < CONFIG.TOTAL_CLIENTS) {
            await delay(CONFIG.DELAY_BETWEEN_BATCHES);
        }
    }

    const totalDuration = Date.now() - startTime;
    const report = generateReport(allResults, totalDuration);

    console.log("");
    console.log("╔══════════════════════════════════════════════════════════════╗");
    console.log("║                     RESULTADOS DO TESTE                      ║");
    console.log("╠══════════════════════════════════════════════════════════════╣");
    console.log(`║ Total de Requisições:      ${String(report.totalRequests).padStart(6)}                          ║`);
    console.log(`║ Requisições com Sucesso:   ${String(report.successfulRequests).padStart(6)} (${String(Math.round(report.successfulRequests / report.totalRequests * 100)).padStart(3)}%)                     ║`);
    console.log(`║ Requisições com Falha:     ${String(report.failedRequests).padStart(6)} (${String(Math.round(report.failedRequests / report.totalRequests * 100)).padStart(3)}%)                     ║`);
    console.log("╠══════════════════════════════════════════════════════════════╣");
    console.log(`║ Tempo Total:               ${String(report.totalDuration).padStart(6)} ms                       ║`);
    console.log(`║ Requisições/segundo:       ${String(report.requestsPerSecond).padStart(6)}                          ║`);
    console.log("╠══════════════════════════════════════════════════════════════╣");
    console.log(`║ Tempo de Resposta (min):   ${String(report.minResponseTime).padStart(6)} ms                       ║`);
    console.log(`║ Tempo de Resposta (avg):   ${String(report.avgResponseTime).padStart(6)} ms                       ║`);
    console.log(`║ Tempo de Resposta (p50):   ${String(report.p50ResponseTime).padStart(6)} ms                       ║`);
    console.log(`║ Tempo de Resposta (p95):   ${String(report.p95ResponseTime).padStart(6)} ms                       ║`);
    console.log(`║ Tempo de Resposta (p99):   ${String(report.p99ResponseTime).padStart(6)} ms                       ║`);
    console.log(`║ Tempo de Resposta (max):   ${String(report.maxResponseTime).padStart(6)} ms                       ║`);
    console.log("╚══════════════════════════════════════════════════════════════╝");

    // Análise de capacidade
    console.log("");
    console.log("╔══════════════════════════════════════════════════════════════╗");
    console.log("║                  ANÁLISE DE CAPACIDADE                       ║");
    console.log("╠══════════════════════════════════════════════════════════════╣");

    const successRate = report.successfulRequests / report.totalRequests;
    const avgTime = report.avgResponseTime;
    const p95Time = report.p95ResponseTime;

    if (successRate >= 0.99 && p95Time < 1000) {
        console.log("║ ✅ EXCELENTE - Sistema suporta 100 clientes com folga!       ║");
        console.log("║    Pode escalar para 200-500 clientes sem problemas.        ║");
    } else if (successRate >= 0.95 && p95Time < 3000) {
        console.log("║ ✅ BOM - Sistema suporta 100 clientes adequadamente.         ║");
        console.log("║    Monitore p95 em produção, considere otimizações.         ║");
    } else if (successRate >= 0.90 && p95Time < 5000) {
        console.log("║ ⚠️ ACEITÁVEL - Sistema aguenta, mas está no limite.          ║");
        console.log("║    Recomendado: mais workers, cache agressivo, Redis.       ║");
    } else {
        console.log("║ ❌ ATENÇÃO - Sistema precisa de otimizações.                 ║");
        console.log("║    Investigue gargalos, considere scaling horizontal.       ║");
    }

    console.log("╚══════════════════════════════════════════════════════════════╝");

    // Erros detalhados
    if (Object.keys(report.errors).length > 0) {
        console.log("");
        console.log("Erros encontrados:");
        Object.entries(report.errors).forEach(([error, count]) => {
            console.log(`  - ${error}: ${count}x`);
        });
    }

    console.log("");
    console.log("═══════════════════════════════════════════════════════════════");
    console.log("RECOMENDAÇÕES PARA 100+ CLIENTES:");
    console.log("═══════════════════════════════════════════════════════════════");
    console.log("1. Usar BullMQ workers em paralelo (3-5 workers)");
    console.log("2. Redis para cache e rate limiting");
    console.log("3. Connection pooling no Prisma (já configurado)");
    console.log("4. Escalar horizontalmente com PM2 ou Kubernetes");
    console.log("5. CDN para assets estáticos");
    console.log("═══════════════════════════════════════════════════════════════");
}

// Executa
runLoadTest().catch(console.error);
