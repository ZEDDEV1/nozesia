import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { wppConnect } from "@/lib/wppconnect";
import { generateAIResponseWithFunctions, transcribeAudio, analyzeImage, generateSpeech, audioToBase64, TTSVoice } from "@/lib/openai";
import { rateLimitMiddleware } from "@/lib/rate-limit";
import { logger } from "@/lib/logger";
import { emitSocketMessage, emitSocketConversation } from "@/lib/socket-emit";
import { shouldRespondToMessage, logMessageFilter } from "@/lib/message-filter";
import { checkTokenLimit } from "@/lib/token-limit";
import { getCachedResponse, setCachedResponse } from "@/lib/ai-cache";
import { getCustomerMemory, formatMemoryForPrompt, updateCustomerMemory, generateConversationSummary } from "@/lib/customer-memory";
import { cacheTrainingData } from "@/lib/cache";
import { selectBestAgent } from "@/lib/agent-router";

// Aumenta o tempo máximo que a rota pode rodar (em segundos)
export const maxDuration = 60;

// Valid message types in the database
const VALID_MESSAGE_TYPES = ["TEXT", "IMAGE", "AUDIO", "VIDEO", "DOCUMENT", "STICKER", "LOCATION"];

// Patterns that indicate client wants audio response
const AUDIO_REQUEST_PATTERNS = [
    /mand(a|e|ar?)\s*(um\s*)?(audio|áudio|voz)/i,
    /pode\s*(me\s*)?(mandar|enviar)\s*(um\s*)?(audio|áudio|voz)/i,
    /quero\s*(um\s*)?(audio|áudio)/i,
    /prefiro\s*(audio|áudio|ouvir)/i,
    /fala\s*(isso|pra mim|comigo)\s*no\s*(audio|áudio)/i,
    /responde\s*em\s*(audio|áudio)/i,
    /pode\s*ser\s*em\s*(audio|áudio)/i,
    /grav(a|e)\s*(um\s*)?(audio|áudio)/i,
    // Novos padrões mais abrangentes
    /envi(a|e)\s*(me\s*)?(um\s*)?(audio|áudio)/i,
    /me\s*envi(a|e)\s*(um\s*)?(audio|áudio)/i,
    /(por|em)\s*(audio|áudio)/i,
    /^(audio|áudio)$/i,
    /(fala|responde|diz)\s*(em|por|no)\s*(audio|áudio)/i,
    /manda\s*(audio|áudio)/i,
    /envia\s*(audio|áudio)/i,
    /(quero|deixa|posso)\s*ouvir/i,
    /audio\s*por\s*favor/i,
    /áudio\s*por\s*favor/i,
];

/**
 * Determines if AI should respond with audio based on:
 * 1. Client sent an audio message (respond in same format)
 * 2. Client explicitly asked for audio response
 */
function shouldRespondWithAudio(
    messageType: string,
    messageContent: string,
    voiceEnabled: boolean
): { shouldUseAudio: boolean; reason: string } {
    // Voice must be enabled for the agent
    if (!voiceEnabled) {
        return { shouldUseAudio: false, reason: "Voice disabled for agent" };
    }

    // Rule 1: Client sent audio - respond with audio
    if (messageType === "AUDIO" || messageType === "PTT") {
        return { shouldUseAudio: true, reason: "Client sent audio" };
    }

    // Rule 2: Client explicitly asked for audio
    for (const pattern of AUDIO_REQUEST_PATTERNS) {
        if (pattern.test(messageContent)) {
            return { shouldUseAudio: true, reason: "Client requested audio" };
        }
    }

    // Default: respond with text
    return { shouldUseAudio: false, reason: "Default text response" };
}

// Build a NATURAL system prompt that makes AI respond like a real human
function buildRestrictivePrompt(
    agentPersonality: string,
    companyName: string,
    companyNiche: string | null,
    companyDescription: string | null,
    hasTrainingData: boolean
): string {
    // Usar apenas "Nozes" se o nome contém "NozesIA" ou variações
    const safeName = companyName.replace(/nozesia/gi, "Nozes").replace(/nozes\s*ia/gi, "Nozes");

    const nicheInfo = companyNiche ? ` do segmento de ${companyNiche}` : "";
    const descInfo = companyDescription ? ` (${companyDescription})` : "";

    return `Você é ${safeName}${nicheInfo}${descInfo}. ${agentPersonality}

=== COMPORTAMENTO ===
- Você é HUMANO (nunca diga que é IA/bot/assistente)
- NUNCA mencione "NozesIA" - o nome da loja é "${safeName}"
- Converse naturalmente como pelo WhatsApp
- Emojis: use NO MÁXIMO 1 por mensagem, nem em todas
- VARIE respostas, nunca repita frases
- PROIBIDO: "Posso ajudar em algo mais?" - nunca use
- Respostas curtas (máx 2-3 linhas)
- Leia contexto: se já cumprimentou, não cumprimente de novo

=== REGRAS ===
- NÃO invente preços/produtos que não sabe
- Se não souber: "Deixa eu ver aqui e te passo!"
- Pode enviar áudios (sistema converte automático)

=== PROIBIDO INVENTAR ===
NUNCA invente informações que não estão no treinamento:
- Preços, tamanhos, cores, estoque, prazos
- Chave PIX ou dados de pagamento
- Se não souber → "Deixa eu verificar aqui!"

${!hasTrainingData ? "⚠️ SEM dados de produtos. Colete info e diga: 'Deixa eu checar aqui!'" : ""}`;
}

/**
 * Build system prompt WITH customer memory context and temporal context
 */
function buildPromptWithMemory(
    agentPersonality: string,
    companyName: string,
    companyNiche: string | null,
    companyDescription: string | null,
    hasTrainingData: boolean,
    memoryContext: string,
    temporalContext?: {
        minutesSinceLastMessage: number;
        isReturningCustomer: boolean;
        customerName?: string;
    }
): string {
    let prompt = buildRestrictivePrompt(agentPersonality, companyName, companyNiche, companyDescription, hasTrainingData);

    // Adicionar contexto de memória do cliente
    if (memoryContext) {
        prompt += `\n\n${memoryContext}`;
    }

    // ============================================
    // CONTEXTO TEMPORAL - Adapta tom baseado no tempo
    // ============================================
    if (temporalContext) {
        const { minutesSinceLastMessage, isReturningCustomer, customerName } = temporalContext;
        const nameRef = customerName && customerName !== "Cliente" ? customerName : "o cliente";

        if (isReturningCustomer) {
            // Cliente retornando após 4+ horas
            prompt += `

=== CLIENTE RETORNANDO ===
${nameRef} está retornando após ${Math.round(minutesSinceLastMessage / 60)} horas de inatividade.
- Cumprimente naturalmente como se fosse um novo atendimento
- Você pode mencionar brevemente algo da conversa anterior SE for relevante
- NÃO diga "continuando de onde paramos" - trate como nova conversa
- Exemplo: "Ei, tudo bem? 😊" ou "Opa, voltou! No que posso ajudar?"`;
        } else if (minutesSinceLastMessage > 15) {
            // Cliente demorou mais de 15 minutos para responder
            prompt += `

=== NOTA DE TEMPO ===
Passaram ${minutesSinceLastMessage} minutos desde a última mensagem.
- Continue naturalmente, sem cobrar ou parecer ansioso
- Se a resposta não fizer sentido com o contexto, pode perguntar gentilmente o que precisa`;
        }
    }

    // ============================================
    // INSTRUÇÕES DE FINALIZAÇÃO DE CONVERSA
    // ============================================
    prompt += `

=== QUANDO FINALIZAR A CONVERSA ===
Você DEVE chamar a função "finalizarConversa" quando identificar FIM natural da conversa:

SINAIS DE QUE O CLIENTE QUER ENCERRAR:
- Disse "obrigado", "valeu", "brigado" sem fazer nova pergunta
- Disse "ok", "tá bom", "entendi" de forma conclusiva
- Disse "era só isso", "só isso mesmo", "é isso"
- Mandou emoji de despedida: 👋 🙏 ✌️ 👍 (sozinho)
- Disse "tchau", "até mais", "até logo", "bye"
- Disse "depois eu volto", "depois vejo", "vou pensar"

QUANDO NÃO FINALIZAR (cliente quer continuar):
- "obrigado, mas tenho outra dúvida..."
- "valeu! e sobre X, como funciona?"
- Qualquer pergunta nova após agradecimento

COMO AGIR:
1. Se detectar FIM → chame finalizarConversa com mensagem natural de despedida
2. Se cliente agradecer MAS não tiver outra pergunta → finalize educadamente
3. Despedida deve ser CURTA e NATURAL: "Valeu! Qualquer coisa, é só chamar 👋"`;

    return prompt;
}

export async function POST(request: Request) {
    // ============================================
    // 🔍 DEBUG: console.log puro (SEMPRE aparece no PM2, diferente do logger)
    // ============================================
    console.log('\n\n========================================');
    console.log('🔥 [WEBHOOK] POST RECEBIDO!');
    console.log('🔥 [WEBHOOK] URL:', request.url);
    console.log('🔥 [WEBHOOK] Timestamp:', new Date().toISOString());
    console.log('========================================\n');

    // Rate limiting - protege contra flood de mensagens
    const rateLimitResponse = await rateLimitMiddleware(request, 'webhook');
    if (rateLimitResponse) {
        console.log('⛔ [WEBHOOK] Rate limited!');
        logger.warn('Webhook rate limited');
        return rateLimitResponse;
    }

    try {
        let body;
        try {
            body = await request.json();
        } catch (parseError: unknown) {
            console.error('❌ [WEBHOOK] ERRO AO FAZER PARSE DO BODY:', parseError instanceof Error ? parseError.message : parseError);
            return NextResponse.json({ success: false, error: 'Invalid JSON' }, { status: 400 });
        }

        console.log('✅ [WEBHOOK] Body parseado com sucesso!', {
            event: body.event || body.type,
            session: body.session,
            from: body.data?.from || body.from || 'UNKNOWN',
        });

        logger.info('>>> [WEBHOOK RAW PAYLOAD RECEIVED] <<<', { event: body.event || body.type, session: body.session, from: body.data?.from || body.from || "UNKNOWN" });
        logger.whatsapp('Received webhook', { event: body.event || body.type, session: body.session });

        const event = body.event || body.type;
        const session = body.session;

        // ==========================================
        // HANDLE SESSION STATUS CHANGES (connect/disconnect)
        // ==========================================
        if (event === "session_status") {
            const { status, reason } = body;

            logger.whatsapp("Session status change", { session, status, reason });

            if (!session) {
                return NextResponse.json({ success: true });
            }

            // Extract companyId from session name (format: companyId_suffix)
            const sessionParts = session.split("_");
            if (sessionParts.length < 2) {
                return NextResponse.json({ success: true });
            }
            const companyId = sessionParts[0];

            // Find and update session in database
            const dbSession = await prisma.whatsAppSession.findFirst({
                where: { companyId },
            });

            if (dbSession) {
                const newStatus = status === "CONNECTED" ? "CONNECTED" : "DISCONNECTED";

                await prisma.whatsAppSession.update({
                    where: { id: dbSession.id },
                    data: {
                        status: newStatus,
                        lastSeenAt: new Date(),
                        qrCode: newStatus === "DISCONNECTED" ? null : dbSession.qrCode,
                    },
                });

                logger.whatsapp("Session status updated in database", {
                    sessionId: dbSession.id,
                    newStatus,
                    reason
                });

                // Emit via WebSocket to update dashboard in real-time
                try {
                    const { emitSocketWhatsAppStatus } = await import("@/lib/socket-emit");
                    await emitSocketWhatsAppStatus(companyId, dbSession.id, newStatus);
                    logger.whatsapp("Emitted status change via WebSocket", { companyId, newStatus });
                } catch (socketErr) {
                    logger.error("Failed to emit status via WebSocket", { error: socketErr });
                }
            }

            return NextResponse.json({ success: true });
        }

        if (!event?.includes("message") && event !== "onmessage") {
            logger.info('Skipping non-message event', { event });
            return NextResponse.json({ success: true });
        }

        const messageData = body.data || body;
        const from = messageData.from || messageData.chatId || messageData.sender?.id;
        const messageBody = messageData.body || messageData.content || messageData.text || "";
        const isGroupMsg = messageData.isGroupMsg || messageData.isGroup || false;
        const senderName = messageData.sender?.pushname || messageData.sender?.name || messageData.notifyName || "Cliente";

        const isMedia = messageData.isMedia || messageData.mimetype;

        let messageType = (messageData.type || "chat").toUpperCase();
        if (messageType === "CHAT") messageType = "TEXT";
        if (messageType === "PTT") messageType = "AUDIO";
        if (!VALID_MESSAGE_TYPES.includes(messageType)) {
            messageType = "TEXT";
        }

        if (isGroupMsg) {
            logger.info("Skipping group message");
            return NextResponse.json({ success: true });
        }

        if (!from) {
            logger.info("No sender found in message");
            return NextResponse.json({ success: true });
        }

        // ==========================================
        // CRITICAL FILTERS: Skip non-conversation messages
        // ==========================================

        // Skip status/stories (sent via status@broadcast)
        if (from.includes("status@broadcast") || from === "status@broadcast") {
            logger.info("Skipping status/story message", { from });
            return NextResponse.json({ success: true });
        }

        // Skip broadcast lists (lists created by user)
        if (from.includes("@broadcast")) {
            logger.debug("Skipping broadcast list message", { from });
            return NextResponse.json({ success: true });
        }

        // Skip newsletter/channel messages
        if (from.includes("@newsletter") || from.includes("@channel")) {
            logger.info("Skipping newsletter/channel message", { from });
            return NextResponse.json({ success: true });
        }

        // Detect messages sent by ourselves (fromMe)
        // Instead of skipping ALL fromMe messages, we capture phone-sent messages
        // to show them in the dashboard. We deduplicate later to avoid double-saving
        // messages already saved by the dashboard API or AI handler.
        const isFromMe = messageData.fromMe || messageData.self || false;

        // Skip system messages (notifications, calls, etc.)
        const messageSubtype = messageData.subtype || messageData.type || "";
        if (["notification", "call_log", "e2e_notification", "gp2", "ciphertext", "revoked"].includes(messageSubtype.toLowerCase())) {
            logger.info("Skipping system message", { subtype: messageSubtype });
            return NextResponse.json({ success: true });
        }

        // ==========================================
        // TIMESTAMP FILTER: Skip old messages
        // Prevents AI from responding to message history when WhatsApp connects
        // ==========================================
        const MAX_MESSAGE_AGE_MS = 3 * 60 * 1000; // 3 minutes

        // WPPConnect sends timestamp in seconds (Unix epoch)
        const messageTimestamp = messageData.timestamp || messageData.t;

        if (messageTimestamp) {
            const messageDate = new Date(messageTimestamp * 1000);
            const messageAge = Date.now() - messageDate.getTime();

            if (messageAge > MAX_MESSAGE_AGE_MS) {
                logger.info("Skipping old message (received after connection)", {
                    from,
                    ageMinutes: Math.round(messageAge / 60000),
                    timestamp: new Date(messageTimestamp * 1000).toISOString()
                });
                return NextResponse.json({ success: true });
            }
        }

        logger.whatsapp("Processing message", { from, type: messageType });

        if (!session) {
            logger.info("No session in payload");
            return NextResponse.json({ success: true });
        }

        const sessionParts = session.split("_");
        if (sessionParts.length < 2) {
            logger.info("Invalid session format", { session });
            return NextResponse.json({ success: true });
        }

        const companyId = sessionParts[0];
        const originalFrom = from;

        const customerPhone = from
            .replace("@c.us", "")
            .replace("@s.whatsapp.net", "")
            .replace("@lid", "");

        // Find session in database - include company data for AI context
        let dbSession = await prisma.whatsAppSession.findFirst({
            where: { companyId },
            include: {
                company: true, // Get company niche and description
            },
        });

        if (!dbSession) {
            logger.info("Session not found for company", { companyId });
            return NextResponse.json({ success: true });
        }

        // Auto-update status if needed
        if (dbSession.status !== "CONNECTED") {
            logger.whatsapp("Auto-updating session status to CONNECTED", { companyId });
            dbSession = await prisma.whatsAppSession.update({
                where: { id: dbSession.id },
                data: {
                    status: "CONNECTED",
                    lastSeenAt: new Date(),
                    qrCode: null,
                },
                include: { company: true },
            });
        }

        // Find or create conversation - ALWAYS filter by companyId for isolation
        let conversation = await prisma.conversation.findFirst({
            where: {
                sessionId: dbSession.id,
                customerPhone,
                companyId, // ENSURE company isolation
            },
            include: { agent: true },
        });

        if (!conversation) {
            // Multi-agent routing: select best agent based on first message
            const { agent: selectedAgent, reason } = await selectBestAgent(companyId, messageBody);

            logger.whatsapp("Agent routing result", {
                agentId: selectedAgent?.id,
                agentName: selectedAgent?.name,
                reason
            });

            conversation = await prisma.conversation.create({
                data: {
                    companyId,
                    sessionId: dbSession.id,
                    agentId: selectedAgent?.id || null,
                    customerPhone,
                    customerWhatsAppId: originalFrom,
                    customerName: senderName,
                    status: selectedAgent ? "AI_HANDLING" : "OPEN",
                },
                include: { agent: true },
            });
            logger.whatsapp("Created new conversation", {
                conversationId: conversation.id,
                customerPhone,
                agentId: selectedAgent?.id,
                routingReason: reason
            });

            // Emit via WebSocket para atualização em tempo real
            emitSocketConversation(companyId, {
                id: conversation.id,
                customerName: senderName,
                customerPhone,
                status: conversation.status,
                unreadCount: 0,
                lastMessageAt: new Date().toISOString(),
            });
        }

        // ==========================================
        // TEMPORAL CONTEXT: Calculate time since last message
        // These values are used later in the AI prompt
        // ==========================================
        const NEW_SESSION_THRESHOLD_MS = 4 * 60 * 60 * 1000; // 4 hours
        const timeSinceLastMessage = conversation ? Date.now() - conversation.lastMessageAt.getTime() : 0;
        const minutesSinceLastMessage = Math.round(timeSinceLastMessage / 60000);
        const isReturningCustomer = timeSinceLastMessage > NEW_SESSION_THRESHOLD_MS;

        if (conversation) {
            // Atualizar nome e WhatsApp ID se mudou
            const updateData: Record<string, string | Date> = {};
            if (senderName !== "Cliente" && conversation.customerName !== senderName) {
                updateData.customerName = senderName;
            }
            // Sempre atualizar o WhatsApp ID se não existe (para conversas antigas)
            if (!conversation.customerWhatsAppId || conversation.customerWhatsAppId !== originalFrom) {
                updateData.customerWhatsAppId = originalFrom;
            }

            // ==========================================
            // INTELLIGENT CONTEXT: Handle returning customer
            // ==========================================

            // Reopen closed conversation
            if (conversation.status === "CLOSED") {
                // Find the best agent for this new session
                const { agent: selectedAgent, reason } = await selectBestAgent(companyId, messageBody);

                updateData.status = selectedAgent ? "AI_HANDLING" : "OPEN" as unknown as string;
                if (selectedAgent) {
                    updateData.agentId = selectedAgent.id as unknown as string;
                }
                updateData.lastMessageAt = new Date() as unknown as string;

                logger.whatsapp("Reopening closed conversation", {
                    conversationId: conversation.id,
                    wasClosedFor: Math.round(timeSinceLastMessage / 60000) + " minutes",
                    newAgentId: selectedAgent?.id,
                    reason
                });

                // Update the conversation object in memory too
                conversation = {
                    ...conversation,
                    status: selectedAgent ? "AI_HANDLING" : "OPEN",
                    // Note: agent will be refetched or use existing if needed
                };
            } else if (isReturningCustomer && conversation.status === "AI_HANDLING") {
                // Customer returning to active AI conversation after long time
                // Just log it - the AI will handle context through memory
                logger.whatsapp("Returning customer detected", {
                    conversationId: conversation.id,
                    hoursAway: Math.round(timeSinceLastMessage / 3600000),
                });
            }

            if (Object.keys(updateData).length > 0) {
                await prisma.conversation.update({
                    where: { id: conversation.id },
                    data: updateData as Record<string, unknown>,
                });
            }
        }

        let finalContent = messageBody;
        let transcription = "";

        // Handle audio transcription
        if (messageType === "AUDIO") {
            logger.whatsapp("Processing audio message");
            try {
                // Try to get base64 data from body or mediaData
                let base64Data: string | null = null;

                if (messageData.body && messageData.body.startsWith("data:")) {
                    base64Data = messageData.body.split(",")[1];
                    logger.debug("Audio base64 from body", { size: base64Data?.length });
                } else if (messageData.mediaData?.data) {
                    base64Data = messageData.mediaData.data;
                    logger.debug("Audio base64 from mediaData", { size: base64Data?.length });
                }

                if (base64Data) {
                    logger.whatsapp("Transcribing audio");
                    const audioBuffer = Buffer.from(base64Data, "base64");
                    transcription = await transcribeAudio(audioBuffer);
                    logger.whatsapp("Audio transcription result", { preview: transcription.substring(0, 50) });

                    // Content shows transcription with emoji prefix
                    finalContent = transcription ? `🎤 "${transcription}"` : "🎤 [Áudio recebido]";
                } else {
                    finalContent = "🎤 [Áudio - não foi possível processar]";
                    logger.debug("Audio has no base64 data");
                }
            } catch (error) {
                logger.error("[Webhook] Audio transcription error", { error });
                finalContent = "🎤 [Áudio recebido]";
            }
        }

        // Handle image with caption and Vision AI analysis
        let mediaUrl: string | null = null;
        let imageAnalysis: {
            description: string;
            type: string;
            details?: {
                isPIXReceipt?: boolean;
                pixValue?: string;
                pixDate?: string;
            };
        } | null = null;

        if (messageType === "IMAGE") {
            const caption = messageData.caption || "";
            // Get media URL - WPPConnect can send as body (base64) or mediaUrl
            mediaUrl = messageData.mediaUrl || messageData.body || null;

            // Try to get base64 for Vision AI analysis
            let imageBase64: string | null = null;
            if (messageData.body && messageData.body.startsWith("data:")) {
                imageBase64 = messageData.body;
            } else if (messageData.mediaData?.data) {
                const mimeType = messageData.mediaData.mimetype || "image/jpeg";
                imageBase64 = `data:${mimeType};base64,${messageData.mediaData.data}`;
            }

            // Analyze image with Vision AI if we have base64
            if (imageBase64 && conversation.status === "AI_HANDLING") {
                try {
                    logger.whatsapp("Analyzing image with Vision AI");
                    const companyDescription = dbSession?.company?.description || "";
                    const analysis = await analyzeImage(imageBase64, companyDescription);

                    logger.whatsapp("Vision AI analysis", { type: analysis.type });
                    imageAnalysis = analysis;

                    // Create descriptive content based on analysis
                    if (analysis.details?.isPIXReceipt) {
                        finalContent = `📷 [Comprovante PIX] ${analysis.details.pixValue || ""} ${analysis.details.pixDate || ""}`.trim();
                        if (caption) finalContent += ` - ${caption}`;
                    } else if (analysis.type === "product") {
                        finalContent = `📷 [Foto de Produto] ${analysis.description}`;
                        if (caption) finalContent += ` - ${caption}`;
                    } else if (analysis.type === "screenshot") {
                        finalContent = `📷 [Screenshot] ${analysis.description}`;
                        if (caption) finalContent += ` - ${caption}`;
                    } else {
                        finalContent = caption
                            ? `📷 ${caption} (${analysis.description})`
                            : `📷 [Imagem] ${analysis.description}`;
                    }
                } catch (error) {
                    logger.error("[Webhook] Vision AI error", { error });
                    finalContent = caption ? `📷 ${caption}` : "📷 [Imagem recebida]";
                }
            } else {
                // No Vision AI - just use caption
                finalContent = caption ? `📷 ${caption}` : "📷 [Imagem recebida]";
            }
        }

        // Handle audio/video media URLs (for displaying in frontend)
        if (messageType === "AUDIO") {
            mediaUrl = messageData.mediaUrl || messageData.body || null;
        }

        if (messageType === "VIDEO") {
            finalContent = "🎥 [Vídeo recebido]";
            mediaUrl = messageData.mediaUrl || messageData.body || null;
        }

        // Handle document
        if (messageType === "DOCUMENT") {
            mediaUrl = messageData.mediaUrl || messageData.body || null;
            finalContent = `📄 ${messageData.filename || "[Documento recebido]"}`;
        }

        // Handle sticker
        if (messageType === "STICKER") {
            finalContent = "🎭 [Sticker]";
            mediaUrl = messageData.mediaUrl || messageData.body || null;
        }

        // ==========================================
        // HANDLE fromMe MESSAGES (sent from phone by owner)
        // These are messages sent directly from the WhatsApp app
        // We save them as HUMAN with deduplication against dashboard/AI messages
        // ==========================================
        if (isFromMe) {
            // For fromMe, the "from" field is actually the RECIPIENT (the customer)
            // The content is what WE sent to the customer
            const fromMeContent = finalContent || messageBody || "";

            if (!fromMeContent.trim()) {
                logger.debug("Skipping empty fromMe message");
                return NextResponse.json({ success: true });
            }

            // Deduplication: Check if this message was already saved in the last 60 seconds
            // This happens when dashboard or AI sends a message → WPPConnect fires fromMe webhook
            const recentDuplicate = await prisma.message.findFirst({
                where: {
                    conversationId: conversation.id,
                    content: fromMeContent,
                    sender: { in: ["AI", "HUMAN"] },
                    createdAt: { gte: new Date(Date.now() - 60_000) }, // last 60 seconds
                },
                orderBy: { createdAt: "desc" },
            });

            if (recentDuplicate) {
                logger.debug("Skipping duplicate fromMe message (already saved by dashboard/AI)", {
                    existingId: recentDuplicate.id,
                    sender: recentDuplicate.sender,
                });
                return NextResponse.json({ success: true });
            }

            // Not a duplicate — this was typed directly on the phone
            logger.whatsapp("Capturing phone-sent message as HUMAN", {
                conversationId: conversation.id,
                contentPreview: fromMeContent.substring(0, 50),
            });

            const phoneSentMessage = await prisma.message.create({
                data: {
                    conversationId: conversation.id,
                    type: messageType as "TEXT",
                    content: fromMeContent,
                    sender: "HUMAN",
                    mediaUrl: mediaUrl,
                },
            });

            // Emit via WebSocket so dashboard updates in real-time
            emitSocketMessage(conversation.id, companyId, {
                id: phoneSentMessage.id,
                content: phoneSentMessage.content,
                type: phoneSentMessage.type,
                sender: "HUMAN",
                createdAt: phoneSentMessage.createdAt.toISOString(),
                mediaUrl: phoneSentMessage.mediaUrl,
            });

            // Update conversation timestamp and switch to HUMAN_HANDLING
            await prisma.conversation.update({
                where: { id: conversation.id },
                data: {
                    lastMessageAt: new Date(),
                    status: "HUMAN_HANDLING", // Human took over by replying from phone
                },
            });

            // Do NOT trigger AI response for messages we sent ourselves
            return NextResponse.json({ success: true });
        }

        // ==========================================
        // CUSTOMER MESSAGE: Save and process normally
        // ==========================================
        if (!finalContent.trim() && !isMedia) {
            logger.debug("Skipping empty message");
            return NextResponse.json({ success: true });
        }

        // Save incoming message WITH mediaUrl
        const savedMessage = await prisma.message.create({
            data: {
                conversationId: conversation.id,
                type: messageType as "TEXT",
                content: finalContent || "[Mídia]",
                sender: "CUSTOMER",
                mediaUrl: mediaUrl,
            },
        });
        logger.whatsapp("Saved incoming message", {
            messageId: savedMessage.id,
            conversationId: conversation.id,
            type: messageType
        });

        // Emit via WebSocket para atualização em tempo real
        emitSocketMessage(conversation.id, companyId, {
            id: savedMessage.id,
            content: savedMessage.content,
            type: savedMessage.type,
            sender: savedMessage.sender as "CUSTOMER" | "AI" | "HUMAN",
            createdAt: savedMessage.createdAt.toISOString(),
            mediaUrl: savedMessage.mediaUrl,
        });

        // Update conversation
        await prisma.conversation.update({
            where: { id: conversation.id },
            data: {
                lastMessageAt: new Date(),
                unreadCount: { increment: 1 },
            },
        });

        // Generate AI response only if AI is handling
        if (
            conversation.status === "AI_HANDLING" &&
            conversation.agent &&
            (messageType === "TEXT" || (messageType === "AUDIO" && transcription) || (messageType === "IMAGE" && imageAnalysis))
        ) {
            const agent = conversation.agent;
            const company = dbSession.company;

            // For images, use the Vision AI analysis description
            // For audio, use the transcription
            // For text, use the original message body
            let contentForAI = messageBody;
            if (messageType === "AUDIO" && transcription) {
                contentForAI = transcription;
            } else if (messageType === "IMAGE" && imageAnalysis) {
                contentForAI = `[Cliente enviou uma imagem] ${imageAnalysis.description}`;
                // If it's a PIX receipt, add more context
                if (imageAnalysis.details?.isPIXReceipt) {
                    contentForAI = `[Cliente enviou um comprovante de PIX] Valor: ${imageAnalysis.details.pixValue || "não identificado"}, Data: ${imageAnalysis.details.pixDate || "não identificada"}`;
                }
            }

            if (!contentForAI.trim()) {
                logger.debug("No content for AI to process");
                return NextResponse.json({ success: true });
            }

            logger.ai("Generating AI response", { company: company.name });

            // ==========================================
            // TOKEN ECONOMY: Message Filter
            // ==========================================
            const filterResult = shouldRespondToMessage(contentForAI);
            logMessageFilter(contentForAI, filterResult);

            if (!filterResult.shouldRespond) {
                logger.debug("Message filtered, no AI response needed", { reason: filterResult.reason });

                // Send auto-response if available
                if (filterResult.autoResponse) {
                    await wppConnect.sendTextMessage(session, originalFrom, filterResult.autoResponse);

                    // Save auto-response message
                    await prisma.message.create({
                        data: {
                            conversationId: conversation.id,
                            type: "TEXT",
                            content: filterResult.autoResponse,
                            sender: "AI",
                        },
                    });
                }
                return NextResponse.json({ success: true });
            }

            // ==========================================
            // TOKEN ECONOMY: Check Token Limit
            // ==========================================
            const tokenStatus = await checkTokenLimit(companyId);
            if (tokenStatus.isLimitReached) {
                logger.warn("Token limit reached for company - AI will not respond", {
                    companyId,
                    usage: tokenStatus.currentUsage,
                    limit: tokenStatus.monthlyLimit,
                    upgradeRequired: tokenStatus.upgradeRequired
                });

                // IMPORTANT: Do NOT send any message to the customer about token limits
                // The customer should not know about internal business limitations
                // Just silently stop responding - customer will think business is offline/busy
                return NextResponse.json({ success: true });
            }

            // ==========================================
            // TOKEN ECONOMY: Check Cache
            // ==========================================
            const cachedResponse = await getCachedResponse(companyId, contentForAI);
            if (cachedResponse) {
                logger.debug("Using cached response", { companyId });

                // Save cached response as message
                const cachedAiMessage = await prisma.message.create({
                    data: {
                        conversationId: conversation.id,
                        type: "TEXT",
                        content: cachedResponse,
                        sender: "AI",
                    },
                });

                // Emit via WebSocket
                emitSocketMessage(conversation.id, companyId, {
                    id: cachedAiMessage.id,
                    content: cachedResponse,
                    type: "TEXT",
                    sender: "AI",
                    createdAt: cachedAiMessage.createdAt.toISOString(),
                    mediaUrl: null,
                });

                // Send to WhatsApp
                await wppConnect.sendTextMessage(session, originalFrom, cachedResponse);
                return NextResponse.json({ success: true });
            }

            // ==========================================
            // TOKEN OPTIMIZATION: Adaptive Context
            // ==========================================
            // Detectar se é FAQ simples para reduzir contexto
            const isFAQ = /^(oi|olá|qual|quem|onde|como|quando|horário|preço|valor|quanto|nome|empresa)/i.test(contentForAI);
            const historyLimit = isFAQ ? 6 : 10; // FAQs precisam de menos contexto
            const trainingLimit = isFAQ ? 10 : 30; // FAQs precisam de menos treinamento

            // Get training data ONLY from this agent (which belongs to this company)
            // Use cache to avoid hitting DB on every message (TTL: 30 min)
            const trainingData = await cacheTrainingData(
                agent.id,
                async () => prisma.trainingData.findMany({
                    where: { agentId: agent.id },
                    take: trainingLimit, // 👈 Adaptativo: 10 para FAQs, 30 para complexas
                })
            );

            const hasTrainingData = trainingData.length > 0;

            // Build context only from this company's training
            const context = hasTrainingData
                ? trainingData.map((td) => `[${td.type}] ${td.title}: ${td.content}`).join("\n\n")
                : "";

            // Get recent messages from THIS conversation only
            const recentMessages = await prisma.message.findMany({
                where: { conversationId: conversation.id },
                orderBy: { createdAt: "desc" },
                take: historyLimit, // 👈 Adaptativo: 6 para FAQs, 10 para complexas
            });

            const chatMessages = recentMessages
                .reverse()
                .map((msg) => ({
                    role: msg.sender === "CUSTOMER" ? "user" as const : "assistant" as const,
                    content: msg.content,
                }));
            try {
                // Build RESTRICTIVE prompt with customer memory
                const customerMemory = await getCustomerMemory(companyId, customerPhone);
                const memoryContext = formatMemoryForPrompt(customerMemory);

                const systemPrompt = buildPromptWithMemory(
                    agent.personality,
                    company.name,
                    company.niche,
                    company.description,
                    hasTrainingData,
                    memoryContext,
                    // Contexto temporal para adaptar tom da resposta
                    {
                        minutesSinceLastMessage,
                        isReturningCustomer,
                        customerName: conversation.customerName || undefined,
                    }
                );

                logger.ai("Generating response with functions", {
                    conversationId: conversation.id,
                    hasTraining: hasTrainingData,
                    agentId: agent.id
                });

                const aiResult = await generateAIResponseWithFunctions({
                    systemPrompt,
                    messages: chatMessages,
                    context,
                    maxTokens: 500,
                    temperature: 0.5,
                    functionContext: {
                        companyId,
                        conversationId: conversation.id,
                        agentId: agent.id,
                    },
                });

                if (aiResult.response) {
                    // Log function calls if any
                    if (aiResult.functionsCalled.length > 0) {
                        logger.ai("Functions executed", {
                            conversationId: conversation.id,
                            functions: aiResult.functionsCalled,
                            wasTransferred: aiResult.wasTransferred,
                        });
                    }

                    logger.ai("Response generated", {
                        conversationId: conversation.id,
                        tokens: aiResult.inputTokens + aiResult.outputTokens
                    });

                    const aiMessage = await prisma.message.create({
                        data: {
                            conversationId: conversation.id,
                            type: "TEXT",
                            content: aiResult.response,
                            sender: "AI",
                        },
                    });

                    // Emit resposta da IA via WebSocket
                    emitSocketMessage(conversation.id, companyId, {
                        id: aiMessage.id,
                        content: aiMessage.content,
                        type: aiMessage.type,
                        sender: "AI",
                        createdAt: aiMessage.createdAt.toISOString(),
                        mediaUrl: null,
                    });

                    logger.whatsapp("Sending AI response", { to: originalFrom });

                    // Smart audio detection - only use audio when appropriate
                    const audioDecision = shouldRespondWithAudio(
                        messageType,
                        messageBody,
                        agent.voiceEnabled
                    );

                    logger.whatsapp("TTS Audio decision", audioDecision);

                    // Send as audio or text based on smart detection
                    if (audioDecision.shouldUseAudio && aiResult.response.length <= 4096) {
                        try {
                            logger.whatsapp(`Sending audio response (${audioDecision.reason})`);

                            // Generate speech from AI response
                            const audioBuffer = await generateSpeech({
                                text: aiResult.response,
                                voice: (agent.voiceId as TTSVoice) || "nova",
                                model: "tts-1",
                            });

                            // Convert to base64 for sending
                            const audioBase64 = audioToBase64(audioBuffer);

                            // Send audio message
                            const audioSent = await wppConnect.sendAudioMessage(session, originalFrom, audioBase64);
                            logger.whatsapp("Voice message sent", { success: audioSent, reason: audioDecision.reason });

                            // Update message type to AUDIO for panel indicator
                            if (audioSent) {
                                await prisma.message.update({
                                    where: { id: aiMessage.id },
                                    data: { type: "AUDIO" }
                                });
                            }

                            // If audio failed, fall back to text
                            if (!audioSent) {
                                logger.whatsapp("Audio sending failed, falling back to text");
                                const textSent = await wppConnect.sendTextMessage(session, originalFrom, aiResult.response);
                                logger.whatsapp("Fallback text message sent", { success: textSent });
                            }
                        } catch (ttsError) {
                            logger.error("[TTS] Error generating speech, falling back to text", { error: ttsError });
                            // Fallback to text if TTS fails
                            const sent = await wppConnect.sendTextMessage(session, originalFrom, aiResult.response);
                            logger.whatsapp("Fallback text message sent", { success: sent });
                        }
                    } else {
                        // Send regular text message
                        const sent = await wppConnect.sendTextMessage(session, originalFrom, aiResult.response);
                        logger.whatsapp("Message sent", { success: sent });
                    }

                    // Se a IA decidiu enviar um arquivo (ex: cardápio), enviar via WhatsApp
                    if (aiResult.fileToSend) {
                        try {
                            logger.info("[Webhook] Sending file to customer", {
                                fileUrl: aiResult.fileToSend.url,
                                fileName: aiResult.fileToSend.fileName,
                                customerPhone: originalFrom,
                            });

                            await wppConnect.sendFile(
                                session,
                                originalFrom,
                                aiResult.fileToSend.url,
                                aiResult.fileToSend.fileName
                            );

                            logger.info("[Webhook] File sent successfully");
                        } catch (fileError) {
                            logger.error("[Webhook] Failed to send file", { error: fileError });
                            // Não falhar a resposta inteira por causa do erro de arquivo
                        }
                    }

                    // Enviar imagens de produtos (múltiplas) se houver
                    if (aiResult.productImagesToSend && aiResult.productImagesToSend.length > 0) {
                        logger.info(`[Webhook] Sending ${aiResult.productImagesToSend.length} product images`, {
                            customerPhone: originalFrom,
                            products: aiResult.productImagesToSend.map(p => p.productName),
                        });

                        for (const productImage of aiResult.productImagesToSend) {
                            try {
                                await wppConnect.sendFile(
                                    session,
                                    originalFrom,
                                    productImage.url,
                                    productImage.fileName
                                );
                                logger.info(`[Webhook] Product image sent: ${productImage.productName}`);

                                // Pequeno delay entre imagens
                                if (aiResult.productImagesToSend!.length > 1) {
                                    await new Promise(resolve => setTimeout(resolve, 500));
                                }
                            } catch (imgError) {
                                logger.error(`[Webhook] Failed to send product image: ${productImage.productName}`, {
                                    error: imgError,
                                    url: productImage.url,
                                });
                            }
                        }
                    }

                    // Track token usage for THIS company only
                    const currentMonth = new Date();
                    currentMonth.setDate(1);
                    currentMonth.setHours(0, 0, 0, 0);

                    await prisma.tokenUsage.upsert({
                        where: {
                            companyId_month: {
                                companyId,
                                month: currentMonth,
                            },
                        },
                        update: {
                            inputTokens: { increment: aiResult.inputTokens },
                            outputTokens: { increment: aiResult.outputTokens },
                        },
                        create: {
                            companyId,
                            month: currentMonth,
                            inputTokens: aiResult.inputTokens,
                            outputTokens: aiResult.outputTokens,
                        },
                    });

                    // Cache the response for future similar questions
                    await setCachedResponse(companyId, contentForAI, aiResult.response);

                    // Update customer memory
                    try {
                        const messagesForMemory = chatMessages.slice(-5); // Last 5 messages
                        messagesForMemory.push({ role: "assistant" as const, content: aiResult.response });

                        const summary = await generateConversationSummary(messagesForMemory);
                        await updateCustomerMemory(
                            companyId,
                            customerPhone,
                            summary,
                            messagesForMemory.length
                        );
                        logger.debug("CustomerMemory updated", { phone: customerPhone.slice(-4) });
                    } catch (memError) {
                        logger.error("[CustomerMemory] Failed to update", { error: memError });
                    }
                }
            } catch (error) {
                logger.error("[Webhook] Error generating AI response", { error });
            }
        }

        return NextResponse.json({ success: true });
    } catch (error) {
        logger.error("[Webhook] Error processing message", { error });
        return NextResponse.json({ success: false, error: "Internal error" }, { status: 500 });
    }
}

export async function GET() {
    return NextResponse.json({ status: "Webhook active" });
}
