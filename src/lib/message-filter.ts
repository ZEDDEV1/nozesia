/**
 * Trivial Message Filter
 * 
 * Filtra mensagens que não precisam de resposta da IA.
 * Economiza tokens ao não responder "ok", emojis soltos, etc.
 */

import { logger } from "./logger";

// Mensagens triviais que não precisam de resposta
const TRIVIAL_MESSAGES = new Set([
    // Confirmações
    "ok",
    "okay",
    "oks",
    "certo",
    "beleza",
    "blz",
    "tranquilo",
    "show",
    "top",
    "perfeito",
    "entendi",
    "entendido",
    "combinado",
    "fechado",
    "feito",
    "pronto",
    "sim",
    "ss",
    "sss",
    "s",
    "não",
    "nao",
    "n",
    "nn",
    "nops",
    "nope",

    // Agradecimentos
    "obrigado",
    "obrigada",
    "obg",
    "valeu",
    "vlw",
    "muito obrigado",
    "muito obrigada",
    "brigado",
    "brigada",
    "thanks",
    "thank you",

    // Despedidas
    "tchau",
    "bye",
    "até mais",
    "ate mais",
    "até logo",
    "ate logo",
    "flw",
    "falou",
    "abraço",
    "abracos",
    "bjs",
    "beijos",

    // Risadas
    "kkk",
    "kkkk",
    "kkkkk",
    "kkkkkk",
    "haha",
    "hahaha",
    "hahahaha",
    "rsrs",
    "rsrsrs",
    "rs",
    "lol",
    "kkj",
    "kk",

    // Palavras vazias
    "hmm",
    "hm",
    "uhum",
    "uh",
    "aa",
    "ah",
    "ahh",
    "aham",
    "ta",
    "tá",
    "é",
    "e",
    "?",
    "!",
    "...",
]);

// Padrões de emojis soltos
const EMOJI_ONLY_PATTERN = /^[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\s]+$/u;

// Padrões que indicam que precisa resposta
const NEEDS_RESPONSE_PATTERNS = [
    /\?$/,                    // Termina com interrogação
    /quanto/i,                // Pergunta de preço
    /preço/i,
    /valor/i,
    /tem /i,                  // Pergunta de disponibilidade
    /vocês tem/i,
    /voces tem/i,
    /pode/i,                  // Pergunta de possibilidade
    /como /i,                 // Pergunta de como fazer
    /onde/i,                  // Pergunta de localização
    /quando/i,                // Pergunta de tempo
    /qual/i,                  // Pergunta de escolha
    /quero/i,                 // Expressão de desejo
    /preciso/i,               // Expressão de necessidade
    /gostaria/i,              // Expressão de interesse
    /comprar/i,               // Intenção de compra
    /agendar/i,               // Intenção de agendamento
    /marcar/i,
    /problema/i,              // Reclamação/suporte
    /não funciona/i,
    /ajuda/i,
    /humano/i,                // Quer falar com humano
    /atendente/i,
    /pessoa/i,
];

export interface MessageFilterResult {
    shouldRespond: boolean;
    reason: "trivial" | "emoji_only" | "too_short" | "needs_response";
    autoResponse?: string;
}

/**
 * Analisa se uma mensagem precisa de resposta da IA
 */
export function shouldRespondToMessage(message: string): MessageFilterResult {
    const normalized = message.trim().toLowerCase();

    // Mensagem vazia
    if (!normalized) {
        return { shouldRespond: false, reason: "trivial" };
    }

    // Mensagem muito curta (1-2 caracteres que não seja "?")
    if (normalized.length <= 2 && normalized !== "?" && !normalized.includes("?")) {
        return { shouldRespond: false, reason: "too_short" };
    }

    // Verificar se contém padrões que precisam de resposta
    for (const pattern of NEEDS_RESPONSE_PATTERNS) {
        if (pattern.test(normalized)) {
            return { shouldRespond: true, reason: "needs_response" };
        }
    }

    // Verificar se é apenas emojis
    if (EMOJI_ONLY_PATTERN.test(message.trim())) {
        return {
            shouldRespond: false,
            reason: "emoji_only",
            autoResponse: "😊", // Resposta automática
        };
    }

    // Verificar se é mensagem trivial
    if (TRIVIAL_MESSAGES.has(normalized)) {
        return {
            shouldRespond: false,
            reason: "trivial",
            autoResponse: getAutoResponse(normalized),
        };
    }

    // Verificar padrões triviais com variações
    if (isTrivialPattern(normalized)) {
        return {
            shouldRespond: false,
            reason: "trivial",
            autoResponse: getAutoResponse(normalized),
        };
    }

    // Por padrão, responder
    return { shouldRespond: true, reason: "needs_response" };
}

/**
 * Verifica padrões triviais com variações
 */
function isTrivialPattern(message: string): boolean {
    // Múltiplos "k" (risadas)
    if (/^k+$/i.test(message)) return true;

    // Múltiplos "s" (sim)
    if (/^s+$/i.test(message)) return true;

    // Múltiplos "n" (não)
    if (/^n+$/i.test(message)) return true;

    // "ok" com variações
    if (/^o+k+$/i.test(message)) return true;

    // "ta" com variações
    if (/^t[aá]+$/i.test(message)) return true;

    // Apenas pontuação
    if (/^[.!?]+$/.test(message)) return true;

    return false;
}

/**
 * Gera resposta automática apropriada
 */
function getAutoResponse(message: string): string | undefined {
    // Agradecimentos
    if (message.includes("obrigad") || message.includes("valeu") || message.includes("vlw")) {
        return "Por nada! 😊";
    }

    // Despedidas
    if (message.includes("tchau") || message.includes("bye") || message.includes("flw")) {
        return "Até mais! 👋";
    }

    // Risadas - não precisa responder nada
    if (/^k+$/i.test(message) || message.includes("haha") || message.includes("rsrs")) {
        return undefined; // Não responde
    }

    // Confirmações - não precisa responder
    if (["ok", "certo", "beleza", "blz", "show", "top"].includes(message)) {
        return undefined; // Não responde
    }

    return undefined;
}

/**
 * Estatísticas para logging
 */
export function logMessageFilter(message: string, result: MessageFilterResult): void {
    if (!result.shouldRespond) {
        logger.debug("Message filtered", {
            reason: result.reason,
            hasAutoResponse: !!result.autoResponse,
            messageLength: message.length,
        });
    }
}
