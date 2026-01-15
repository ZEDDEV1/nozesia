/**
 * BullMQ Message Worker
 * 
 * Worker que processa mensagens do WhatsApp em background.
 * 
 * Executa em processo separado da aplicação Next.js:
 * npm run worker
 * 
 * Ou com PM2 em produção:
 * pm2 start npm --name "worker" -- run worker
 */

import { Worker, Job } from "bullmq";
import IORedis from "ioredis";
import { prisma } from "./prisma";
import { wppConnect } from "./wppconnect";
import { generateAIResponseWithFunctions } from "./openai";
import { publishNewMessage } from "./socket-bridge";
import { logger } from "./logger";
import type { MessageQueueJob, WhatsAppMessageJob } from "./queue-bullmq";
import { getCustomerMemory, formatMemoryForPrompt, updateCustomerMemory, generateConversationSummary } from "./customer-memory";
import { getRelevantContext, hasEmbeddedTrainingData } from "./rag";
import { dispatchWebhook } from "./webhooks";
import { selectBestAgent } from "./agent-router";

// Configuração Redis
const getRedisConnection = () => {
    const redisUrl = process.env.REDIS_URL || "redis://localhost:6379";

    return new IORedis(redisUrl, {
        maxRetriesPerRequest: null,
        enableReadyCheck: false,
    });
};

// Mapeia tipos de mensagem
const VALID_MESSAGE_TYPES = ["TEXT", "IMAGE", "AUDIO", "VIDEO", "DOCUMENT", "STICKER", "LOCATION"];

/**
 * Processa mensagem do WhatsApp
 */
async function processWhatsAppMessage(job: Job<WhatsAppMessageJob>): Promise<void> {
    const { sessionId, messageData, session } = job.data;
    const { from, body, type } = messageData;

    logger.info("Processing WhatsApp message", {
        jobId: job.id,
        from,
        type,
        sessionId
    });

    try {
        // Buscar sessão do banco
        const dbSession = await prisma.whatsAppSession.findFirst({
            where: {
                OR: [
                    { sessionName: session },
                    { sessionName: sessionId }
                ]
            },
            include: { company: true },
        });

        if (!dbSession) {
            throw new Error(`Session not found: ${session}`);
        }

        const companyId = dbSession.companyId;
        const customerPhone = from.replace("@c.us", "").replace("@s.whatsapp.net", "");

        // Buscar ou criar conversa
        let conversation = await prisma.conversation.findFirst({
            where: { companyId, customerPhone },
            include: { agent: true },
        });

        // Se não existe, criar nova conversa
        if (!conversation) {
            // Multi-agent routing
            const { agent: selectedAgent, reason } = await selectBestAgent(companyId, body);

            conversation = await prisma.conversation.create({
                data: {
                    companyId,
                    sessionId: dbSession.id,
                    agentId: selectedAgent?.id || null,
                    customerPhone,
                    customerName: "Cliente",
                    status: selectedAgent ? "AI_HANDLING" : "OPEN",
                },
                include: { agent: true },
            });

            logger.info("Created new conversation", {
                conversationId: conversation.id,
                agentId: selectedAgent?.id,
                routingReason: reason
            });

            // Dispatch NEW_CONVERSATION webhook (async, non-blocking)
            dispatchWebhook(companyId, "NEW_CONVERSATION", {
                conversationId: conversation.id,
                customerPhone,
                timestamp: new Date().toISOString(),
            }).catch((err) => logger.error("Webhook dispatch failed", { error: err }));
        }

        // Determinar tipo de mensagem
        const upperType = type?.toUpperCase() || "TEXT";
        const messageType = VALID_MESSAGE_TYPES.includes(upperType) ? upperType : "TEXT";

        // Salvar mensagem do cliente
        const savedMessage = await prisma.message.create({
            data: {
                conversationId: conversation.id,
                type: messageType as "TEXT",
                content: body || "[Mídia]",
                sender: "CUSTOMER",
                mediaUrl: messageData.mediaUrl || null,
            },
        });

        // Emitir via WebSocket (via Redis pub/sub)
        publishNewMessage(conversation.id, companyId, {
            id: savedMessage.id,
            content: savedMessage.content,
            type: savedMessage.type,
            sender: "CUSTOMER",
            createdAt: savedMessage.createdAt.toISOString(),
            mediaUrl: savedMessage.mediaUrl,
        });

        // Atualizar conversa
        await prisma.conversation.update({
            where: { id: conversation.id },
            data: {
                lastMessageAt: new Date(),
                unreadCount: { increment: 1 },
            },
        });

        // Dispatch MESSAGE_RECEIVED webhook (async, non-blocking)
        dispatchWebhook(companyId, "MESSAGE_RECEIVED", {
            conversationId: conversation.id,
            messageId: savedMessage.id,
            customerPhone,
            content: body || "[Mídia]",
            type: messageType,
            timestamp: new Date().toISOString(),
        }).catch((err) => logger.error("Webhook dispatch failed", { error: err }));

        // 🔥 DETECÇÃO DE COMPROVANTE DE PAGAMENTO
        // Se cliente enviou IMAGEM e tem pedido pendente, associar como comprovante
        if (messageType === "IMAGE" && messageData.mediaUrl) {
            const pendingOrder = await prisma.order.findFirst({
                where: {
                    conversationId: conversation.id,
                    status: "AWAITING_PAYMENT",
                },
                orderBy: { createdAt: "desc" },
            });

            if (pendingOrder) {
                // Atualizar pedido com comprovante
                await prisma.order.update({
                    where: { id: pendingOrder.id },
                    data: {
                        paymentProof: messageData.mediaUrl,
                        status: "PROOF_SENT",
                    },
                });

                logger.info("[PaymentProof] Payment proof received", {
                    orderId: pendingOrder.id,
                    conversationId: conversation.id,
                });

                // Enviar mensagem de confirmação de recebimento do comprovante
                if (conversation.agent) {
                    const proofMessage = `📸 *Comprovante recebido!*

Pedido *#${pendingOrder.id.slice(-6).toUpperCase()}*

Estamos verificando o pagamento e em breve confirmaremos seu pedido! ✅

Aguarde um instante... ⏳`;

                    try {
                        await wppConnect.sendTextMessage(session, from, proofMessage);

                        // Salvar mensagem da IA
                        await prisma.message.create({
                            data: {
                                conversationId: conversation.id,
                                type: "TEXT",
                                content: proofMessage,
                                sender: "AI",
                            },
                        });
                    } catch (sendError) {
                        logger.error("[PaymentProof] Failed to send confirmation", { error: sendError });
                    }
                }
            }
        }

        // Gerar resposta da IA se necessário
        // Check if AI is enabled for this company
        const aiIsEnabled = dbSession.company.aiEnabled ?? true;

        if (
            aiIsEnabled &&
            conversation.status === "AI_HANDLING" &&
            conversation.agent &&
            messageType === "TEXT" &&
            body?.trim()
        ) {
            await generateAndSendAIResponse({
                conversation,
                agent: conversation.agent,
                company: dbSession.company,
                messageContent: body,
                customerPhone: from,
                sessionName: session,
            });
        } else if (!aiIsEnabled) {
            logger.info("[Worker] AI disabled for company - skipping response", {
                companyId,
                conversationId: conversation.id,
            });
        }

        logger.info("Message processed successfully", { jobId: job.id });

    } catch (error) {
        logger.error("Error processing message", {
            jobId: job.id,
            error: error instanceof Error ? error.message : "Unknown error"
        });
        throw error; // BullMQ vai retry automaticamente
    }
}

/**
 * Gera e envia resposta da IA
 */
async function generateAndSendAIResponse(params: {
    conversation: { id: string; agent: { id: string } | null; customerName?: string | null };
    agent: { id: string; name: string; personality: string; tone?: string | null };
    company: { id: string; name: string; niche: string | null; description: string | null };
    messageContent: string;
    customerPhone: string;
    sessionName: string;
}) {
    const { conversation, agent, company, messageContent, customerPhone, sessionName } = params;

    // Buscar mensagens anteriores para contexto (reduzido para economia de tokens)
    const recentMessages = await prisma.message.findMany({
        where: { conversationId: conversation.id },
        orderBy: { createdAt: "desc" },
        take: 8,
    });

    // RAG: Buscar contexto relevante baseado na mensagem do cliente
    let trainingContext = "";
    let hasTrainingData = false;

    // Primeiro, tenta usar RAG (busca semântica)
    const hasEmbeddings = await hasEmbeddedTrainingData(agent.id);

    if (hasEmbeddings) {
        // Usa RAG para buscar chunks mais relevantes
        trainingContext = await getRelevantContext(agent.id, messageContent);
        hasTrainingData = trainingContext.length > 0;

        logger.info("[RAG] Using semantic search for context", {
            agentId: agent.id,
            hasContext: hasTrainingData
        });
    } else {
        // Fallback: usa todos os dados de treinamento (método antigo)
        const trainingData = await prisma.trainingData.findMany({
            where: { agentId: agent.id },
        });

        hasTrainingData = trainingData.length > 0;
        trainingContext = trainingData.map(t => `${t.title}: ${t.content}`).join("\n");

        logger.info("[RAG] Fallback to full training data", {
            agentId: agent.id,
            trainingCount: trainingData.length
        });
    }

    // Buscar memória de longo prazo do cliente
    const customerMemory = await getCustomerMemory(company.id, customerPhone);
    const memoryContext = formatMemoryForPrompt(customerMemory);

    // Gerar system prompt com contexto histórico
    // Buscar nome do cliente da conversa
    const conversationData = await prisma.conversation.findUnique({
        where: { id: conversation.id },
        select: { customerName: true },
    });
    const customerName = conversationData?.customerName;

    const systemPrompt = buildSystemPrompt(
        agent.personality,
        agent.tone,
        company.name,
        company.niche,
        company.description,
        hasTrainingData,
        memoryContext,
        customerName
    );

    // Gerar resposta
    const aiResult = await generateAIResponseWithFunctions({
        systemPrompt,
        messages: recentMessages.reverse().map(m => ({
            role: m.sender === "CUSTOMER" ? "user" as const : "assistant" as const,
            content: m.content,
        })),
        context: trainingContext,
        maxTokens: 350, // Reduzido de 500 para economia de tokens
        temperature: 0.4, // Reduzido de 0.5 para respostas mais focadas
        functionContext: {
            companyId: company.id,
            conversationId: conversation.id,
            agentId: agent.id,
        },
    });

    if (aiResult.response) {
        // Salvar resposta da IA
        const aiMessage = await prisma.message.create({
            data: {
                conversationId: conversation.id,
                type: "TEXT",
                content: aiResult.response,
                sender: "AI",
            },
        });

        // Emitir via WebSocket (via Redis pub/sub)
        publishNewMessage(conversation.id, company.id, {
            id: aiMessage.id,
            content: aiMessage.content,
            type: aiMessage.type,
            sender: "AI",
            createdAt: aiMessage.createdAt.toISOString(),
            mediaUrl: null,
        });

        // Enviar via WhatsApp
        await wppConnect.sendTextMessage(sessionName, customerPhone, aiResult.response);

        // Se a IA decidiu enviar um arquivo (ex: cardápio), enviar via WhatsApp
        if (aiResult.fileToSend) {
            try {
                logger.info("[MessageWorker] Sending file to customer", {
                    fileUrl: aiResult.fileToSend.url,
                    fileName: aiResult.fileToSend.fileName,
                    customerPhone,
                });

                await wppConnect.sendFile(
                    sessionName,
                    customerPhone,
                    aiResult.fileToSend.url,
                    aiResult.fileToSend.fileName
                );

                logger.info("[MessageWorker] File sent successfully");
            } catch (fileError) {
                logger.error("[MessageWorker] Failed to send file", { error: fileError });
                // Não falhar a resposta inteira por causa do erro de arquivo
            }
        }

        // Registrar uso de tokens (agregado por mês)
        const now = new Date();
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

        await prisma.tokenUsage.upsert({
            where: {
                companyId_month: {
                    companyId: company.id,
                    month: monthStart,
                },
            },
            update: {
                inputTokens: { increment: aiResult.inputTokens },
                outputTokens: { increment: aiResult.outputTokens },
            },
            create: {
                companyId: company.id,
                month: monthStart,
                inputTokens: aiResult.inputTokens,
                outputTokens: aiResult.outputTokens,
            },
        });

        logger.ai("AI response sent", {
            conversationId: conversation.id,
            tokens: aiResult.inputTokens + aiResult.outputTokens
        });

        // Atualizar memória do cliente após resposta
        try {
            const messagesForMemory = recentMessages.reverse().map(m => ({
                role: (m.sender === "CUSTOMER" ? "user" : "assistant") as "user" | "assistant",
                content: m.content,
            }));

            // Adicionar a resposta da IA ao contexto
            messagesForMemory.push({ role: "assistant", content: aiResult.response });

            // Gerar resumo e atualizar memória
            const summary = await generateConversationSummary(messagesForMemory);
            await updateCustomerMemory(
                company.id,
                customerPhone,
                summary,
                messagesForMemory.length
            );

            logger.info("[CustomerMemory] Memory updated after AI response", {
                companyId: company.id,
                customerPhone: customerPhone.replace(/@.*$/, "").slice(-4)
            });
        } catch (memError) {
            logger.error("[CustomerMemory] Failed to update memory", { error: memError });
            // Não falhar a resposta por causa de erro de memória
        }
    }
}

/**
 * Constrói system prompt EXCLUSIVO para LOJA DE ROUPAS NozesIA
 */
function buildSystemPrompt(
    personality: string,
    tone: string | null | undefined,
    companyName: string,
    _niche: string | null,
    description: string | null,
    hasTraining: boolean,
    memoryContext?: string,
    customerName?: string | null
): string {
    const descInfo = description || "Loja de roupas e moda com atendimento inteligente via WhatsApp.";
    const toneInfo = tone || "simpático e fashionista";

    // Data e hora atual no fuso horário de Brasília
    const now = new Date();
    const brazilOptions: Intl.DateTimeFormatOptions = { timeZone: "America/Sao_Paulo" };

    const brazilTime = now.toLocaleString("pt-BR", {
        ...brazilOptions,
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
    });

    let prompt = `Você é uma VENDEDORA HUMANA que trabalha na loja de roupas "${companyName}".
${descInfo ? `Sobre a loja: ${descInfo}` : ""}

⏰ DATA E HORA ATUAL: ${brazilTime}

=== SUA PERSONALIDADE ===
${personality}

=== SEU TOM DE VOZ ===
Responda sempre com um tom ${toneInfo}.

=== 👗 VOCÊ É UMA VENDEDORA DE LOJA DE ROUPAS ===

📋 O QUE VOCÊ FAZ:
- Ajuda clientes a encontrar roupas e acessórios
- Mostra fotos de produtos quando pedem
- Informa sobre tamanhos, cores e disponibilidade
- Processa pedidos e vendas
- Calcula frete para entrega
- Oferece retirada na loja

❌ O QUE VOCÊ NÃO FAZ (NUNCA!):
- NÃO agenda consultas médicas
- NÃO agenda reuniões
- NÃO fala sobre cardápios ou comida
- NÃO faz delivery de comida
- NÃO fala sobre procedimentos estéticos
- NÃO fala sobre serviços jurídicos
- NÃO faz agendamentos de nenhum tipo
- NÃO fala sobre imóveis
- NÃO oferece exames médicos

=== REGRAS ABSOLUTAS ===
1. 🚫 NUNCA diga que é IA, bot, assistente virtual, sistema ou robô
2. 🚫 NUNCA mencione "NozesIA" ou qualquer nome de sistema - você trabalha na loja "${companyName}"
3. 🚫 NUNCA fale sobre coisas que não sejam ROUPAS e MODA
4. ✅ Você É uma vendedora humana de verdade - aja como tal
5. ✅ Foque 100% em roupas, acessórios, moda e estilo
6. ✅ O nome da loja é "${companyName}" - use apenas esse nome

=== 🛒 FLUXO DE VENDA DE ROUPAS ===

1️⃣ QUANDO CLIENTE PERGUNTAR SOBRE PRODUTO:
   - Use buscarProduto() para ver preço e foto REAIS
   - "manda foto da camiseta" → buscarProduto("camiseta")
   - "tem vestido?" → buscarProduto("vestido")
   - "quero ver as calças" → buscarProduto("calça")

2️⃣ SEMPRE PERGUNTE TAMANHO E COR:
   - "Qual tamanho você usa? (P, M, G, GG)"
   - "Tem preferência de cor?"
   - Confirme disponibilidade no estoque

3️⃣ QUANDO CLIENTE QUISER COMPRAR:
   - Confirme: "1x Camiseta Preta M - R$89. Confirma?"
   - Pergunte: "Mais alguma peça?"
   - Mostre resumo: "📝 Seu pedido: 1x Camiseta R$89 - Subtotal: R$89"

4️⃣ PERGUNTE SOBRE ENTREGA:
   - "É para *ENTREGA* ou *RETIRADA* na loja?"
   - Se ENTREGA → Peça CEP e endereço para calcular frete
   - Se RETIRADA → Confirme endereço da loja

5️⃣ CALCULE O FRETE:
   - Use coletarEnderecoEntrega() com o CEP informado
   - Mostre: "Subtotal R$89 + Frete R$15 = Total R$104"

6️⃣ PAGAMENTO:
   - Pergunte: "Pagamento via PIX ou na entrega?"
   - Se PIX → Use processarVenda() para gerar dados
   - Se na entrega → Confirme e registre o pedido

=== 💡 DICAS DE VENDA ===
- Sugira combinações: "Essa calça fica linda com nossa blusa X!"
- Ofereça peças relacionadas: "Combinaria com esse cinto!"
- Mencione promoções se houver
- Seja simpática e fashionista

=== 🎁 TROCAS E DEVOLUÇÕES ===
Se cliente perguntar:
- "Trocas em até 30 dias com etiqueta e sem uso!"
- Para casos específicos: "Deixa eu verificar isso pra você"

=== ⚠️ REGRAS IMPORTANTES ===
- Use buscarProduto() para preços - NUNCA invente valores!
- NUNCA confirme estoque sem verificar
- Frete só é calculado DEPOIS do CEP
- Se não souber algo: "Deixa eu verificar aqui e te retorno!"

=== 🚨 PROIBIDO INVENTAR (CRÍTICO) ===
🔴 NUNCA invente NADA que não esteja no seu treinamento:
- NÃO invente preços, valores ou promoções
- NÃO invente tamanhos ou cores disponíveis
- NÃO invente prazos de entrega
- NÃO invente políticas de troca
- NÃO invente formas de pagamento
- NÃO invente endereço ou horário da loja

✅ SE A INFORMAÇÃO NÃO EXISTIR NO TREINAMENTO:
- Diga: "Deixa eu verificar isso aqui e já te passo!"
- Ou: "Vou confirmar essa informação e te retorno!"
- NUNCA chute ou improvise uma resposta

⚠️ MESMO PARA PERGUNTAS SIMPLES:
- Se não souber o preço → "Deixa eu ver quanto tá!"
- Se não souber o estoque → "Vou olhar aqui se tem!"
- Se não souber o horário → "Deixa eu confirmar nosso horário!"

=== 👋 DESPEDIDA ===
Quando cliente quiser finalizar ("valeu", "obrigado", "era isso"):
- Use finalizarConversa() para despedida personalizada

=== EMPRESA ===
Nome: ${companyName}
Segmento: Loja de Roupas e Moda`;

    // Adicionar nome do cliente se existir
    if (customerName && customerName !== "Cliente") {
        prompt += `

=== 🧑 CLIENTE ATUAL ===
O nome deste cliente é: **${customerName}**
- Use o nome "${customerName}" quando for natural
- Na despedida, use o nome: "Tchau, ${customerName}!"`;
    }

    // Adicionar memória do cliente se existir
    if (memoryContext) {
        prompt += `\n\n=== HISTÓRICO DESTE CLIENTE ===\n${memoryContext}\nUse essas informações para personalizar o atendimento!`;
    }

    if (!hasTraining) {
        prompt += `\n\n=== ATENÇÃO ===
Você ainda não tem informações detalhadas sobre os produtos da loja.
Pergunte o que o cliente procura e diga: "Deixa eu verificar aqui e te retorno!"`;
    }

    return prompt;
}

// ============================================
// WORKER PRINCIPAL
// ============================================

let worker: Worker<MessageQueueJob> | null = null;

/**
 * Inicia o worker
 */
export function startWorker(): Worker<MessageQueueJob> {
    if (worker) {
        logger.warn("Worker already running");
        return worker;
    }

    const connection = getRedisConnection();

    worker = new Worker<MessageQueueJob>(
        "whatsapp-messages",
        async (job: Job<MessageQueueJob>) => {
            if (job.data.type === "whatsapp_message") {
                await processWhatsAppMessage(job as Job<WhatsAppMessageJob>);
            }
            // Adicionar outros tipos de job aqui
        },
        {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            connection: connection as any,
            concurrency: 5, // Processar 5 jobs em paralelo
            limiter: {
                max: 10,
                duration: 1000, // Máximo 10 jobs por segundo
            },
        }
    );

    // Event handlers
    worker.on("completed", (job) => {
        logger.debug("Job completed", { jobId: job.id });
    });

    worker.on("failed", (job, err) => {
        logger.error("Job failed", {
            jobId: job?.id,
            error: err.message,
            attempts: job?.attemptsMade
        });
    });

    worker.on("error", (err) => {
        logger.error("Worker error", { error: err.message });
    });

    logger.info("Message worker started", { concurrency: 5 });

    return worker;
}

/**
 * Para o worker
 */
export async function stopWorker(): Promise<void> {
    if (worker) {
        await worker.close();
        worker = null;
        logger.info("Worker stopped");
    }
}

// Se executado diretamente, iniciar worker
if (require.main === module) {
    console.log("Starting BullMQ worker...");
    startWorker();

    // Graceful shutdown
    process.on("SIGTERM", async () => {
        console.log("Shutting down worker...");
        await stopWorker();
        process.exit(0);
    });

    process.on("SIGINT", async () => {
        console.log("Shutting down worker...");
        await stopWorker();
        process.exit(0);
    });
}
