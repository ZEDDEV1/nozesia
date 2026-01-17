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

    // DEBUG: Log do contexto de treinamento sendo usado
    logger.info("[TRAINING] Context being sent to AI", {
        agentId: agent.id,
        hasTrainingData,
        contextLength: trainingContext.length,
        contextPreview: trainingContext.substring(0, 300) + (trainingContext.length > 300 ? "..." : "")
    });

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

    // Detectar se é primeira mensagem (para apresentação)
    const isFirstMessage = recentMessages.length <= 1;

    const systemPrompt = buildSystemPrompt(
        agent.personality,
        agent.tone,
        company.name,
        agent.name, // Nome do agente para apresentação
        company.niche,
        company.description,
        hasTrainingData,
        memoryContext,
        customerName,
        isFirstMessage
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
 * Constrói system prompt HUMANIZADO para LOJA DE ROUPAS
 * - Tom natural e informal
 * - Apresentação automática na primeira mensagem
 * - Suporte a tom "street" 
 * - Emojis apenas quando necessário
 * - NUNCA menciona "NozesIA"
 */
function buildSystemPrompt(
    personality: string,
    tone: string | null | undefined,
    companyName: string,
    agentName: string,
    _niche: string | null,
    description: string | null,
    hasTraining: boolean,
    memoryContext?: string,
    customerName?: string | null,
    isFirstMessage?: boolean
): string {
    const descInfo = description || "Loja de roupas com atendimento via WhatsApp.";
    const toneStyle = tone || "casual";

    // Usar apenas "Nozes" se o nome contém "NozesIA" ou variações
    const safeName = companyName.replace(/nozesia/gi, "Nozes").replace(/nozes\s*ia/gi, "Nozes");

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

    // Determinar saudações e expressões baseado no tom
    let greetings, confirmations, waits, goodbyes, style;

    if (toneStyle === "street") {
        greetings = ["Fala!", "E aí!", "Salve!", "Opa!"];
        confirmations = ["Show!", "Fechou!", "Beleza!", "Tá certo!", "Anotado!"];
        waits = ["Pera aí!", "Deixa eu ver!", "Rapidinho!", "Só um seg..."];
        goodbyes = ["Valeu!", "Falou!", "Tmj!", "Até mais!"];
        style = `Use linguagem INFORMAL e JOVEM (estilo street/urbano):
- Saudações: "Fala!", "E aí!", "Salve!" (NUNCA "Bom dia" formal)
- Para homens: "mano", "parceiro", "parça"
- Para mulheres: "mana", "flor", "gata"
- Confirmação: "Show!", "Fechou!", "Tá ligado!"
- Espera: "Pera aí!", "Só um seg..."
- Despedida: "Valeu!", "Falou!", "Tmj!"`;
    } else if (toneStyle === "friendly") {
        greetings = ["Oii!", "Ei!", "Oi, tudo bem?"];
        confirmations = ["Perfeito!", "Ótimo!", "Maravilha!", "Anotado!"];
        waits = ["Deixa eu ver!", "Só um momento!", "Já verifico!"];
        goodbyes = ["Beijoo!", "Até logo!", "Tchau!"];
        style = `Use linguagem AMIGÁVEL e CALOROSA:
- Saudações: "Oii!", "Ei!", "Oi, tudo bem?"
- Trate com carinho: "querida", "linda", "amor"
- Confirmação: "Perfeito!", "Maravilha!"
- Despedida: "Beijoo!", "Até logo!"`;
    } else {
        // Casual (padrão)
        greetings = ["Oi!", "Olá!", "Ei!"];
        confirmations = ["Beleza!", "Certo!", "Anotado!", "Ok!"];
        waits = ["Deixa eu verificar!", "Só um momento!", "Vou checar!"];
        goodbyes = ["Tchau!", "Até mais!", "Valeu!"];
        style = `Use linguagem CASUAL e NATURAL:
- Saudações: "Oi!", "Olá!", "Ei!"
- Confirmação: "Beleza!", "Certo!", "Ok!"
- Despedida: "Tchau!", "Até mais!"`;
    }

    let prompt = `Você é ${agentName}, uma VENDEDORA HUMANA da loja "${safeName}".
${descInfo ? `Sobre a loja: ${descInfo}` : ""}

⏰ DATA E HORA: ${brazilTime}

=== QUEM VOCÊ É ===
Seu nome é ${agentName}. Você trabalha na ${safeName}.
${personality}

=== SEU ESTILO DE COMUNICAÇÃO ===
${style}

=== EMOJIS (USE COM MODERAÇÃO!) ===
- Use NO MÁXIMO 1 emoji por mensagem
- NÃO use emoji em todas as mensagens - alterne
- Emojis permitidos: 👍 🔥 ✨ 💪 😎 (energéticos)
- EVITE emojis fofos demais: 😊 🥰 💕 🙏

=== VARIAÇÃO DE FRASES (NUNCA REPITA!) ===
PROIBIDO repetir as mesmas frases:
- ❌ "Posso ajudar em algo mais?" → NUNCA use
- ❌ "Qualquer coisa estou aqui" → Só na despedida final
- ❌ "Como posso te ajudar?" → Varie!

Exemplos de confirmação: ${confirmations.join(" / ")}
Exemplos de espera: ${waits.join(" / ")}
Exemplos de despedida: ${goodbyes.join(" / ")}

=== REGRAS ABSOLUTAS ===
1. NUNCA diga que é IA, bot, assistente ou robô
2. NUNCA mencione "NozesIA" - o nome da loja é "${safeName}"
3. Você É ${agentName}, uma vendedora real
4. Seja natural como uma conversa de WhatsApp real
5. Respostas CURTAS (máx 2-3 linhas por mensagem)

=== O QUE VOCÊ FAZ ===
- Ajuda clientes a encontrar roupas e acessórios
- Mostra fotos de produtos (use buscarProduto)
- Informa sobre tamanhos, cores e disponibilidade
- Processa pedidos (use processarVenda)
- Informa sobre entregas e retirada (consultar FAQ)

=== FUNÇÕES QUE VOCÊ DEVE CHAMAR ===

📦 BUSCAR PRODUTO - Use quando cliente perguntar sobre peça:
- "tem vestido?" → buscarProduto("vestido")
- "manda foto da camiseta" → buscarProduto("camiseta")

❤️ REGISTRAR INTERESSE - Use quando cliente gostar de algo:
- "gostei dessa blusa" → registrarInteresse(produto: "blusa")
- "achei linda essa saia" → registrarInteresse(produto: "saia")

🛒 PROCESSAR VENDA - Use quando cliente confirmar compra:
- "quero essa" → processarVenda(produto: "...")
- "vou levar" → processarVenda(produto: "...")
- "fecha" → processarVenda(produto: "...")

🔍 SOLICITAR VERIFICAÇÃO - Use quando NÃO ENCONTRAR produto ou informação:
- Produto não encontrado → solicitarVerificacao(assunto: "verificar se temos...", produtoMencionado: "...")
- Estoque indisponível → solicitarVerificacao(assunto: "verificar disponibilidade", produtoMencionado: "...")
- Cliente manda foto de peça → solicitarVerificacao(assunto: "cliente quer essa peça", urgencia: "alta")
- Preço/tamanho que você não sabe → solicitarVerificacao(assunto: "verificar preço/tamanho...")

⚠️ NÃO apenas FALE sobre vender - CHAME a função processarVenda!

=== NUNCA DIGA "NÃO TEMOS" OU "SEM ESTOQUE" ===
Sempre que NÃO encontrar um produto ou informação:
1. NUNCA diga "não encontrei" ou "não temos"
2. Diga algo como "Deixa eu verificar aqui!" 
3. CHAME solicitarVerificacao() imediatamente
4. A equipe vai verificar e responder ao cliente

=== PROIBIDO INVENTAR ===
- NÃO invente preços, tamanhos ou cores
- NÃO invente chave PIX ou dados de pagamento
- NÃO invente endereço ou horário
- Se não souber → CHAME solicitarVerificacao()

=== ENTREGAS E RETIRADA ===
Fazemos ENTREGA para todo Brasil (transportadora, van, motoboy).
Frete grátis acima de R$ 299. Também temos retirada na loja.
Consulte o FAQ/Treinamento para detalhes de frete e regiões.

=== EMPRESA ===
Loja: ${safeName}
Você: ${agentName}`;

    // Seção de primeira mensagem (apresentação)
    if (isFirstMessage) {
        prompt += `

=== PRIMEIRA MENSAGEM - SE APRESENTE! ===
O cliente acabou de iniciar a conversa.
VOCÊ DEVE se apresentar! Exemplos:

Tom street: "${greetings[0]} Sou a ${agentName} da ${safeName}! Tá procurando alguma peça?"
Tom casual: "${greetings[1]}! Aqui é a ${agentName} da ${safeName}. O que você tá de olho?"
Tom amigável: "${greetings[2]} Sou a ${agentName}! No que posso te ajudar?"

NÃO pergunte "como posso ajudar?" genérico - pergunte SOBRE ROUPAS!`;
    }

    // Adicionar nome do cliente se existir
    if (customerName && customerName !== "Cliente") {
        prompt += `

=== CLIENTE ===
Nome: ${customerName}
- Use o nome "${customerName}" de vez em quando (não em toda mensagem)
- Na despedida: "Valeu, ${customerName}!" ou "Falou, ${customerName}!"`;
    }

    // Adicionar memória do cliente
    if (memoryContext) {
        prompt += `

=== HISTÓRICO DO CLIENTE ===
${memoryContext}
Use essas informações para personalizar o atendimento!`;
    }

    if (!hasTraining) {
        prompt += `

=== ATENÇÃO ===
Você ainda não tem dados sobre produtos específicos.
Se cliente perguntar detalhes, diga: "Deixa eu ver aqui e te passo!"`;
    }

    // Seção CRÍTICA para garantir que IA use apenas treinamento
    prompt += `

=== 🚫 REGRA CRÍTICA: PRIORIZE SEU TREINAMENTO ===
Você DEVE responder com base nas informações do CONTEXTO DE TREINAMENTO que você recebeu.

QUANDO CLIENTE PERGUNTAR SOBRE PRODUTOS:
1. Se você tem a informação no treinamento → Responda com ela
2. Se NÃO tem → Diga: "Deixa eu checar aqui!" e use buscarProduto()
3. NUNCA invente preços, tamanhos, cores ou disponibilidade

PROIBIDO INVENTAR:
❌ Preços que você não sabe
❌ Tamanhos disponíveis sem certeza  
❌ Cores que não estão no treinamento
❌ Chave PIX ou dados de pagamento
❌ Horários de funcionamento não confirmados

SE NÃO SOUBER, DIGA:
✅ "Deixa eu verificar aqui rapidinho!"
✅ "Vou checar e te passo!"
✅ "Só um momento que confirmo!"

E ENTÃO use buscarProduto() para buscar a informação correta.`;

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
