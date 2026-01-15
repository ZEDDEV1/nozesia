/**
 * Health Check Endpoint - VERSÃO COMPLETA
 * 
 * Endpoint para verificar o status da aplicação.
 * Usado por load balancers, Kubernetes, e monitoramento.
 * 
 * GET /api/health - Retorna status da aplicação e TODAS as dependências:
 * - Database (PostgreSQL)
 * - Redis (Upstash)
 * - WPPConnect (WhatsApp)
 * - OpenAI (IA)
 * - Circuit Breakers (status de resiliência)
 */

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isRedisAvailable, testRedisConnection } from "@/lib/redis";
import { getCircuitBreakerStatus } from "@/lib/circuit-breaker";

interface HealthStatus {
    status: "healthy" | "degraded" | "unhealthy";
    timestamp: string;
    version: string;
    uptime: number;
    environment: string;
    checks: {
        database: CheckResult;
        redis: CheckResult;
        wppconnect: CheckResult;
        openai: CheckResult;
    };
    circuitBreakers: {
        wppconnect: CircuitStatus;
        openai: CircuitStatus;
    };
    metrics: {
        totalCompanies?: number;
        activeConversations?: number;
        messagesLast24h?: number;
    };
}

interface CheckResult {
    status: "up" | "down" | "not_configured" | "unknown";
    latency?: number;
    error?: string;
    details?: Record<string, unknown>;
}

interface CircuitStatus {
    state: string;
    failures: number;
    isAvailable: boolean;
}

// Track server start time
const startTime = Date.now();

/**
 * Check database connection
 */
async function checkDatabase(): Promise<CheckResult> {
    const start = Date.now();
    try {
        await prisma.$queryRaw`SELECT 1`;
        return {
            status: "up",
            latency: Date.now() - start,
        };
    } catch (error) {
        return {
            status: "down",
            latency: Date.now() - start,
            error: error instanceof Error ? error.message : "Unknown error",
        };
    }
}

/**
 * Check Redis connection
 */
async function checkRedis(): Promise<CheckResult> {
    if (!isRedisAvailable()) {
        return { status: "not_configured" };
    }

    const start = Date.now();
    try {
        const connected = await testRedisConnection();
        return {
            status: connected ? "up" : "down",
            latency: Date.now() - start,
        };
    } catch (error) {
        return {
            status: "down",
            latency: Date.now() - start,
            error: error instanceof Error ? error.message : "Unknown error",
        };
    }
}

/**
 * Check WPPConnect server
 */
async function checkWPPConnect(): Promise<CheckResult> {
    const wppUrl = process.env.WPPCONNECT_URL;

    if (!wppUrl) {
        return { status: "not_configured" };
    }

    const start = Date.now();
    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000);

        const response = await fetch(`${wppUrl}/api/status`, {
            method: "GET",
            signal: controller.signal,
        });

        clearTimeout(timeoutId);

        const latency = Date.now() - start;

        if (response.ok) {
            return {
                status: "up",
                latency,
            };
        }

        return {
            status: "down",
            latency,
            error: `HTTP ${response.status}`,
        };
    } catch (error) {
        return {
            status: "down",
            latency: Date.now() - start,
            error: error instanceof Error ? error.message : "Connection failed",
        };
    }
}

/**
 * Check OpenAI API (minimal check)
 */
async function checkOpenAI(): Promise<CheckResult> {
    const apiKey = process.env.OPENAI_API_KEY;

    if (!apiKey) {
        return { status: "not_configured" };
    }

    const start = Date.now();
    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000);

        // Minimal check - just verify API key is valid
        const response = await fetch("https://api.openai.com/v1/models", {
            method: "GET",
            headers: {
                "Authorization": `Bearer ${apiKey}`,
            },
            signal: controller.signal,
        });

        clearTimeout(timeoutId);

        const latency = Date.now() - start;

        if (response.ok) {
            return {
                status: "up",
                latency,
            };
        }

        if (response.status === 401) {
            return {
                status: "down",
                latency,
                error: "Invalid API key",
            };
        }

        return {
            status: "up",  // Rate limit means it's working
            latency,
            details: { note: "Rate limited but functional" },
        };
    } catch (error) {
        return {
            status: "down",
            latency: Date.now() - start,
            error: error instanceof Error ? error.message : "Connection failed",
        };
    }
}

/**
 * Get basic metrics
 */
async function getMetrics(): Promise<HealthStatus["metrics"]> {
    try {
        const [companiesCount, activeConversations, recentMessages] = await Promise.all([
            prisma.company.count(),
            prisma.conversation.count({
                where: {
                    status: { in: ["OPEN", "AI_HANDLING", "HUMAN_HANDLING"] },
                },
            }),
            prisma.message.count({
                where: {
                    createdAt: {
                        gte: new Date(Date.now() - 24 * 60 * 60 * 1000),
                    },
                },
            }),
        ]);

        return {
            totalCompanies: companiesCount,
            activeConversations,
            messagesLast24h: recentMessages,
        };
    } catch {
        return {};
    }
}

/**
 * GET /api/health
 */
export async function GET() {
    // Execute all checks in parallel
    const [dbCheck, redisCheck, wppCheck, openaiCheck, metrics] = await Promise.all([
        checkDatabase(),
        checkRedis(),
        checkWPPConnect(),
        checkOpenAI(),
        getMetrics(),
    ]);

    // Get circuit breaker status
    const circuitStatus = getCircuitBreakerStatus();

    // Determine overall status
    let status: HealthStatus["status"] = "healthy";

    // Database is critical
    if (dbCheck.status === "down") {
        status = "unhealthy";
    }
    // OpenAI and WPPConnect being down is degraded
    else if (openaiCheck.status === "down" || wppCheck.status === "down") {
        status = "degraded";
    }
    // Redis being down is also degraded
    else if (redisCheck.status === "down") {
        status = "degraded";
    }
    // Circuit breakers being open is degraded
    else if (
        circuitStatus.wppconnect.state === "OPEN" ||
        circuitStatus.openai.state === "OPEN"
    ) {
        status = "degraded";
    }

    const health: HealthStatus = {
        status,
        timestamp: new Date().toISOString(),
        version: process.env.npm_package_version || "1.0.0",
        uptime: Math.floor((Date.now() - startTime) / 1000),
        environment: process.env.NODE_ENV || "development",
        checks: {
            database: dbCheck,
            redis: redisCheck,
            wppconnect: wppCheck,
            openai: openaiCheck,
        },
        circuitBreakers: {
            wppconnect: {
                state: circuitStatus.wppconnect.state,
                failures: circuitStatus.wppconnect.failures,
                isAvailable: circuitStatus.wppconnect.state !== "OPEN",
            },
            openai: {
                state: circuitStatus.openai.state,
                failures: circuitStatus.openai.failures,
                isAvailable: circuitStatus.openai.state !== "OPEN",
            },
        },
        metrics,
    };

    // Return appropriate status code
    const statusCode = status === "unhealthy" ? 503 : 200;

    return NextResponse.json(health, { status: statusCode });
}

