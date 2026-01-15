/**
 * Message Variation Generator
 * Uses OpenAI to create multiple variations of a message
 * for anti-ban protection in mass messaging
 */

import OpenAI from "openai";

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});

/**
 * Generates multiple variations of a message using AI
 * Each variation preserves the core meaning but uses different wording
 */
export async function generateMessageVariations(
    originalMessage: string,
    companyName: string,
    numberOfVariations: number = 10
): Promise<string[]> {
    try {
        const response = await openai.chat.completions.create({
            model: "gpt-4o-mini",
            messages: [
                {
                    role: "system",
                    content: `Você é um especialista em comunicação via WhatsApp.
Sua tarefa é criar ${numberOfVariations} variações de uma mensagem promocional.

REGRAS:
1. Preserve o SIGNIFICADO e INFORMAÇÕES principais
2. VARIE: estrutura, ordem das palavras, emojis, estilo
3. Mantenha o tom informal mas profissional
4. Use português brasileiro natural
5. Cada variação deve parecer escrita por uma pessoa diferente
6. NUNCA use textos idênticos
7. Mantenha as variações curtas (máx 300 caracteres)
8. Use emojis variados mas com moderação

Empresa: ${companyName}

Retorne APENAS um JSON array com as variações, sem explicações.
Formato: ["variação 1", "variação 2", ...]`
                },
                {
                    role: "user",
                    content: `Mensagem original:\n"${originalMessage}"\n\nGere ${numberOfVariations} variações diferentes desta mensagem.`
                }
            ],
            temperature: 0.9, // Alta criatividade para variações
            max_tokens: 2000,
        });

        const content = response.choices[0]?.message?.content || "[]";

        // Parse JSON response
        try {
            // Clean up the response (remove markdown code blocks if present)
            const cleanContent = content
                .replace(/```json\n?/g, "")
                .replace(/```\n?/g, "")
                .trim();

            const variations = JSON.parse(cleanContent) as string[];

            // Ensure we have the original message as first variation
            if (!variations.includes(originalMessage)) {
                variations.unshift(originalMessage);
            }

            return variations.slice(0, numberOfVariations + 1);
        } catch {
            console.error("[MessageVariations] Failed to parse AI response:", content);
            // Return original message as fallback
            return [originalMessage];
        }
    } catch (error) {
        console.error("[MessageVariations] OpenAI API error:", error);
        return [originalMessage];
    }
}

/**
 * Get a random variation from the list
 */
export function getRandomVariation(variations: string[]): { message: string; index: number } {
    if (!variations || variations.length === 0) {
        return { message: "", index: 0 };
    }

    const index = Math.floor(Math.random() * variations.length);
    return { message: variations[index], index };
}

/**
 * Calculate delay between messages (anti-ban)
 */
export function calculateDelay(settings: {
    minDelay?: number;
    maxDelay?: number;
    sentCount?: number;
    pauseEvery?: number;
    pauseDuration?: number;
}): number {
    const minDelay = settings.minDelay || 8;
    const maxDelay = settings.maxDelay || 30;
    const pauseEvery = settings.pauseEvery || 15;
    const pauseDuration = settings.pauseDuration || 60;

    // Check if we need a longer pause
    if (settings.sentCount && settings.sentCount > 0 && settings.sentCount % pauseEvery === 0) {
        return pauseDuration * 1000; // Return pause duration in ms
    }

    // Random delay between min and max
    const delay = Math.floor(Math.random() * (maxDelay - minDelay + 1)) + minDelay;

    // Add small random variation (±3 seconds)
    const variation = Math.floor(Math.random() * 7) - 3;

    return Math.max(minDelay, delay + variation) * 1000; // Return in ms
}

/**
 * Simulate typing time based on message length
 */
export function calculateTypingTime(message: string): number {
    // Average typing speed: ~10 chars per second (faster than real human)
    const charsPerSecond = 10;
    const minTime = 2000; // Minimum 2 seconds
    const maxTime = 8000; // Maximum 8 seconds

    const calculatedTime = (message.length / charsPerSecond) * 1000;

    return Math.min(maxTime, Math.max(minTime, calculatedTime));
}

/**
 * Check if message contains opt-out keywords
 */
export function checkOptOut(message: string): boolean {
    const optOutKeywords = [
        "parar",
        "pare",
        "sair",
        "remover",
        "remova",
        "stop",
        "cancelar",
        "cancela",
        "não quero",
        "nao quero",
        "não quero mais",
        "nao quero mais",
        "me remove",
        "me tira",
        "desinscrever",
        "unsubscribe"
    ];

    const lowerMessage = message.toLowerCase().trim();

    return optOutKeywords.some(keyword => lowerMessage.includes(keyword));
}
