/**
 * BullMQ Queue Configuration
 * 
 * Gerencia filas de processamento de mensagens para evitar timeout no webhook.
 * 
 * Fluxo:
 * 1. Webhook recebe mensagem do WhatsApp
 * 2. Adiciona na fila (retorna 200 imediatamente)
 * 3. Worker processa em background (sem timeout)
 * 4. IA responde, mensagem é salva e enviada
 */

import { Queue, Job } from "bullmq";
import IORedis from "ioredis";
import { logger } from "./logger";

// Configuração Redis - suporta Upstash ou Redis local
const getRedisConfig = () => {
    // Se Upstash estiver configurado, usar
    if (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) {
        // Upstash via REST não funciona com BullMQ diretamente
        // Precisamos de Redis tradicional via ioredis
        logger.warn("BullMQ requires traditional Redis connection, not REST API");
    }

    // Redis local ou externo (recomendado para VPS)
    const redisUrl = process.env.REDIS_URL || "redis://localhost:6379";

    return new IORedis(redisUrl, {
        maxRetriesPerRequest: null, // BullMQ requirement
        enableReadyCheck: false,
    });
};

// Tipos de jobs
export interface WhatsAppMessageJob {
    type: "whatsapp_message";
    sessionId: string;
    messageData: {
        from: string;
        body: string;
        type: string;
        mediaUrl?: string;
        caption?: string;
        timestamp: number;
    };
    session: string;
}

export interface AIResponseJob {
    type: "ai_response";
    conversationId: string;
    companyId: string;
    agentId: string;
    message: string;
    replyTo: string; // WhatsApp phone
    sessionName: string;
}

export interface CampaignJob {
    type: "campaign_dispatch";
    campaignId: string;
    companyId: string;
    sessionName: string;
}

export type MessageQueueJob = WhatsAppMessageJob | AIResponseJob | CampaignJob;

// Singleton para conexão Redis
let redisConnection: IORedis | null = null;

const getConnection = (): IORedis => {
    if (!redisConnection) {
        redisConnection = getRedisConfig();

        redisConnection.on("error", (err) => {
            logger.error("Redis connection error", { error: err.message });
        });

        redisConnection.on("connect", () => {
            logger.info("Redis connected for BullMQ");
        });
    }
    return redisConnection;
};

// Queue para mensagens do WhatsApp
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let messageQueue: Queue<MessageQueueJob> | null = null;

export const getMessageQueue = (): Queue<MessageQueueJob> => {
    if (!messageQueue) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        messageQueue = new Queue<MessageQueueJob>("whatsapp-messages", {
            connection: getConnection() as any,
            defaultJobOptions: {
                attempts: 3,
                backoff: {
                    type: "exponential",
                    delay: 2000,
                },
                removeOnComplete: {
                    count: 100, // Manter últimos 100 jobs completados
                    age: 3600, // Ou jobs com menos de 1 hora
                },
                removeOnFail: {
                    count: 50, // Manter últimos 50 jobs falhados
                    age: 86400, // Ou jobs com menos de 24 horas
                },
            },
        }) as Queue<MessageQueueJob>;

        logger.info("Message queue initialized");
    }
    return messageQueue;
};

/**
 * Adiciona mensagem na fila para processamento
 */
export async function enqueueMessage(job: MessageQueueJob): Promise<Job<MessageQueueJob>> {
    const queue = getMessageQueue();

    const addedJob = await queue.add(job.type, job, {
        priority: job.type === "whatsapp_message" ? 1 : 2, // WhatsApp tem prioridade
    });

    logger.debug("Job enqueued", { jobId: addedJob.id, type: job.type });
    return addedJob;
}

/**
 * Adiciona job de campanha na fila para processamento em background
 */
export async function addCampaignJob(data: Omit<CampaignJob, "type">): Promise<Job<MessageQueueJob>> {
    const queue = getMessageQueue();

    const job: CampaignJob = {
        type: "campaign_dispatch",
        ...data,
    };

    const addedJob = await queue.add(job.type, job, {
        priority: 3, // Prioridade mais baixa que mensagens normais
        attempts: 1, // Não tentar de novo (campanha controla isso internamente)
    });

    logger.info("Campaign job enqueued", { jobId: addedJob.id, campaignId: data.campaignId });
    return addedJob;
}

/**
 * Retorna estatísticas da fila
 */
export async function getQueueStats() {
    const queue = getMessageQueue();

    const [waiting, active, completed, failed, delayed] = await Promise.all([
        queue.getWaitingCount(),
        queue.getActiveCount(),
        queue.getCompletedCount(),
        queue.getFailedCount(),
        queue.getDelayedCount(),
    ]);

    return {
        waiting,
        active,
        completed,
        failed,
        delayed,
        total: waiting + active + delayed,
    };
}

/**
 * Limpa jobs antigos da fila
 */
export async function cleanOldJobs() {
    const queue = getMessageQueue();
    await queue.clean(3600 * 1000, 100, "completed"); // Limpar completados > 1h
    await queue.clean(86400 * 1000, 50, "failed"); // Limpar falhados > 24h
}

/**
 * Verifica se Redis está conectado
 */
export async function isQueueConnected(): Promise<boolean> {
    try {
        const conn = getConnection();
        const pong = await conn.ping();
        return pong === "PONG";
    } catch {
        return false;
    }
}

/**
 * Fecha conexões (para shutdown graceful)
 */
export async function closeQueue() {
    if (messageQueue) {
        await messageQueue.close();
        messageQueue = null;
    }
    if (redisConnection) {
        await redisConnection.quit();
        redisConnection = null;
    }
    logger.info("Queue connections closed");
}
