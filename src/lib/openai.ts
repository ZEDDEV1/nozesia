import OpenAI from "openai";
import { getOpenAIModel } from "./settings";
import { retryOpenAI } from "./retry";
import { withOpenAICircuit } from "./circuit-breaker";

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});

export interface ChatMessage {
    role: "system" | "user" | "assistant";
    content: string;
}

export interface GenerateResponseOptions {
    systemPrompt: string;
    messages: ChatMessage[];
    context?: string;
    maxTokens?: number;
    temperature?: number;
    model?: string; // Allow override
}

// Get configured model from settings
async function getConfiguredModel(): Promise<string> {
    return await getOpenAIModel();
}

export async function generateAIResponse(options: GenerateResponseOptions): Promise<{
    response: string;
    inputTokens: number;
    outputTokens: number;
    model: string;
}> {
    const { systemPrompt, messages, context, maxTokens = 500, temperature = 0.7, model: overrideModel } = options;

    // Use override model if provided, otherwise get from settings
    const model = overrideModel || await getConfiguredModel();

    const systemMessage = context
        ? `${systemPrompt}\n\n### Contexto de Treinamento:\n${context}`
        : systemPrompt;

    // Usa Retry + Circuit Breaker para resiliência
    const completion = await withOpenAICircuit(() =>
        retryOpenAI(() =>
            openai.chat.completions.create({
                model,
                messages: [
                    { role: "system", content: systemMessage },
                    ...messages,
                ],
                max_tokens: maxTokens,
                temperature,
            })
        )
    );

    const response = completion.choices[0]?.message?.content || "";
    const usage = completion.usage;

    return {
        response,
        inputTokens: usage?.prompt_tokens || 0,
        outputTokens: usage?.completion_tokens || 0,
        model,
    };
}

// ============================================
// FUNCTION CALLING SUPPORT
// ============================================

import { AI_TOOLS, executeFunction, FunctionContext } from "./ai-functions";

export interface GenerateWithFunctionsOptions extends GenerateResponseOptions {
    functionContext: FunctionContext;
    enableFunctions?: boolean;
}

export interface FunctionCallResult {
    response: string;
    inputTokens: number;
    outputTokens: number;
    model: string;
    functionsCalled: string[];
    wasTransferred: boolean;
    fileToSend?: {
        url: string;
        fileName: string;
        documentTitle: string;
    };
}

/**
 * Generate AI response with function calling support
 * 
 * If the AI decides to call a function:
 * 1. Execute the function
 * 2. Send the result back to the AI
 * 3. Get the final response
 */
export async function generateAIResponseWithFunctions(
    options: GenerateWithFunctionsOptions
): Promise<FunctionCallResult> {
    const {
        systemPrompt,
        messages,
        context,
        maxTokens = 500,
        temperature = 0.7,
        model: overrideModel,
        functionContext,
        enableFunctions = true
    } = options;

    const model = overrideModel || await getConfiguredModel();
    const functionsCalled: string[] = [];
    let wasTransferred = false;
    let totalInputTokens = 0;
    let totalOutputTokens = 0;

    const systemMessage = context
        ? `${systemPrompt}\n\n### Contexto de Treinamento:\n${context}`
        : systemPrompt;

    // First API call with tools (Retry + Circuit Breaker)
    const completion = await withOpenAICircuit(() =>
        retryOpenAI(() =>
            openai.chat.completions.create({
                model,
                messages: [
                    { role: "system", content: systemMessage },
                    ...messages,
                ],
                max_tokens: maxTokens,
                temperature,
                ...(enableFunctions && { tools: AI_TOOLS, tool_choice: "auto" }),
            })
        )
    );

    totalInputTokens += completion.usage?.prompt_tokens || 0;
    totalOutputTokens += completion.usage?.completion_tokens || 0;

    const message = completion.choices[0]?.message;

    // If no function call, return the response directly
    if (!message?.tool_calls || message.tool_calls.length === 0) {
        return {
            response: message?.content || "",
            inputTokens: totalInputTokens,
            outputTokens: totalOutputTokens,
            model,
            functionsCalled: [],
            wasTransferred: false,
        };
    }

    // Process function calls
    const toolResults: Array<{ role: "tool"; tool_call_id: string; content: string }> = [];
    let fileToSend: { url: string; fileName: string; documentTitle: string } | undefined;

    for (const toolCall of message.tool_calls) {
        // Type assertion to access function property (OpenAI types have a union)
        const tc = toolCall as { id: string; function: { name: string; arguments: string } };
        const functionName = tc.function.name;
        functionsCalled.push(functionName);

        let args: Record<string, unknown> = {};
        try {
            args = JSON.parse(tc.function.arguments || "{}");
        } catch {
            args = {};
        }

        console.log(`[OpenAI] Executing function: ${functionName}`, args);

        const result = await executeFunction(functionName, args, functionContext);

        // Capturar dados de arquivo para envio
        if (functionName === "enviarDocumento" && result.success && result.data?.sendFile) {
            fileToSend = {
                url: result.data.fileUrl as string,
                fileName: result.data.fileName as string,
                documentTitle: result.data.documentTitle as string,
            };
            console.log("[OpenAI] fileToSend captured:", fileToSend);
        }

        // Capturar imagem de produto para envio
        if (functionName === "buscarProduto" && result.success && result.data?.sendProductImage) {
            fileToSend = {
                url: result.data.imageUrl as string,
                fileName: `${(result.data.productName as string || "produto").replace(/[^a-zA-Z0-9]/g, "_")}.jpg`,
                documentTitle: result.data.productName as string || "Produto",
            };
            console.log("[OpenAI] Product image captured for sending:", fileToSend);
        }

        if (functionName === "transferirParaHumano" && result.success) {
            wasTransferred = true;
        }

        // Preparar resultado para enviar à IA (sem expor URLs internas)
        let resultForAI = result;
        if (functionName === "enviarDocumento" && result.success && result.data) {
            // Criar cópia sem a URL para não aparecer na resposta
            resultForAI = {
                ...result,
                message: `Documento "${result.data.documentTitle}" está sendo enviado como anexo. NÃO inclua links ou URLs na sua resposta - o arquivo será enviado separadamente.`,
                data: {
                    sendFile: true,
                    documentTitle: result.data.documentTitle,
                    // Não incluir fileUrl aqui para a IA não expor
                },
            };
        }

        // Preparar resultado de buscarProduto para a IA (sem expor URLs)
        if (functionName === "buscarProduto" && result.success && result.data?.imageUrl) {
            resultForAI = {
                ...result,
                message: result.message + "\n\n[A imagem do produto está sendo enviada automaticamente - NÃO inclua links na sua resposta]",
                data: {
                    ...result.data,
                    imageUrl: undefined, // Não expor URL para a IA
                    sendProductImage: undefined,
                },
            };
        }

        toolResults.push({
            role: "tool",
            tool_call_id: toolCall.id,
            content: JSON.stringify(resultForAI),
        });
    }

    // Second API call with function results (Retry + Circuit Breaker)
    const followUp = await withOpenAICircuit(() =>
        retryOpenAI(() =>
            openai.chat.completions.create({
                model,
                messages: [
                    { role: "system", content: systemMessage },
                    ...messages,
                    message as OpenAI.ChatCompletionMessageParam, // Include the assistant's tool_calls message
                    ...toolResults,
                ],
                max_tokens: maxTokens,
                temperature,
            })
        )
    );

    totalInputTokens += followUp.usage?.prompt_tokens || 0;
    totalOutputTokens += followUp.usage?.completion_tokens || 0;

    const finalResponse = followUp.choices[0]?.message?.content || "";

    return {
        response: finalResponse,
        inputTokens: totalInputTokens,
        outputTokens: totalOutputTokens,
        model,
        functionsCalled,
        wasTransferred,
        fileToSend,
    };
}

export async function transcribeAudio(audioBuffer: Buffer): Promise<string> {
    const blob = new Blob([new Uint8Array(audioBuffer)], { type: "audio/ogg" });
    const file = new File([blob], "audio.ogg", { type: "audio/ogg" });

    const transcription = await openai.audio.transcriptions.create({
        file,
        model: "whisper-1",
        language: "pt",
    });

    return transcription.text;
}

export type TTSVoice = "alloy" | "echo" | "fable" | "onyx" | "nova" | "shimmer";
export type TTSModel = "tts-1" | "tts-1-hd";

interface GenerateSpeechOptions {
    text: string;
    voice?: TTSVoice;
    model?: TTSModel;
    speed?: number; // 0.25 to 4.0
}

/**
 * Generates speech audio from text using OpenAI TTS
 * Returns MP3 buffer that can be converted to base64 for sending
 */
export async function generateSpeech(options: GenerateSpeechOptions | string): Promise<Buffer> {
    // Support simple string for backwards compatibility
    const opts = typeof options === "string"
        ? { text: options }
        : options;

    const { text, voice = "nova", model = "tts-1", speed = 1.0 } = opts;

    console.log("[TTS] Generating speech:", { voice, model, textLength: text.length });

    const mp3 = await openai.audio.speech.create({
        model,
        voice,
        input: text,
        speed,
    });

    const arrayBuffer = await mp3.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    console.log("[TTS] Speech generated, size:", buffer.length);

    return buffer;
}

/**
 * Converts audio buffer to base64 for sending via WhatsApp
 */
export function audioToBase64(buffer: Buffer): string {
    return `data:audio/mp3;base64,${buffer.toString("base64")}`;
}

// Export current model getter for use elsewhere
export { getConfiguredModel };

// ============================================
// VISION AI - Image Analysis
// ============================================

export interface ImageAnalysisResult {
    description: string;
    type: "product" | "receipt" | "screenshot" | "document" | "photo" | "other";
    details: {
        isPIXReceipt?: boolean;
        pixValue?: string;
        pixDate?: string;
        isProductImage?: boolean;
        productDescription?: string;
        isError?: boolean;
        errorDescription?: string;
    };
    inputTokens: number;
    outputTokens: number;
}

/**
 * Analyzes an image using GPT-4 Vision
 * @param imageBase64 - Base64 encoded image (with or without data: prefix)
 * @param context - Optional business context for better analysis
 */
export async function analyzeImage(
    imageBase64: string,
    context?: string
): Promise<ImageAnalysisResult> {
    // Ensure proper base64 format
    let imageUrl: string;
    if (imageBase64.startsWith("data:")) {
        imageUrl = imageBase64;
    } else {
        // Assume JPEG if no prefix (most common)
        imageUrl = `data:image/jpeg;base64,${imageBase64}`;
    }

    const systemPrompt = `Você é um assistente de análise de imagens especializado em atendimento ao cliente.
Analise a imagem enviada e forneça uma descrição detalhada e útil.

${context ? `Contexto do negócio: ${context}` : ""}

Identifique:
1. Se é um comprovante de PIX/pagamento - extraia valor e data se possível
2. Se é uma foto de produto - descreva o produto
3. Se é um screenshot de erro - descreva o problema
4. Se é um documento - descreva o conteúdo
5. Qualquer outra imagem - descreva de forma útil

Responda em formato JSON:
{
    "description": "descrição clara e concisa da imagem",
    "type": "product|receipt|screenshot|document|photo|other",
    "details": {
        "isPIXReceipt": true/false,
        "pixValue": "R$ XX,XX" ou null,
        "pixDate": "DD/MM/YYYY" ou null,
        "isProductImage": true/false,
        "productDescription": "descrição do produto" ou null,
        "isError": true/false,
        "errorDescription": "descrição do erro" ou null
    }
}`;

    try {
        const response = await openai.chat.completions.create({
            model: "gpt-4o", // Vision enabled model
            messages: [
                {
                    role: "system",
                    content: systemPrompt,
                },
                {
                    role: "user",
                    content: [
                        {
                            type: "image_url",
                            image_url: {
                                url: imageUrl,
                                detail: "auto", // Let the model decide detail level
                            },
                        },
                        {
                            type: "text",
                            text: "Analise esta imagem e forneça os detalhes em JSON.",
                        },
                    ],
                },
            ],
            max_tokens: 500,
            temperature: 0.3, // Lower for more consistent analysis
        });

        const content = response.choices[0]?.message?.content || "{}";
        const usage = response.usage;

        // Parse the JSON response
        let parsed;
        try {
            // Try to extract JSON from the response
            const jsonMatch = content.match(/\{[\s\S]*\}/);
            parsed = jsonMatch ? JSON.parse(jsonMatch[0]) : {};
        } catch {
            // If JSON parsing fails, create basic response
            parsed = {
                description: content,
                type: "other",
                details: {},
            };
        }

        return {
            description: parsed.description || "Imagem analisada",
            type: parsed.type || "other",
            details: parsed.details || {},
            inputTokens: usage?.prompt_tokens || 0,
            outputTokens: usage?.completion_tokens || 0,
        };
    } catch (error) {
        console.error("[Vision AI] Error analyzing image:", error);
        return {
            description: "Não foi possível analisar a imagem",
            type: "other",
            details: {},
            inputTokens: 0,
            outputTokens: 0,
        };
    }
}

/**
 * Quick image description without full analysis
 * Faster and cheaper for simple use cases
 */
export async function describeImage(imageBase64: string): Promise<string> {
    const result = await analyzeImage(imageBase64);
    return result.description;
}

export default openai;
