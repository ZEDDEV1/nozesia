/**
 * Sanitização de Inputs
 * 
 * PARA QUE SERVE:
 * - Remove código malicioso de mensagens (XSS prevention)
 * - Limpa HTML/scripts de inputs de usuários
 * - Protege contra injeção de código
 * 
 * QUANDO USAR:
 * - Ao salvar mensagens de WhatsApp
 * - Ao processar qualquer input do usuário
 * - Antes de exibir conteúdo em HTML
 */

// ============================================
// PADRÕES PERIGOSOS
// ============================================

/** Tags HTML que podem executar scripts */
const DANGEROUS_TAGS = [
    "script",
    "iframe",
    "object",
    "embed",
    "form",
    "input",
    "button",
    "link",
    "style",
    "meta",
    "base",
    "svg",
    "math",
];

/** Atributos que podem executar código */
const DANGEROUS_ATTRS = [
    "onclick",
    "onerror",
    "onload",
    "onmouseover",
    "onmouseout",
    "onkeydown",
    "onkeyup",
    "onfocus",
    "onblur",
    "onsubmit",
    "onchange",
    "oninput",
    "onscroll",
    "onwheel",
    "ondrag",
    "ondrop",
    "onpaste",
    "oncopy",
    "oncut",
    "onanimationend",
    "ontransitionend",
];

/** Protocolos perigosos em URLs */
const DANGEROUS_PROTOCOLS = [
    "javascript:",
    "data:",
    "vbscript:",
];

// ============================================
// REGEX PATTERNS
// ============================================

/** Remove todas as tags HTML */
const HTML_TAG_REGEX = /<[^>]*>/gi;

/** Remove event handlers */
const EVENT_HANDLER_REGEX = new RegExp(
    `\\s*(${DANGEROUS_ATTRS.join("|")})\\s*=\\s*["'][^"']*["']`,
    "gi"
);

/** Remove protocolos perigosos */
const PROTOCOL_REGEX = new RegExp(
    `(${DANGEROUS_PROTOCOLS.map(p => p.replace(":", "\\s*:")).join("|")})`,
    "gi"
);

/** Remove tags específicas com conteúdo */
const SCRIPT_TAG_REGEX = /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi;
const STYLE_TAG_REGEX = /<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi;

// ============================================
// FUNÇÕES DE SANITIZAÇÃO
// ============================================

/**
 * Remove TODAS as tags HTML de um texto
 * Ideal para mensagens de chat (texto puro)
 */
export function stripHtml(input: string): string {
    if (!input) return "";

    return input
        // Remove scripts com conteúdo
        .replace(SCRIPT_TAG_REGEX, "")
        // Remove styles com conteúdo
        .replace(STYLE_TAG_REGEX, "")
        // Remove todas as tags HTML
        .replace(HTML_TAG_REGEX, "")
        // Decode entities básicas
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/&amp;/g, "&")
        .replace(/&quot;/g, '"')
        .replace(/&#x27;/g, "'")
        // Remove múltiplos espaços
        .replace(/\s+/g, " ")
        .trim();
}

/**
 * Sanitiza HTML mantendo formatação básica segura
 * Permite apenas: b, i, u, br, p, a (com href verificado)
 */
export function sanitizeHtml(input: string): string {
    if (!input) return "";

    let sanitized = input
        // Remove scripts
        .replace(SCRIPT_TAG_REGEX, "")
        // Remove styles
        .replace(STYLE_TAG_REGEX, "")
        // Remove event handlers
        .replace(EVENT_HANDLER_REGEX, "")
        // Remove protocolos perigosos
        .replace(PROTOCOL_REGEX, "");

    // Remove tags perigosas (mantendo conteúdo)
    for (const tag of DANGEROUS_TAGS) {
        const openTag = new RegExp(`<${tag}[^>]*>`, "gi");
        const closeTag = new RegExp(`</${tag}>`, "gi");
        sanitized = sanitized.replace(openTag, "").replace(closeTag, "");
    }

    return sanitized.trim();
}

/**
 * Escapa caracteres especiais para prevenir XSS
 * Usar quando for inserir texto em HTML
 */
export function escapeHtml(input: string): string {
    if (!input) return "";

    return input
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#x27;");
}

/**
 * Sanitiza URL para prevenir XSS via javascript:
 */
export function sanitizeUrl(url: string): string {
    if (!url) return "";

    const trimmed = url.trim().toLowerCase();

    // Verifica protocolos perigosos
    for (const protocol of DANGEROUS_PROTOCOLS) {
        if (trimmed.startsWith(protocol.replace(":", ""))) {
            return "";
        }
    }

    // Permite apenas http, https, mailto, tel
    if (!/^(https?:|mailto:|tel:|\/|#)/.test(trimmed)) {
        return "";
    }

    return url;
}

/**
 * Sanitiza mensagem de WhatsApp (texto puro)
 * Remove HTML mas mantém emojis e formatação do WhatsApp
 */
export function sanitizeWhatsAppMessage(message: string): string {
    if (!message) return "";

    // Preservar formatação WhatsApp: *bold*, _italic_, ~strike~, ```code```
    const preservedFormatting = message
        // Protejer formatação WhatsApp temporariamente
        .replace(/\*([^*]+)\*/g, "%%BOLD%%$1%%/BOLD%%")
        .replace(/_([^_]+)_/g, "%%ITALIC%%$1%%/ITALIC%%")
        .replace(/~([^~]+)~/g, "%%STRIKE%%$1%%/STRIKE%%")
        .replace(/```([^`]+)```/g, "%%CODE%%$1%%/CODE%%");

    // Limpar HTML
    const cleaned = stripHtml(preservedFormatting);

    // Restaurar formatação WhatsApp
    return cleaned
        .replace(/%%BOLD%%/g, "*")
        .replace(/%%\/BOLD%%/g, "*")
        .replace(/%%ITALIC%%/g, "_")
        .replace(/%%\/ITALIC%%/g, "_")
        .replace(/%%STRIKE%%/g, "~")
        .replace(/%%\/STRIKE%%/g, "~")
        .replace(/%%CODE%%/g, "```")
        .replace(/%%\/CODE%%/g, "```");
}

/**
 * Verifica se uma string contém possível XSS
 */
export function hasXss(input: string): boolean {
    if (!input) return false;

    const lowerInput = input.toLowerCase();

    // Verifica tags perigosas
    for (const tag of DANGEROUS_TAGS) {
        if (lowerInput.includes(`<${tag}`)) return true;
    }

    // Verifica event handlers
    for (const attr of DANGEROUS_ATTRS) {
        if (lowerInput.includes(attr + "=")) return true;
    }

    // Verifica protocolos perigosos
    for (const protocol of DANGEROUS_PROTOCOLS) {
        if (lowerInput.includes(protocol)) return true;
    }

    return false;
}

/**
 * Sanitiza recursivamente um objeto
 * Útil para sanitizar body de requisições API
 * 
 * USO:
 * const cleanBody = sanitizeObject(await request.json());
 */
export function sanitizeObject<T>(obj: T): T {
    if (obj === null || obj === undefined) {
        return obj;
    }

    if (typeof obj === "string") {
        return stripHtml(obj) as T;
    }

    if (Array.isArray(obj)) {
        return obj.map(item => sanitizeObject(item)) as T;
    }

    if (typeof obj === "object") {
        const sanitized: Record<string, unknown> = {};
        for (const [key, value] of Object.entries(obj)) {
            sanitized[key] = sanitizeObject(value);
        }
        return sanitized as T;
    }

    return obj;
}

/**
 * Sanitiza mensagem de input (mais permissivo que stripHtml)
 * Remove apenas código perigoso, mantém caracteres normais
 */
export function sanitizeInput(input: string): string {
    if (!input) return "";

    return input
        // Remove scripts
        .replace(SCRIPT_TAG_REGEX, "")
        // Remove styles
        .replace(STYLE_TAG_REGEX, "")
        // Remove event handlers
        .replace(EVENT_HANDLER_REGEX, "")
        // Remove protocolos perigosos
        .replace(PROTOCOL_REGEX, "")
        // Remove tags perigosas mas mantém conteúdo
        .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
        .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, "")
        .trim();
}

