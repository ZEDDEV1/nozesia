/**
 * Sistema de Filas de Mensagens
 * 
 * Usa uma fila em memória para desenvolvimento.
 * Em produção, usar BullMQ + Redis para robustez.
 * 
 * PARA QUE SERVE:
 * - Processar mensagens de forma assíncrona (não bloqueia)
 * - Se falhar, tenta novamente automaticamente
 * - Evita perda de mensagens em caso de erro
 * - Suporta picos de tráfego sem derrubar o servidor
 */

import { logger } from "./logger";

// ============================================
// TIPOS
// ============================================

export type JobType =
    | "PROCESS_MESSAGE"      // Processa mensagem recebida
    | "SEND_AI_RESPONSE"     // Envia resposta da IA
    | "SYNC_WHATSAPP"        // Sincroniza status do WhatsApp
    | "SEND_NOTIFICATION";   // Envia notificação

export interface Job<T = unknown> {
    id: string;
    type: JobType;
    data: T;
    attempts: number;
    maxAttempts: number;
    createdAt: Date;
    processedAt?: Date;
    error?: string;
    status: "pending" | "processing" | "completed" | "failed";
}

export interface ProcessMessageData {
    conversationId: string;
    companyId: string;
    messageContent: string;
    messageType: string;
    senderPhone: string;
    sessionName: string;
}

export interface SendAIResponseData {
    conversationId: string;
    companyId: string;
    agentId: string;
    customerMessage: string;
    sessionName: string;
    customerPhone: string;
}

// ============================================
// FILA EM MEMÓRIA (desenvolvimento)
// ============================================

const jobQueue: Job[] = [];
const completedJobs: Job[] = [];
let isProcessing = false;
const MAX_COMPLETED_HISTORY = 100;

// Handlers de jobs registrados
type JobHandler<T = unknown> = (data: T) => Promise<void>;
const jobHandlers = new Map<JobType, JobHandler>();

/**
 * Gera ID único para job
 */
function generateJobId(): string {
    return `job_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * Adiciona um job à fila
 */
export function addJob<T>(type: JobType, data: T, options?: { maxAttempts?: number }): Job<T> {
    const job: Job<T> = {
        id: generateJobId(),
        type,
        data,
        attempts: 0,
        maxAttempts: options?.maxAttempts ?? 3,
        createdAt: new Date(),
        status: "pending",
    };

    jobQueue.push(job as Job);
    logger.info(`Job added to queue`, { jobId: job.id, type, queueSize: jobQueue.length });

    // Iniciar processamento se não estiver rodando
    if (!isProcessing) {
        processQueue();
    }

    return job;
}

/**
 * Processa a fila de jobs
 */
async function processQueue(): Promise<void> {
    if (isProcessing) return;
    isProcessing = true;

    while (jobQueue.length > 0) {
        const job = jobQueue[0];
        if (!job) break;

        job.status = "processing";
        job.attempts++;

        const handler = jobHandlers.get(job.type);

        if (!handler) {
            logger.error(`No handler registered for job type`, { type: job.type });
            job.status = "failed";
            job.error = `No handler for type: ${job.type}`;
            moveToCompleted(job);
            continue;
        }

        try {
            logger.debug(`Processing job`, {
                jobId: job.id,
                type: job.type,
                attempt: job.attempts
            });

            await handler(job.data);

            job.status = "completed";
            job.processedAt = new Date();
            moveToCompleted(job);

            logger.info(`Job completed`, {
                jobId: job.id,
                type: job.type,
                duration: job.processedAt.getTime() - job.createdAt.getTime()
            });

        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            logger.error(`Job failed`, {
                jobId: job.id,
                type: job.type,
                attempt: job.attempts,
                error: errorMessage
            });

            if (job.attempts >= job.maxAttempts) {
                job.status = "failed";
                job.error = errorMessage;
                moveToCompleted(job);
            } else {
                // Requeue para retry
                job.status = "pending";
                jobQueue.push(jobQueue.shift()!);

                // Delay exponencial entre retries
                await new Promise(resolve =>
                    setTimeout(resolve, Math.pow(2, job.attempts) * 1000)
                );
            }
        }
    }

    isProcessing = false;
}

/**
 * Move job para lista de completados
 */
function moveToCompleted(job: Job): void {
    const index = jobQueue.indexOf(job);
    if (index > -1) {
        jobQueue.splice(index, 1);
    }

    completedJobs.unshift(job);

    // Manter apenas últimos N jobs
    if (completedJobs.length > MAX_COMPLETED_HISTORY) {
        completedJobs.pop();
    }
}

/**
 * Registra um handler para um tipo de job
 */
export function registerJobHandler<T>(type: JobType, handler: JobHandler<T>): void {
    jobHandlers.set(type, handler as JobHandler);
    logger.info(`Job handler registered`, { type });
}

/**
 * Retorna estatísticas da fila
 */
export function getQueueStats(): {
    pending: number;
    processing: number;
    completed: number;
    failed: number;
    recentJobs: Job[];
} {
    const pending = jobQueue.filter(j => j.status === "pending").length;
    const processing = jobQueue.filter(j => j.status === "processing").length;
    const completed = completedJobs.filter(j => j.status === "completed").length;
    const failed = completedJobs.filter(j => j.status === "failed").length;

    return {
        pending,
        processing,
        completed,
        failed,
        recentJobs: completedJobs.slice(0, 10),
    };
}

/**
 * Limpa jobs completados
 */
export function clearCompletedJobs(): void {
    completedJobs.length = 0;
    logger.info("Completed jobs cleared");
}

// ============================================
// HELPERS PARA USO COMUM
// ============================================

/**
 * Adiciona job de processamento de mensagem
 */
export function queueMessageProcessing(data: ProcessMessageData): Job {
    return addJob("PROCESS_MESSAGE", data);
}

/**
 * Adiciona job de envio de resposta IA
 */
export function queueAIResponse(data: SendAIResponseData): Job {
    return addJob("SEND_AI_RESPONSE", data, { maxAttempts: 5 });
}

// ============================================
// INICIALIZAÇÃO
// ============================================

/**
 * Inicializa handlers padrão (chamar no startup do app)
 */
export function initializeDefaultHandlers(): void {
    // Handler de exemplo - implementar lógica real
    registerJobHandler<ProcessMessageData>("PROCESS_MESSAGE", async (data) => {
        logger.debug("Processing message job", { conversationId: data.conversationId });
        // A lógica real será implementada pelo webhook
    });

    registerJobHandler<SendAIResponseData>("SEND_AI_RESPONSE", async (data) => {
        logger.debug("AI response job", { conversationId: data.conversationId });
        // A lógica real será implementada pelo webhook
    });

    logger.info("Default job handlers initialized");
}
