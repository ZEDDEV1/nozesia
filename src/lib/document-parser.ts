/**
 * Document Parser - PDF e DOCX
 * 
 * PARA QUE SERVE:
 * - Extrair texto de arquivos PDF
 * - Extrair texto de arquivos DOCX
 * - Processar documentos para treinamento de IA
 * 
 * DEPENDÊNCIAS:
 * - pdf-parse (PDF)
 * - mammoth (DOCX)
 * 
 * INSTALAR:
 * npm install pdf-parse mammoth
 */

import { logger } from "./logger";

/**
 * Resultado da extração de texto
 */
export interface DocumentParseResult {
    success: boolean;
    text?: string;
    pageCount?: number;
    wordCount?: number;
    error?: string;
}

/**
 * Extrai texto de arquivo PDF usando pdf2json
 * 
 * pdf2json é compatível com Node.js server-side
 */
export async function parsePDF(buffer: Buffer): Promise<DocumentParseResult> {
    try {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const PDFParser = require("pdf2json");

        return new Promise((resolve) => {
            const pdfParser = new PDFParser();

            pdfParser.on("pdfParser_dataError", (errData: { parserError: Error }) => {
                logger.error("[DocumentParser] Failed to parse PDF", { error: errData.parserError });
                resolve({
                    success: false,
                    error: errData.parserError?.message || "Erro ao processar PDF",
                });
            });

            pdfParser.on("pdfParser_dataReady", (pdfData: { Pages: Array<{ Texts: Array<{ R: Array<{ T: string }> }> }> }) => {
                try {
                    // Extrair texto de todas as páginas
                    let text = "";
                    const pageCount = pdfData.Pages?.length || 0;

                    for (const page of pdfData.Pages || []) {
                        for (const textItem of page.Texts || []) {
                            for (const run of textItem.R || []) {
                                // Decodificar o texto URL-encoded
                                text += decodeURIComponent(run.T) + " ";
                            }
                        }
                        text += "\n";
                    }

                    text = text.trim();
                    const wordCount = text.split(/\s+/).filter(Boolean).length;

                    logger.info("[DocumentParser] PDF parsed successfully", {
                        pages: pageCount,
                        words: wordCount,
                    });

                    resolve({
                        success: true,
                        text,
                        pageCount,
                        wordCount,
                    });
                } catch (error) {
                    resolve({
                        success: false,
                        error: error instanceof Error ? error.message : "Erro ao processar PDF",
                    });
                }
            });

            // Parsear o buffer
            pdfParser.parseBuffer(buffer);
        });
    } catch (error) {
        logger.error("[DocumentParser] Failed to parse PDF", { error });
        return {
            success: false,
            error: error instanceof Error ? error.message : "Erro ao processar PDF",
        };
    }
}

/**
 * Extrai texto de arquivo DOCX
 */
export async function parseDOCX(buffer: Buffer): Promise<DocumentParseResult> {
    try {
        // Import dinâmico para evitar erro se não instalado
        const mammoth = await import("mammoth");

        const result = await mammoth.extractRawText({ buffer });

        const text = result.value.trim();
        const wordCount = text.split(/\s+/).filter(Boolean).length;

        logger.info("[DocumentParser] DOCX parsed successfully", {
            words: wordCount,
        });

        return {
            success: true,
            text,
            wordCount,
        };
    } catch (error) {
        logger.error("[DocumentParser] Failed to parse DOCX", { error });
        return {
            success: false,
            error: error instanceof Error ? error.message : "Erro ao processar DOCX",
        };
    }
}

/**
 * Extrai texto de arquivo TXT
 */
export function parseTXT(buffer: Buffer): DocumentParseResult {
    try {
        const text = buffer.toString("utf-8").trim();
        const wordCount = text.split(/\s+/).filter(Boolean).length;

        return {
            success: true,
            text,
            wordCount,
        };
    } catch (error) {
        return {
            success: false,
            error: error instanceof Error ? error.message : "Erro ao processar TXT",
        };
    }
}

/**
 * Parse de documento baseado na extensão
 */
export async function parseDocument(
    buffer: Buffer,
    filename: string
): Promise<DocumentParseResult> {
    const extension = filename.split(".").pop()?.toLowerCase();

    switch (extension) {
        case "pdf":
            return parsePDF(buffer);

        case "docx":
            return parseDOCX(buffer);

        case "doc":
            return {
                success: false,
                error: "Formato .doc não suportado. Use .docx",
            };

        case "txt":
        case "md":
        case "csv":
            return parseTXT(buffer);

        default:
            return {
                success: false,
                error: `Formato .${extension} não suportado. Use PDF, DOCX ou TXT.`,
            };
    }
}

/**
 * Tipos de arquivo suportados
 */
export const SUPPORTED_EXTENSIONS = ["pdf", "docx", "txt", "md", "csv"];

/**
 * Verifica se extensão é suportada
 */
export function isSupportedExtension(filename: string): boolean {
    const ext = filename.split(".").pop()?.toLowerCase();
    return SUPPORTED_EXTENSIONS.includes(ext || "");
}

// ============================================
// PRODUCT EXTRACTION FROM DOCUMENTS
// ============================================

import OpenAI from "openai";

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});

/**
 * Produto extraído do documento
 */
export interface ExtractedProduct {
    name: string;
    description?: string;
    price: number;
    category?: string;
}

/**
 * Resultado da extração de produtos
 */
export interface ProductExtractionResult {
    success: boolean;
    products: ExtractedProduct[];
    message?: string;
    tokensUsed?: number;
}

/**
 * Extrai produtos de um texto usando GPT-4o
 * 
 * Analisa o texto do documento e identifica produtos/itens/serviços
 * com seus preços representativos e categorias
 * 
 * @param text - Texto do documento
 * @param niche - Nicho do negócio (opcional, ajuda a contextualizar)
 * @param maxProducts - Máximo de produtos a extrair (default: 100)
 */
export async function extractProductsFromText(
    text: string,
    niche?: string,
    maxProducts: number = 100
): Promise<ProductExtractionResult> {
    if (!text || text.length < 50) {
        return {
            success: false,
            products: [],
            message: "Texto muito curto para extração de produtos",
        };
    }

    // Limitar texto a ~8000 tokens (~32000 caracteres)
    const maxChars = 32000;
    const truncatedText = text.length > maxChars
        ? text.substring(0, maxChars) + "\n...[texto truncado]..."
        : text;

    const nicheContext = niche
        ? `Este documento é de um negócio do tipo: ${niche}.`
        : "";

    const systemPrompt = `Você é um especialista em extrair produtos, itens e serviços de documentos comerciais.

${nicheContext}

Sua tarefa é analisar o texto e extrair TODOS os produtos/itens/serviços que encontrar.

Para cada item, retorne:
- name: Nome do produto/serviço (limpe caracteres especiais)
- description: Descrição curta (se houver, máximo 100 caracteres)
- price: Preço em R$ como NUMBER (sem símbolos, use . como decimal)
- category: Categoria do produto (se identificável)

⚠️ REGRAS IMPORTANTES:
1. Preços podem estar em formatos como "R$ 45,00", "45.00", "45" - normalize para número decimal
2. Se não conseguir identificar preço, use 0
3. IGNORE textos que NÃO são produtos (endereços, horários, telefones, etc)
4. IGNORE cabeçalhos e títulos de seções
5. Retorne APENAS JSON válido, sem explicações
6. Máximo ${maxProducts} produtos

RESPONDA APENAS COM JSON no formato:
{
  "products": [
    { "name": "Nome do Produto", "description": "Descrição", "price": 45.00, "category": "Categoria" }
  ]
}`;

    try {
        logger.info("[ProductExtraction] Starting extraction", {
            textLength: text.length,
            niche,
        });

        const response = await openai.chat.completions.create({
            model: "gpt-4o",
            messages: [
                { role: "system", content: systemPrompt },
                { role: "user", content: `Extraia os produtos deste documento:\n\n${truncatedText}` },
            ],
            max_tokens: 4000,
            temperature: 0.2, // Baixa temperatura para respostas mais consistentes
            response_format: { type: "json_object" },
        });

        const content = response.choices[0]?.message?.content || "{}";
        const tokensUsed = response.usage?.total_tokens || 0;

        // Parse da resposta JSON
        let parsed: { products?: unknown[] };
        try {
            parsed = JSON.parse(content);
        } catch {
            logger.error("[ProductExtraction] Failed to parse JSON response", {
                content: content.substring(0, 200),
            });
            return {
                success: false,
                products: [],
                message: "Erro ao processar resposta da IA",
                tokensUsed,
            };
        }

        // Validar e limpar produtos
        const products: ExtractedProduct[] = [];

        if (Array.isArray(parsed.products)) {
            for (const item of parsed.products) {
                if (typeof item === "object" && item !== null) {
                    const prod = item as Record<string, unknown>;

                    // Validar campos obrigatórios
                    if (typeof prod.name === "string" && prod.name.trim()) {
                        const product: ExtractedProduct = {
                            name: prod.name.trim().substring(0, 200),
                            price: typeof prod.price === "number"
                                ? Math.max(0, prod.price)
                                : parseFloat(String(prod.price)) || 0,
                        };

                        if (typeof prod.description === "string" && prod.description.trim()) {
                            product.description = prod.description.trim().substring(0, 500);
                        }

                        if (typeof prod.category === "string" && prod.category.trim()) {
                            product.category = prod.category.trim().substring(0, 100);
                        }

                        products.push(product);
                    }
                }
            }
        }

        logger.info("[ProductExtraction] Extraction complete", {
            productsFound: products.length,
            tokensUsed,
        });

        return {
            success: true,
            products: products.slice(0, maxProducts),
            message: `${products.length} produtos extraídos`,
            tokensUsed,
        };
    } catch (error) {
        logger.error("[ProductExtraction] Error extracting products", { error });
        return {
            success: false,
            products: [],
            message: error instanceof Error ? error.message : "Erro ao extrair produtos",
        };
    }
}
