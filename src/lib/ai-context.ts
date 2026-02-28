/**
 * AI Context Management
 * 
 * Gerencia o contexto de conversas de forma inteligente:
 * - Summariza conversas longas
 * - Mantém contexto relevante sem estourar tokens
 * - Detecta intenção do cliente
 */

import { ChatMessage } from "./openai";
import openai from "./openai";

// ============================================
// CONSTANTS
// ============================================

const MAX_MESSAGES_BEFORE_SUMMARY = 8;
const MESSAGES_TO_KEEP_RECENT = 4;

// ============================================
// END OF CONVERSATION DETECTION
// ============================================

/**
 * Frases que indicam que o cliente quer finalizar a conversa
 * Ordenadas por especificidade (mais específicas primeiro)
 */
const END_OF_CONVERSATION_PHRASES = [
    // Despedidas explícitas
    "tchau", "até mais", "até logo", "até breve", "flw", "vlw flw",
    "adeus", "bye", "xau", "falou",

    // Agradecimentos de finalização
    "muito obrigado", "muito obrigada", "obrigado pela ajuda",
    "obrigada pela ajuda", "valeu pela ajuda", "agradeço muito",
    "ok obrigado", "ok obrigada", "beleza obrigado", "beleza obrigada",

    // Confirmações de término
    "era isso", "era só isso", "só isso mesmo", "era isso mesmo",
    "só isso", "é só isso", "era isso obrigado", "era isso obrigada",

    // Frases curtas de encerramento
    "valeu", "vlw", "blz vlw", "beleza vlw",
    "perfeito", "show", "top",

    // Períodos do dia sozinhos (indicam despedida)
    "bom dia", "boa tarde", "boa noite",
];

/**
 * Frases que PARECEM despedida mas NÃO são (evitar falso positivo)
 */
const NOT_END_PHRASES = [
    "ok, mas", "ok mas", "ok e", "ok,",
    "valeu, mas", "beleza, mas", "show, mas",
    "quero", "preciso", "gostaria", "quanto", "qual",
    "mais", "outro", "outra", "também", "ainda",
    "?", // Perguntas não são despedida
];

// ============================================
// TYPES
// ============================================

export interface ConversationContext {
    summary: string | null;
    recentMessages: ChatMessage[];
    detectedIntent: CustomerIntent | null;
    totalMessages: number;
}

export type CustomerIntent =
    | "COMPRAR"           // Quer comprar algo
    | "INFORMACAO"        // Quer informação sobre produto/serviço
    | "SUPORTE"           // Precisa de ajuda com problema
    | "RECLAMACAO"        // Está reclamando
    | "AGENDAMENTO"       // Quer agendar algo
    | "DUVIDA_PRECO"      // Perguntando sobre preço
    | "FALAR_HUMANO"      // Quer falar com humano
    | "URGENTE"           // Urgência (precisa rápido)
    | "FRUSTRADO"         // Cliente frustrado/irritado
    | "PRONTO_COMPRAR"    // Cliente decidido a comprar
    | "OUTRO";            // Outros

// Tipo de sentimento detectado na conversa
export type CustomerSentiment = "POSITIVO" | "NEGATIVO" | "NEUTRO" | "FRUSTRADO" | "URGENTE";

// Resultado completo da análise de intenção
export interface IntentAnalysis {
    intent: CustomerIntent;
    sentiment: CustomerSentiment;
    confidence: number;       // 0.0 a 1.0
    suggestedTone: string;    // Sugestão de tom para resposta
}

// ============================================
// SUMMARIZATION
// ============================================

/**
 * Summariza uma conversa longa em poucas frases
 */
export async function summarizeConversation(messages: ChatMessage[]): Promise<string> {
    if (messages.length < 3) {
        return "";
    }

    const conversationText = messages
        .map(m => `${m.role === "user" ? "Cliente" : "Atendente"}: ${m.content}`)
        .join("\n");

    try {
        const response = await openai.chat.completions.create({
            model: "gpt-4.1-mini",
            messages: [
                {
                    role: "system",
                    content: `Você é um assistente que resume conversas de atendimento.
Faça um resumo MUITO conciso (máximo 3 frases) destacando:
- O que o cliente quer/precisa
- O que já foi discutido/resolvido
- Qualquer informação importante (nome, produto, etc)

Responda APENAS com o resumo, sem introdução.`
                },
                {
                    role: "user",
                    content: `Resuma esta conversa:\n\n${conversationText}`
                }
            ],
            max_tokens: 100,
            temperature: 0.3,
        });

        return response.choices[0]?.message?.content || "";
    } catch (error) {
        console.error("[AI Context] Error summarizing:", error);
        return "";
    }
}

/**
 * Detecta a intenção principal do cliente
 */
export async function detectIntent(messages: ChatMessage[]): Promise<CustomerIntent> {
    if (messages.length === 0) return "OUTRO";

    // Usar apenas as últimas 3 mensagens do cliente
    const lastCustomerMessages = messages
        .filter(m => m.role === "user")
        .slice(-3)
        .map(m => m.content)
        .join("\n");

    if (!lastCustomerMessages) return "OUTRO";

    // Detecção por palavras-chave (rápido, sem API)
    const text = lastCustomerMessages.toLowerCase();

    if (text.includes("humano") || text.includes("atendente") || text.includes("pessoa")) {
        return "FALAR_HUMANO";
    }
    if (text.includes("reclamar") || text.includes("problema") || text.includes("não funciona")) {
        return "RECLAMACAO";
    }
    if (text.includes("preço") || text.includes("valor") || text.includes("quanto custa")) {
        return "DUVIDA_PRECO";
    }
    if (text.includes("comprar") || text.includes("quero") || text.includes("pedir")) {
        return "COMPRAR";
    }
    if (text.includes("agendar") || text.includes("horário") || text.includes("marcar")) {
        return "AGENDAMENTO";
    }
    if (text.includes("ajuda") || text.includes("como faço") || text.includes("suporte")) {
        return "SUPORTE";
    }

    return "INFORMACAO";
}

// ============================================
// ADVANCED INTENT DETECTION WITH AI
// ============================================

/**
 * Lista de nichos conhecidos para classificação
 */
export const KNOWN_NICHES = [
    "restaurante", "pizzaria", "hamburgueria", "lanchonete", "delivery",
    "loja", "ecommerce", "moda", "varejo", "roupa",
    "clinica", "saude", "medico", "dentista", "hospital", "odontologia", "odontologico",
    "advocacia", "juridico", "escritorio",
    "beleza", "estetica", "salao", "barbearia",
    "agencia", "marketing", "trafego", "publicidade",
    "imobiliaria", "imoveis", "corretor",
    "educacao", "curso", "escola", "aula",
    "tecnologia", "software", "ti", "sistema",
    "petshop", "veterinario", "pet",
    "academia", "fitness", "personal",
    "contabilidade", "contador",
] as const;

/**
 * Detecta intenção usando GPT-4o-mini para maior precisão
 * Inclui detecção de sentimento e tom sugerido
 */
export async function detectIntentWithAI(messages: ChatMessage[]): Promise<IntentAnalysis> {
    if (messages.length === 0) {
        return {
            intent: "OUTRO",
            sentiment: "NEUTRO",
            confidence: 0.5,
            suggestedTone: "neutro e profissional",
        };
    }

    // Usar últimas 5 mensagens para contexto
    const recentMessages = messages.slice(-5);
    const conversationText = recentMessages
        .map(m => `${m.role === "user" ? "Cliente" : "Atendente"}: ${m.content}`)
        .join("\n");

    try {
        const response = await openai.chat.completions.create({
            model: "gpt-4.1-mini",
            messages: [
                {
                    role: "system",
                    content: `Analise a conversa e retorne um JSON com:
{
  "intent": "COMPRAR" | "INFORMACAO" | "SUPORTE" | "RECLAMACAO" | "AGENDAMENTO" | "DUVIDA_PRECO" | "FALAR_HUMANO" | "URGENTE" | "FRUSTRADO" | "PRONTO_COMPRAR" | "OUTRO",
  "sentiment": "POSITIVO" | "NEGATIVO" | "NEUTRO" | "FRUSTRADO" | "URGENTE",
  "confidence": 0.0-1.0,
  "suggestedTone": "sugestão curta de tom para responder"
}

REGRAS:
- URGENTE: cliente usa palavras como "urgente", "rápido", "agora", "pra já"
- FRUSTRADO: cliente usa "absurdo", "péssimo", "não é possível", CAPS, !!!
- PRONTO_COMPRAR: cliente diz "quero", "vou levar", "pode mandar", "fecha"
- RECLAMACAO: está insatisfeito, reclamando de algo
- Analise ironia e sarcasmo (ex: "parabéns pelo péssimo atendimento")
- Retorne APENAS o JSON, sem markdown.`,
                },
                {
                    role: "user",
                    content: conversationText,
                },
            ],
            temperature: 0.2,
            max_tokens: 200,
            response_format: { type: "json_object" },
        });

        const result = response.choices[0]?.message?.content;
        if (!result) throw new Error("No response");

        const parsed = JSON.parse(result) as IntentAnalysis;
        return {
            intent: parsed.intent || "OUTRO",
            sentiment: parsed.sentiment || "NEUTRO",
            confidence: parsed.confidence || 0.5,
            suggestedTone: parsed.suggestedTone || "neutro e profissional",
        };
    } catch {
        // Fallback para detecção simples
        const fallbackIntent = await detectIntent(messages);
        return {
            intent: fallbackIntent,
            sentiment: "NEUTRO",
            confidence: 0.3,
            suggestedTone: "neutro e profissional",
        };
    }
}

/**
 * Detecta o nicho do negócio analisando o conteúdo de treinamento
 * Retorna o nicho mais provável
 */
export async function detectNicheFromTrainingData(trainingContent: string): Promise<string> {
    if (!trainingContent || trainingContent.length < 50) {
        return "outro";
    }

    // Truncar para não estourar tokens
    const truncatedContent = trainingContent.slice(0, 3000);

    try {
        const response = await openai.chat.completions.create({
            model: "gpt-4.1-mini",
            messages: [
                {
                    role: "system",
                    content: `Analise o conteúdo de treinamento e identifique o nicho do negócio.

Nichos possíveis:
- restaurante, pizzaria, hamburgueria, lanchonete
- loja, ecommerce, moda, varejo
- clinica, saude, dentista, hospital
- advocacia, juridico
- beleza, estetica, salao, barbearia
- agencia, marketing, trafego
- imobiliaria, imoveis
- educacao, curso, escola
- tecnologia, software, ti
- petshop, veterinario
- academia, fitness
- contabilidade
- outro

Retorne APENAS o nome do nicho em minúsculas, sem pontuação.
Se não conseguir identificar, retorne "outro".`,
                },
                {
                    role: "user",
                    content: truncatedContent,
                },
            ],
            temperature: 0.1,
            max_tokens: 50,
        });

        const result = response.choices[0]?.message?.content?.toLowerCase().trim();
        if (!result) return "outro";

        // Validar se é um nicho conhecido
        const validNiche = KNOWN_NICHES.find(n => result.includes(n));
        return validNiche || result.split(/\s/)[0] || "outro";
    } catch {
        return "outro";
    }
}

// ============================================
// MAIN FUNCTION
// ============================================

/**
 * Prepara o contexto otimizado para a IA
 * 
 * - Se conversa < 10 mensagens: usa todas
 * - Se conversa >= 10 mensagens: summariza antigas + mantém recentes
 */
export async function prepareConversationContext(
    allMessages: ChatMessage[]
): Promise<ConversationContext> {
    const totalMessages = allMessages.length;

    // Conversa curta: usar tudo
    if (totalMessages <= MAX_MESSAGES_BEFORE_SUMMARY) {
        return {
            summary: null,
            recentMessages: allMessages,
            detectedIntent: await detectIntent(allMessages),
            totalMessages,
        };
    }

    // Conversa longa: summarizar + manter recentes
    const oldMessages = allMessages.slice(0, -MESSAGES_TO_KEEP_RECENT);
    const recentMessages = allMessages.slice(-MESSAGES_TO_KEEP_RECENT);

    const summary = await summarizeConversation(oldMessages);
    const detectedIntent = await detectIntent(recentMessages);

    return {
        summary,
        recentMessages,
        detectedIntent,
        totalMessages,
    };
}

/**
 * Formata o contexto para o system prompt
 */
export function formatContextForPrompt(context: ConversationContext): string {
    if (!context.summary) {
        return "";
    }

    let formatted = `\n\n=== RESUMO DA CONVERSA ANTERIOR ===\n${context.summary}`;

    if (context.detectedIntent && context.detectedIntent !== "OUTRO") {
        formatted += `\n\nIntenção detectada: ${context.detectedIntent}`;
    }

    return formatted;
}

// ============================================
// END OF CONVERSATION DETECTION
// ============================================

/**
 * Detecta se a última mensagem do cliente indica fim de conversa
 * 
 * Lógica:
 * 1. Normaliza a mensagem (lowercase, remove acentos extras)
 * 2. Verifica se contém frases que NEGAM fim (evitar falso positivo)
 * 3. Verifica se contém frases que INDICAM fim de conversa
 * 4. Para frases curtas como "valeu", verifica se está sozinha
 * 
 * @param lastMessage - Última mensagem do cliente
 * @returns true se parece ser fim de conversa
 */
export function detectEndOfConversation(lastMessage: string): boolean {
    if (!lastMessage || lastMessage.length === 0) {
        return false;
    }

    // Normaliza a mensagem
    const text = lastMessage
        .toLowerCase()
        .trim()
        .replace(/[!.]+$/, "") // Remove pontuação final
        .trim();

    // Mensagens muito longas dificilmente são despedida
    if (text.length > 100) {
        return false;
    }

    // Verificar se contém frases que NEGAM fim de conversa
    for (const notEnd of NOT_END_PHRASES) {
        if (text.includes(notEnd)) {
            return false;
        }
    }

    // Verificar se contém frases de fim de conversa
    for (const endPhrase of END_OF_CONVERSATION_PHRASES) {
        // Para frases curtas (1-2 palavras), verificar se é a mensagem completa
        if (endPhrase.split(" ").length <= 2) {
            // Frases curtas devem estar sozinhas ou no início/fim
            if (
                text === endPhrase ||
                text.startsWith(endPhrase + " ") ||
                text.endsWith(" " + endPhrase)
            ) {
                return true;
            }
        } else {
            // Frases mais longas podem estar em qualquer lugar
            if (text.includes(endPhrase)) {
                return true;
            }
        }
    }

    // Padrões adicionais com regex
    // "obrigado/obrigada" sozinho ou com complemento breve
    if (/^(muito\s+)?obrigad[oa](\s+mesmo|\s+pela\s+ajuda)?$/i.test(text)) {
        return true;
    }

    // Só emojis de despedida
    if (/^[👋🙏😊✌️👍]+$/u.test(text)) {
        return true;
    }

    return false;
}

/**
 * Versão estendida que também retorna o tipo de despedida detectada
 * Útil para personalizar a resposta
 */
export type FarewellType = "THANKING" | "GOODBYE" | "CONFIRMATION" | "BRIEF" | null;

export function detectFarewellType(lastMessage: string): FarewellType {
    if (!detectEndOfConversation(lastMessage)) {
        return null;
    }

    const text = lastMessage.toLowerCase().trim();

    // Agradecimento
    if (/obrigad[oa]|agradeço|valeu pela|thanks/i.test(text)) {
        return "THANKING";
    }

    // Despedida explícita
    if (/tchau|até\s+(mais|logo|breve)|adeus|bye|flw|xau/i.test(text)) {
        return "GOODBYE";
    }

    // Confirmação de término
    if (/era\s+isso|só\s+isso|é\s+só/i.test(text)) {
        return "CONFIRMATION";
    }

    // Resposta breve ("valeu", "blz", "show")
    return "BRIEF";
}
