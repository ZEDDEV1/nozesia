/**
 * AI Functions - Function Calling
 * 
 * Funções que a IA pode chamar para executar ações:
 * - Buscar produtos/serviços
 * - Verificar disponibilidade
 * - Transferir para humano
 * - Agendar atendimento
 */

import { prisma } from "./prisma";
import { dispatchWebhook } from "./webhooks";
import { autoCreateOrUpdateDeal, moveDealToClosed } from "./crm-automation";

// Google Calendar removed - not applicable for clothing retail

// ============================================
// TYPES
// ============================================

export interface FunctionResult {
    success: boolean;
    message: string;
    data?: Record<string, unknown>;
}

export interface AIFunction {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
    execute: (args: Record<string, unknown>, context: FunctionContext) => Promise<FunctionResult>;
}

export interface FunctionContext {
    companyId: string;
    conversationId: string;
    agentId: string;
}

// ============================================
// FUNCTION DEFINITIONS (OpenAI Format)
// NozesIA - Exclusivo para Loja de Roupas
// ============================================

export const AI_TOOLS = [
    {
        type: "function" as const,
        function: {
            name: "buscarProduto",
            description: `Busca produtos no catálogo e ENVIA A FOTO automaticamente.

✅ SEMPRE USE esta função quando cliente:
- Perguntar sobre produto ("tem camiseta?", "vocês têm vestido?", "tem chapéu?")
- Quiser ver fotos ("manda foto", "quero ver", "mostra")
- Perguntar preço ("quanto é?", "qual o valor?")
- Pedir cor específica ("quero a azul", "tem em preto?")
- Pedir MAIS OPÇÕES ("tem outros?", "mais opções?", "quero ver mais")

📦 PRODUTOS: camiseta, camisa, blusa, vestido, saia, calça, bermuda, shorts, agasalho, casaco, jaqueta, moletom, boné, chapéu, cap, tênis

🔄 PARA "OUTROS MODELOS" ou "QUERO VER MAIS":
- Passe o MESMO termo de busca
- Passe os IDs dos produtos JÁ MOSTRADOS em 'produtosJaEnviados'
- A função vai retornar os PRÓXIMOS 10 produtos

Exemplos:
- "tem boné?" → buscarProduto(termo: "boné")
- "tem outros?" → buscarProduto(termo: "boné", produtosJaEnviados: ["id1", "id2", ...])
- "manda mais" → buscarProduto(termo: "[mesmo tipo]", produtosJaEnviados: [IDs anteriores])`,
            parameters: {
                type: "object",
                properties: {
                    termo: {
                        type: "string",
                        description: "Nome do produto: camiseta, blusa, vestido, calça, bermuda, agasalho, boné, chapéu, etc."
                    },
                    cor: {
                        type: "string",
                        description: "Cor específica se cliente mencionar: preto, branco, azul, vermelho, marrom, etc."
                    },
                    produtosJaEnviados: {
                        type: "array",
                        items: { type: "string" },
                        description: "IDs dos produtos já mostrados ao cliente. Use quando cliente pedir 'outros modelos' ou 'quero ver mais' para não repetir."
                    }
                },
                required: ["termo"]
            }
        }
    },
    {
        type: "function" as const,
        function: {
            name: "transferirParaHumano",
            description: `Transfere para atendente humano quando necessário.
            
Use quando:
- Cliente pede explicitamente para falar com alguém
- Reclamação ou problema com pedido
- Dúvida sobre troca/devolução específica
- Situação que você não consegue resolver`,
            parameters: {
                type: "object",
                properties: {
                    motivo: {
                        type: "string",
                        enum: ["SOLICITADO_CLIENTE", "RECLAMACAO", "TROCA_DEVOLUCAO", "PROBLEMA_PEDIDO"],
                        description: "Motivo da transferência"
                    },
                    resumo: {
                        type: "string",
                        description: "Breve resumo do que o cliente precisa"
                    }
                },
                required: ["motivo", "resumo"]
            }
        }
    },
    {
        type: "function" as const,
        function: {
            name: "registrarInteresse",
            description: `🔴 OBRIGATÓRIO: SEMPRE registre interesse do cliente em peças!

⚠️ VOCÊ DEVE CHAMAR ESTA FUNÇÃO quando cliente:
- "Gostei dessa blusa" → CHAMAR registrarInteresse()
- "Achei linda essa saia" → CHAMAR registrarInteresse()
- "Me interessa esse vestido" → CHAMAR registrarInteresse()
- Pergunta sobre uma peça específica várias vezes → CHAMAR registrarInteresse()

NÃO apenas fale sobre registrar - EXECUTE a função!`,
            parameters: {
                type: "object",
                properties: {
                    produto: {
                        type: "string",
                        description: "Peça de interesse (ex: 'Vestido Floral M')"
                    },
                    detalhes: {
                        type: "string",
                        description: "Tamanho, cor ou observações"
                    }
                },
                required: ["produto"]
            }
        }
    },
    {
        type: "function" as const,
        function: {
            name: "processarVenda",
            description: `🔴 OBRIGATÓRIO: SEMPRE processe a venda quando cliente confirmar compra!

⚠️ VOCÊ DEVE CHAMAR ESTA FUNÇÃO quando cliente disser:
- "Quero" → CHAMAR processarVenda()
- "Vou levar" → CHAMAR processarVenda()
- "Fecha" → CHAMAR processarVenda()
- "Pode fazer" → CHAMAR processarVenda()
- "Quero comprar" → CHAMAR processarVenda()
- "Sim" (confirmando compra) → CHAMAR processarVenda()

⚠️ IMPORTANTE:
- Pergunte se é entrega ou retirada na loja
- Se não souber o preço, use buscarProduto() primeiro
- NÃO apenas fale sobre registrar pedido - EXECUTE a função!`,
            parameters: {
                type: "object",
                properties: {
                    produto: {
                        type: "string",
                        description: "Nome da peça (ex: 'Camiseta Preta M')"
                    },
                    preco: {
                        type: "number",
                        description: "Preço da peça em reais"
                    },
                    quantidade: {
                        type: "number",
                        description: "Quantidade (padrão: 1)"
                    },
                    tamanho: {
                        type: "string",
                        description: "Tamanho: P, M, G, GG ou número"
                    },
                    cor: {
                        type: "string",
                        description: "Cor da peça"
                    }
                },
                required: ["produto"]
            }
        }
    },
    {
        type: "function" as const,
        function: {
            name: "solicitarOrcamento",
            description: `Informa preço de uma peça quando cliente pergunta valor.

Use quando cliente perguntar:
- "Quanto custa essa blusa?"
- "Qual o valor?"
- "Preço da calça?"
- "Quanto fica?"`,
            parameters: {
                type: "object",
                properties: {
                    produto: {
                        type: "string",
                        description: "Peça para orçamento"
                    },
                    quantidade: {
                        type: "number",
                        description: "Quantidade desejada"
                    }
                },
                required: ["produto"]
            }
        }
    },
    {
        type: "function" as const,
        function: {
            name: "capturarLead",
            description: `Captura dados do cliente quando ele fornecer.

Use quando cliente disser:
- "Meu nome é..."
- "Me chamo..."
- "Meu email é..."`,
            parameters: {
                type: "object",
                properties: {
                    nome: {
                        type: "string",
                        description: "Nome do cliente"
                    },
                    email: {
                        type: "string",
                        description: "Email do cliente"
                    },
                    interesse: {
                        type: "string",
                        description: "Peça de interesse"
                    }
                },
                required: ["nome"]
            }
        }
    },
    {
        type: "function" as const,
        function: {
            name: "enviarDocumento",
            description: `Envia catálogo de roupas quando cliente pedir.

Use quando cliente pedir:
- "Manda o catálogo"
- "Quero ver as peças"
- "Tem tabela de preços?"`,
            parameters: {
                type: "object",
                properties: {
                    tipoDocumento: {
                        type: "string",
                        enum: ["catalogo", "tabela_precos"],
                        description: "Tipo de documento"
                    },
                    motivoEnvio: {
                        type: "string",
                        description: "Motivo do envio"
                    }
                },
                required: ["tipoDocumento", "motivoEnvio"]
            }
        }
    },
    {
        type: "function" as const,
        function: {
            name: "coletarEnderecoEntrega",
            description: `Coleta informações sobre entrega ou retirada.

✅ Fazemos ENTREGA para todo o Brasil!
- Transportadora para todo Brasil
- Frete grátis acima de R$ 299
- Van para algumas regiões
- Motoboy para Castanhal

Use quando cliente perguntar sobre:
- "Vocês entregam?"
- "Faz entrega?"
- "Qual o frete?"
- "Como recebo o produto?"

📝 Consulte o FAQ/Treinamento para detalhes específicos de frete e regiões.`,
            parameters: {
                type: "object",
                properties: {
                    tipoEntrega: {
                        type: "string",
                        enum: ["DELIVERY", "PICKUP"],
                        description: "DELIVERY para entrega, PICKUP para retirada na loja"
                    }
                },
                required: ["tipoEntrega"]
            }
        }
    },
    {
        type: "function" as const,
        function: {
            name: "finalizarConversa",
            description: `Encerra a conversa com despedida personalizada.

🎯 Use quando cliente disser:
- "ok obrigado", "valeu", "tchau"
- "era isso", "só isso"
- "perfeito", "show"

📝 Na despedida:
- Use o nome do cliente se souber
- Seja simpática e fashionista
- Convide a voltar`,
            parameters: {
                type: "object",
                properties: {
                    nomeCliente: {
                        type: "string",
                        description: "Nome do cliente (se souber)"
                    },
                    resumoConversa: {
                        type: "string",
                        description: "O que foi tratado"
                    }
                },
                required: ["resumoConversa"]
            }
        }
    },
    {
        type: "function" as const,
        function: {
            name: "solicitarVerificacao",
            description: `🔴 OBRIGATÓRIO: Use quando NÃO encontrar informação ou produto!

⚠️ CHAME ESTA FUNÇÃO quando:
- Produto não encontrado no catálogo
- Estoque zerado ou indisponível
- Cliente manda foto de peça que quer comprar
- Qualquer informação que você NÃO tem certeza
- Preço, tamanho ou cor que você não sabe

NUNCA diga "não temos" ou "não encontrei" - SEMPRE use esta função!
A equipe vai verificar e responder ao cliente.`,
            parameters: {
                type: "object",
                properties: {
                    assunto: {
                        type: "string",
                        description: "O que precisa ser verificado com a equipe"
                    },
                    produtoMencionado: {
                        type: "string",
                        description: "Nome do produto/peça mencionado pelo cliente"
                    },
                    urgencia: {
                        type: "string",
                        enum: ["baixa", "media", "alta"],
                        description: "baixa = apenas curiosidade, media = quer comprar, alta = já decidiu comprar"
                    }
                },
                required: ["assunto"]
            }
        }
    }
];

// ============================================
// FUNCTION IMPLEMENTATIONS
// ============================================

/**
 * Mapa de sinônimos para termos de moda/vestuário
 * Cada grupo contém variações que devem ser tratadas como equivalentes
 * IMPORTANTE: Cada termo deve mapear para TODOS os outros do mesmo grupo
 */
const SYNONYMS_MAP: Record<string, string[]> = {
    // Calças (todos os termos mapeiam para todos)
    "calca": ["calça", "calsa", "calças", "calcas", "calsas"],
    "calça": ["calca", "calsa", "calças", "calcas", "calsas"],
    "calsa": ["calça", "calca", "calças", "calcas", "calsas"],

    // Camisetas/Camisas/Blusas (intercambiáveis)
    "camiseta": ["camisa", "camisetas", "camisas", "blusa", "blusas"],
    "camisa": ["camiseta", "camisetas", "camisas", "blusa", "blusas"],
    "blusa": ["camiseta", "camisa", "camisetas", "camisas", "blusas"],
    "blusas": ["camiseta", "camisa", "camisetas", "camisas", "blusa"],

    // Agasalhos (todos são equivalentes)
    "agasalho": ["casaco", "jaqueta", "moletom", "blusa de frio", "agasalhos", "casacos", "jaquetas"],
    "casaco": ["agasalho", "jaqueta", "moletom", "blusa de frio", "agasalhos", "casacos", "jaquetas"],
    "jaqueta": ["agasalho", "casaco", "moletom", "blusa de frio", "agasalhos", "casacos", "jaquetas"],
    "moletom": ["agasalho", "casaco", "jaqueta", "blusa de frio", "agasalhos", "casacos", "jaquetas"],

    // Bonés/Chapéus (BIDIRECIONAL - chapéu encontra boné e vice-versa)
    "bone": ["boné", "bonés", "bones", "cap", "chapeu", "chapéu", "touca"],
    "boné": ["bone", "bonés", "bones", "cap", "chapeu", "chapéu", "touca"],
    "chapeu": ["boné", "bone", "bonés", "bones", "cap", "chapéu", "touca"],
    "chapéu": ["boné", "bone", "bonés", "bones", "cap", "chapeu", "touca"],
    "cap": ["boné", "bone", "bonés", "bones", "chapeu", "chapéu", "touca"],
    "touca": ["boné", "bone", "bonés", "bones", "cap", "chapeu", "chapéu"],

    // Bermudas/Shorts
    "bermuda": ["bermudas", "shorts", "short"],
    "shorts": ["bermuda", "bermudas", "short"],
    "short": ["bermuda", "bermudas", "shorts"],

    // Vestidos
    "vestido": ["vestidos", "dress"],

    // Saias
    "saia": ["saias"],

    // Calçados
    "tenis": ["tênis", "sapatenis", "sapatênis", "sneaker", "sneakers"],
    "tênis": ["tenis", "sapatenis", "sapatênis", "sneaker", "sneakers"],
};

/**
 * Subtipos específicos que devem ser tratados como filtros adicionais
 * Se o cliente pedir "camisa polo", só retorna camisas COM polo no nome
 */
const PRODUCT_SUBTYPES = [
    "polo",
    "jeans",
    "social",
    "esportivo",
    "esportiva",
    "cargo",
    "skinny",
    "slim",
    "wide",
    "oversize",
    "cropped",
    "básico",
    "basico",
    "básica",
    "basica",
];

/**
 * Expande um termo com seus sinônimos
 */
function expandTermWithSynonyms(term: string): string[] {
    const normalized = normalizeText(term);
    const words = normalized.split(" ");
    const expandedTerms: Set<string> = new Set([normalized]);

    for (const word of words) {
        // Adicionar sinônimos da palavra
        const synonyms = SYNONYMS_MAP[word];
        if (synonyms) {
            for (const syn of synonyms) {
                // Substituir a palavra pelo sinônimo no termo original
                const expandedTerm = normalized.replace(word, normalizeText(syn));
                expandedTerms.add(expandedTerm);
                expandedTerms.add(normalizeText(syn)); // Também adiciona só o sinônimo
            }
        }
    }

    return Array.from(expandedTerms);
}

/**
 * Extrai subtipos do termo de busca
 */
function extractSubtypes(term: string): { mainTerm: string; subtypes: string[] } {
    const normalized = normalizeText(term);
    const words = normalized.split(" ");
    const subtypes: string[] = [];
    const mainWords: string[] = [];

    for (const word of words) {
        if (PRODUCT_SUBTYPES.includes(word)) {
            subtypes.push(word);
        } else {
            mainWords.push(word);
        }
    }

    return {
        mainTerm: mainWords.join(" "),
        subtypes
    };
}

/**
 * Normaliza texto removendo acentos e caracteres especiais
 */
function normalizeText(text: string): string {
    return text
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "") // Remove acentos
        .replace(/[^a-z0-9\s]/g, " ") // Remove caracteres especiais
        .replace(/\s+/g, " ") // Normaliza espaços
        .trim();
}

/**
 * Calcula pontuação de relevância de um produto
 * Usa sinônimos e penaliza ausência de subtipos específicos
 */
function calculateProductScore(
    product: { name: string; description: string | null; colors: string[] },
    searchTerm: string,
    searchColor: string
): number {
    let score = 0;
    const normalizedName = normalizeText(product.name);
    const normalizedDescription = normalizeText(product.description || "");
    const normalizedColor = normalizeText(searchColor);

    // Extrair subtipos do termo de busca (polo, jeans, social, etc)
    const { mainTerm, subtypes } = extractSubtypes(searchTerm);
    const normalizedMainTerm = normalizeText(mainTerm);

    // Expandir termo principal com sinônimos
    const expandedTerms = expandTermWithSynonyms(mainTerm);

    // === PONTUAÇÃO POR NOME (testando termo principal e sinônimos) ===

    let bestNameScore = 0;
    for (const term of expandedTerms) {
        let termScore = 0;

        // Match exato no nome (100 pontos)
        if (normalizedName === term) {
            termScore = 100;
        }
        // Nome começa com o termo (80 pontos)
        else if (normalizedName.startsWith(term)) {
            termScore = 80;
        }
        // Nome contém o termo como palavra (60 pontos)
        else if (normalizedName.split(" ").some(word => word === term || term.split(" ").includes(word))) {
            termScore = 60;
        }
        // Nome contém o termo (40 pontos)
        else if (normalizedName.includes(term) || term.split(" ").some(w => w.length >= 3 && normalizedName.includes(w))) {
            termScore = 40;
        }

        bestNameScore = Math.max(bestNameScore, termScore);
    }
    score += bestNameScore;

    // Palavras individuais do termo no nome (10 pontos cada)
    const termWords = normalizedMainTerm.split(" ").filter(w => w.length >= 3);
    for (const word of termWords) {
        if (normalizedName.includes(word)) {
            score += 10;
        }
        // Também verifica sinônimos da palavra
        const synonyms = SYNONYMS_MAP[word];
        if (synonyms) {
            for (const syn of synonyms) {
                if (normalizedName.includes(normalizeText(syn))) {
                    score += 8;
                    break;
                }
            }
        }
    }

    // === PONTUAÇÃO/PENALIZAÇÃO POR SUBTIPO ===

    if (subtypes.length > 0) {
        let hasAllSubtypes = true;
        for (const subtype of subtypes) {
            const normalizedSubtype = normalizeText(subtype);
            const hasSubtypeInName = normalizedName.includes(normalizedSubtype);
            const hasSubtypeInDesc = normalizedDescription.includes(normalizedSubtype);

            if (hasSubtypeInName) {
                // Bônus por ter o subtipo no nome (muito relevante!)
                score += 50;
            } else if (hasSubtypeInDesc) {
                // Subtipo na descrição vale menos
                score += 20;
            } else {
                // Produto NÃO tem o subtipo pedido
                hasAllSubtypes = false;
            }
        }

        // Se o cliente pediu um subtipo específico e o produto NÃO tem,
        // penaliza FORTEMENTE para que não apareça nos resultados
        if (!hasAllSubtypes) {
            score -= 100;
        }
    }

    // === PONTUAÇÃO POR COR ===

    if (normalizedColor) {
        // Cor exata no campo colors[] (50 pontos)
        const normalizedColors = product.colors.map(c => normalizeText(c));
        if (normalizedColors.some(c => c === normalizedColor || c.includes(normalizedColor))) {
            score += 50;
        }
        // Cor no nome (40 pontos)
        else if (normalizedName.includes(normalizedColor)) {
            score += 40;
        }
        // Cor na descrição (20 pontos)
        else if (normalizedDescription.includes(normalizedColor)) {
            score += 20;
        }
    }

    // === PONTUAÇÃO POR DESCRIÇÃO ===

    // Termo na descrição (15 pontos)
    for (const term of expandedTerms) {
        if (normalizedDescription.includes(term)) {
            score += 15;
            break;
        }
    }

    // Palavras do termo na descrição (5 pontos cada)
    for (const word of termWords) {
        if (normalizedDescription.includes(word)) {
            score += 5;
        }
    }

    return score;
}

async function buscarProduto(
    args: Record<string, unknown>,
    context: FunctionContext
): Promise<FunctionResult> {
    const termo = (args.termo as string || "").trim();
    const cor = (args.cor as string || "").trim();
    const produtosJaEnviados = (args.produtosJaEnviados as string[] || []);
    const normalizedTermo = normalizeText(termo);
    const normalizedCor = normalizeText(cor);

    // Extrair subtipos do termo de busca
    const { mainTerm, subtypes } = extractSubtypes(termo);

    console.log(`[AI Functions] ========================================`);
    console.log(`[AI Functions] 🔍 BUSCA DE PRODUTO INICIADA`);
    console.log(`[AI Functions] 📝 Termo: "${termo}"`);
    console.log(`[AI Functions] 🎨 Cor: ${cor || "(nenhuma)"}`);
    console.log(`[AI Functions] 🏷️ Subtipos: ${subtypes.length > 0 ? subtypes.join(", ") : "(nenhum)"}`);
    console.log(`[AI Functions] 📦 Produtos já enviados (da IA): ${produtosJaEnviados.length}`);
    console.log(`[AI Functions] ========================================`);

    // AUTO-TRACKING: Se a IA não passou produtosJaEnviados, buscar do histórico
    let allExcludedIds = [...produtosJaEnviados];
    if (allExcludedIds.length === 0) {
        try {
            // Buscar mensagens recentes da IA nesta conversa
            const recentAIMessages = await prisma.message.findMany({
                where: {
                    conversationId: context.conversationId,
                    sender: "AI",
                },
                orderBy: { createdAt: "desc" },
                take: 10,
                select: { content: true },
            });

            // Buscar todos os produtos ativos da empresa para matching
            const companyProducts = await prisma.product.findMany({
                where: { companyId: context.companyId, isActive: true },
                select: { id: true, name: true },
            });

            // Verificar quais nomes de produtos aparecem nas mensagens da IA
            const aiContent = recentAIMessages.map(m => m.content).join(" ").toLowerCase();
            for (const product of companyProducts) {
                if (aiContent.includes(product.name.toLowerCase())) {
                    allExcludedIds.push(product.id);
                }
            }

            // Deduplicar
            allExcludedIds = [...new Set(allExcludedIds)];
            if (allExcludedIds.length > 0) {
                console.log(`[AI Functions] 🔄 Auto-tracked ${allExcludedIds.length} product IDs from conversation history`);
            }
        } catch (err) {
            console.error("[AI Functions] Failed to auto-track sent products:", err);
        }
    }

    if (!termo) {
        return {
            success: false,
            message: "Me diz o nome do produto que você procura! 😊",
        };
    }

    try {
        // 1. Buscar TODOS os produtos ativos da empresa
        // (busca mais ampla para depois ranquear)
        const allProducts = await prisma.product.findMany({
            where: {
                companyId: context.companyId,
                isActive: true,
            },
            include: {
                category: { select: { name: true } },
            },
        });

        if (allProducts.length === 0) {
            return {
                success: true,
                message: `Deixa eu verificar aqui sobre "${termo}"...`,
                data: { found: false, needsVerification: true, searchTerm: termo }
            };
        }

        // 2. Calcular pontuação para cada produto
        const scoredProducts = allProducts
            // 2.1 Excluir produtos já enviados (inclui auto-tracked)
            .filter(product => !allExcludedIds.includes(product.id))
            .map(product => ({
                ...product,
                score: calculateProductScore(
                    { name: product.name, description: product.description, colors: product.colors || [] },
                    normalizedTermo,
                    normalizedCor
                )
            }));

        if (allExcludedIds.length > 0) {
            console.log(`[AI Functions] 🚫 Excluídos ${allExcludedIds.length} produtos já enviados`);
        }

        // 2.5 FILTRO ESTRITO DE SUBTIPO
        // Se cliente pediu subtipo específico (polo, jeans, social), filtrar APENAS produtos que contêm
        if (subtypes.length > 0) {
            console.log(`[AI Functions] 🏷️ Aplicando filtro estrito para subtipos: ${subtypes.join(", ")}`);

            const beforeCount = scoredProducts.length;
            const filteredBySubtype = scoredProducts.filter(product => {
                const normalizedName = normalizeText(product.name);
                const normalizedDesc = normalizeText(product.description || "");

                // Produto deve conter TODOS os subtipos
                return subtypes.every(subtype => {
                    const normalizedSubtype = normalizeText(subtype);
                    return normalizedName.includes(normalizedSubtype) || normalizedDesc.includes(normalizedSubtype);
                });
            });

            console.log(`[AI Functions] 🏷️ Filtro de subtipo: ${beforeCount} → ${filteredBySubtype.length} produtos`);

            if (filteredBySubtype.length > 0) {
                // Usar apenas produtos filtrados
                const relevantFiltered = filteredBySubtype
                    .filter(p => p.score > 0)
                    .sort((a, b) => b.score - a.score);

                if (relevantFiltered.length > 0) {
                    console.log(`[AI Functions] ✅ Encontrados ${relevantFiltered.length} produtos com subtipo "${subtypes.join(", ")}"`);

                    // Formato unificado com lista de produtos (igual ao path principal)
                    const productsToShow = relevantFiltered.slice(0, 10);
                    const EMOJI_NUMBERS = ["1️⃣", "2️⃣", "3️⃣", "4️⃣", "5️⃣", "6️⃣", "7️⃣", "8️⃣", "9️⃣", "🔟"];

                    console.log(`[AI Functions] ✅ Melhor match (com subtipo): "${productsToShow[0].name}" (score: ${productsToShow[0].score})`);

                    const productListFormatted = productsToShow.map((p, index) => {
                        const emoji = EMOJI_NUMBERS[index] || `${index + 1}.`;
                        const priceStr = p.price.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
                        return `${emoji} *${p.name}* - ${priceStr}`;
                    }).join("\n");

                    let message = `Achei ${productsToShow.length} opções! 🎉\n\n${productListFormatted}`;

                    if (relevantFiltered.length > 10) {
                        message += `\n\n📦 Tem mais ${relevantFiltered.length - 10} opções! Quer ver mais?`;
                    }

                    message += `\n\n*Qual te interessou?* Me fala o número! 🛒`;

                    return {
                        success: true,
                        message,
                        data: {
                            found: true,
                            products: productsToShow.map(p => ({
                                id: p.id,
                                name: p.name,
                                price: p.price,
                                priceFormatted: p.price.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }),
                                imageUrl: p.imageUrl,
                                hasImage: !!p.imageUrl
                            })),
                            productIds: productsToShow.map(p => p.id),
                            totalAvailable: relevantFiltered.length,
                            hasMoreProducts: relevantFiltered.length > 10,
                            availableSizes: productsToShow[0].sizes || [],
                            availableColors: productsToShow[0].colors || [],
                            subtypeMatch: subtypes,
                        }
                    };
                }
            }

            console.log(`[AI Functions] ⚠️ Nenhum produto com subtipo "${subtypes.join(", ")}" encontrado`);
            return {
                success: true,
                message: `Não encontrei ${subtypes.join(" ")} ${mainTerm} específico, mas posso verificar se temos! Deixa eu checar aqui...`,
                data: { found: false, needsVerification: true, searchTerm: termo, subtypeRequested: subtypes }
            };
        }

        // 3. Filtrar produtos com pontuação > 0 e ordenar por relevância
        let relevantProducts = scoredProducts
            .filter(p => p.score > 0)
            .sort((a, b) => b.score - a.score);

        console.log(`[AI Functions] 📊 Produtos encontrados com score > 0: ${relevantProducts.length}`);

        // Log dos top 3 para debug
        relevantProducts.slice(0, 3).forEach((p, i) => {
            console.log(`[AI Functions]   ${i + 1}. ${p.name} (score: ${p.score})`);
        });

        // 4. Se nenhum produto teve score, fazer busca mais flexível
        if (relevantProducts.length === 0) {
            // Tenta busca por sinônimos expandidos
            const expandedTerms = expandTermWithSynonyms(termo);
            console.log(`[AI Functions] 🔄 Tentando sinônimos: ${expandedTerms.join(", ")}`);

            for (const expandedTerm of expandedTerms) {
                if (expandedTerm === normalizedTermo) continue; // Já tentou esse

                const expandedNorm = normalizeText(expandedTerm);
                relevantProducts = scoredProducts
                    .map(product => {
                        const normalizedName = normalizeText(product.name);
                        const normalizedDesc = normalizeText(product.description || "");
                        let flexScore = 0;

                        if (normalizedName.includes(expandedNorm)) flexScore += 40;
                        if (normalizedDesc.includes(expandedNorm)) flexScore += 10;

                        // Palavras do termo expandido
                        const words = expandedNorm.split(" ").filter(w => w.length >= 3);
                        for (const word of words) {
                            if (normalizedName.includes(word)) flexScore += 20;
                            if (normalizedDesc.includes(word)) flexScore += 5;
                        }

                        return { ...product, score: flexScore };
                    })
                    .filter(p => p.score > 0)
                    .sort((a, b) => b.score - a.score);

                if (relevantProducts.length > 0) {
                    console.log(`[AI Functions] ✅ Encontrado via sinônimo "${expandedTerm}": ${relevantProducts.length} produtos`);
                    break;
                }
            }
        }

        // 4.5 Ainda sem resultados? Tenta busca por palavras individuais
        if (relevantProducts.length === 0) {
            const palavras = normalizedTermo.split(" ").filter(p => p.length >= 3);

            if (palavras.length > 0) {
                relevantProducts = scoredProducts
                    .map(product => {
                        let flexScore = 0;
                        const normalizedName = normalizeText(product.name);
                        const normalizedDesc = normalizeText(product.description || "");

                        for (const palavra of palavras) {
                            if (normalizedName.includes(palavra)) flexScore += 20;
                            if (normalizedDesc.includes(palavra)) flexScore += 5;
                        }

                        return { ...product, score: flexScore };
                    })
                    .filter(p => p.score > 0)
                    .sort((a, b) => b.score - a.score);

                console.log(`[AI Functions] 🔄 Busca flexível por palavras encontrou: ${relevantProducts.length}`);
            }
        }

        // 4.6 Ainda sem resultados? Solicitar verificação com a equipe
        // NUNCA dizer "não temos" — sempre verificar com a equipe
        if (relevantProducts.length === 0) {
            console.log(`[AI Functions] ⚠️ Nenhum produto encontrado para "${termo}" - solicitando verificação`);

            return {
                success: true,
                message: `Deixa eu verificar com a equipe sobre "${termo}"... Já te dou um retorno! 🔍`,
                data: {
                    found: false,
                    needsVerification: true,
                    searchTerm: termo,
                }
            };
        }

        // 5. Ainda sem resultados? Retorna para verificação
        if (relevantProducts.length === 0) {
            console.log(`[AI Functions] ❌ Nenhum produto encontrado para "${termo}"`);
            return {
                success: true,
                message: `Deixa eu verificar aqui sobre "${termo}"...`,
                data: { found: false, needsVerification: true, searchTerm: termo }
            };
        }

        // 6. Limitar resultados para exibição (AUMENTADO PARA 10)
        const products = relevantProducts.slice(0, 10);
        const bestMatch = products[0];

        console.log(`[AI Functions] ✅ Melhor match: "${bestMatch.name}" (score: ${bestMatch.score})`);

        // Buscar tamanhos disponíveis
        let availableSizes: string[] = [];

        const variants = await prisma.productVariant.findMany({
            where: {
                productId: bestMatch.id,
                stock: { gt: 0 }
            },
            select: { size: true, stock: true }
        });

        if (variants.length > 0) {
            availableSizes = Array.from(new Set(variants.map(v => v.size)));
        } else if (bestMatch.sizes && bestMatch.sizes.length > 0) {
            availableSizes = bestMatch.sizes;
        }

        // === FORMATAR LISTA DE PRODUTOS (LIMITE 10) ===
        const EMOJI_NUMBERS = ["1️⃣", "2️⃣", "3️⃣", "4️⃣", "5️⃣", "6️⃣", "7️⃣", "8️⃣", "9️⃣", "🔟"];

        // Usar até 10 produtos
        const productsToShow = products.slice(0, 10);
        const productIds = productsToShow.map(p => p.id);
        const totalAvailable = relevantProducts.length;
        const hasMoreProducts = totalAvailable > 10;

        console.log(`[AI Functions] 📋 Mostrando ${productsToShow.length} de ${totalAvailable} produtos encontrados`);

        // Formatar lista bonita (só nome + preço)
        const productListFormatted = productsToShow.map((p, index) => {
            const emoji = EMOJI_NUMBERS[index] || `${index + 1}.`;
            const priceStr = p.price.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
            return `${emoji} *${p.name}* - ${priceStr}`;
        }).join("\n");

        // Mensagem final
        let message = `Achei ${productsToShow.length} opções! 🎉\n\n${productListFormatted}`;

        if (hasMoreProducts) {
            message += `\n\n📦 Tem mais ${totalAvailable - 10} opções! Quer ver mais?`;
        }

        message += `\n\n*Qual te interessou?* Me fala o número! 🛒`;

        return {
            success: true,
            message,
            data: {
                found: true,
                products: productsToShow.map(p => ({
                    id: p.id,
                    name: p.name,
                    price: p.price,
                    priceFormatted: p.price.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }),
                    imageUrl: p.imageUrl,
                    hasImage: !!p.imageUrl
                })),
                productIds, // IDs para IA usar em produtosJaEnviados
                totalAvailable,
                hasMoreProducts,
                sendProductImage: !!bestMatch.imageUrl,
                imageUrl: bestMatch.imageUrl,
                availableSizes,
                availableColors: bestMatch.colors || [],
            }
        };
    } catch (error) {
        console.error("[AI Functions] Error in buscarProduto:", error);
        return {
            success: false,
            message: "Tive um probleminha ao buscar. Pode tentar de novo? 😅",
        };
    }
}

/**
 * Verifica disponibilidade - REMOVIDA para loja de roupas
 * Agendamentos não são aplicáveis para este nicho
 */
async function verificarDisponibilidade(
    _args: Record<string, unknown>,
    _context: FunctionContext
): Promise<FunctionResult> {
    // Loja de roupas não utiliza agendamento
    return {
        success: true,
        message: "Agendamentos não estão disponíveis para nossa loja. Posso ajudar com nossos produtos, tamanhos, preços ou outras dúvidas! 👗",
        data: { notAvailable: true, reason: "Loja de roupas não faz agendamentos" }
    };
}

/**
 * Transfere a conversa para humano
 */
async function transferirParaHumano(
    args: Record<string, unknown>,
    context: FunctionContext
): Promise<FunctionResult> {
    const motivo = args.motivo as string;
    const resumo = args.resumo as string;

    try {
        // Atualizar status da conversa para HUMAN_HANDLING
        await prisma.conversation.update({
            where: { id: context.conversationId },
            data: {
                status: "HUMAN_HANDLING",
            },
        });

        // Log da transferência com notas
        await prisma.auditLog.create({
            data: {
                action: "AI_TRANSFER_TO_HUMAN",
                entity: "Conversation",
                entityId: context.conversationId,
                companyId: context.companyId,
                changes: JSON.stringify({ motivo, resumo }),
                userEmail: "system@ai",
            },
        });

        // Dispatch HUMAN_TRANSFER webhook
        dispatchWebhook(context.companyId, "HUMAN_TRANSFER", {
            conversationId: context.conversationId,
            reason: motivo,
            summary: resumo,
            timestamp: new Date().toISOString(),
        }).catch((err) => console.error("[Webhook] HUMAN_TRANSFER failed:", err));

        return {
            success: true,
            message: "Tranquilo! Vou passar você pro pessoal aqui, eles vão te ajudar melhor. Aguarda só um pouquinho! 🙏",
            data: { transferred: true, reason: motivo }
        };
    } catch (error) {
        console.error("[AI Functions] Error in transferirParaHumano:", error);
        return {
            success: false,
            message: "Opa, tive um probleminha aqui. Mas relaxa que alguém da equipe já vai te atender!",
        };
    }
}

/**
 * Solicita verificação da equipe quando IA não sabe responder
 * Muda status para WAITING_RESPONSE e registra o que precisa ser verificado
 */
async function solicitarVerificacao(
    args: Record<string, unknown>,
    context: FunctionContext
): Promise<FunctionResult> {
    const assunto = args.assunto as string;
    const produtoMencionado = args.produtoMencionado as string | undefined;
    const urgencia = (args.urgencia as string) || "media";

    try {
        // Buscar dados da conversa para contexto
        const conversation = await prisma.conversation.findUnique({
            where: { id: context.conversationId },
            select: { customerPhone: true, customerName: true },
        });

        // Atualizar status para WAITING_RESPONSE
        await prisma.conversation.update({
            where: { id: context.conversationId },
            data: {
                status: "WAITING_RESPONSE",
            },
        });

        // Log da solicitação de verificação (será visível no histórico de auditoria)
        await prisma.auditLog.create({
            data: {
                action: "AI_REQUESTED_VERIFICATION",
                entity: "Conversation",
                entityId: context.conversationId,
                companyId: context.companyId,
                changes: JSON.stringify({
                    assunto,
                    produtoMencionado,
                    urgencia,
                    customerName: conversation?.customerName,
                    customerPhone: conversation?.customerPhone
                }),
                userEmail: "system@ai",
            },
        });

        // Dispatch webhook para notificação externa
        dispatchWebhook(context.companyId, "VERIFICATION_REQUESTED", {
            conversationId: context.conversationId,
            customerPhone: conversation?.customerPhone,
            customerName: conversation?.customerName,
            subject: assunto,
            product: produtoMencionado,
            urgency: urgencia,
            timestamp: new Date().toISOString(),
        }).catch((err) => console.error("[Webhook] VERIFICATION_REQUESTED failed:", err));

        // Mensagens variadas para parecer natural
        const messages = [
            "Boa pergunta! Deixa eu verificar aqui com a equipe e já te dou um retorno! 👍",
            "Vou checar isso aqui rapidinho! Já já te passo a informação! ⏳",
            "Hmm, deixa eu confirmar com o pessoal... Já volto! 😊",
            "Ótima pergunta! Vou verificar e te retorno em seguida!",
        ];
        const randomMessage = messages[Math.floor(Math.random() * messages.length)];

        return {
            success: true,
            message: randomMessage,
            data: {
                verificationRequested: true,
                subject: assunto,
                product: produtoMencionado,
                urgency: urgencia,
            }
        };
    } catch (error) {
        console.error("[AI Functions] Error in solicitarVerificacao:", error);
        return {
            success: false,
            message: "Deixa eu verificar aqui... Já te retorno!",
        };
    }
}

/**
 * Registra interesse para follow-up
 */
async function registrarInteresse(
    args: Record<string, unknown>,
    context: FunctionContext
): Promise<FunctionResult> {
    const produto = args.produto as string;
    const detalhes = args.detalhes as string | undefined;

    try {
        // Buscar dados da conversa
        const conversation = await prisma.conversation.findUnique({
            where: { id: context.conversationId },
            select: { customerPhone: true, customerName: true },
        });

        if (!conversation) {
            return {
                success: false,
                message: "Anotado! Já já a gente te chama.",
            };
        }

        await prisma.customerInterest.create({
            data: {
                companyId: context.companyId,
                conversationId: context.conversationId,
                productName: produto,
                details: detalhes,
                customerPhone: conversation.customerPhone,
                customerName: conversation.customerName,
                status: "NEW",
            },
        });

        // CRM: Criar deal automático no pipeline com valor do produto
        // Buscar preço do produto para incluir no deal
        let productValue = 0;
        try {
            const productMatch = await prisma.product.findFirst({
                where: {
                    companyId: context.companyId,
                    isActive: true,
                    OR: [
                        { name: { contains: produto, mode: "insensitive" } },
                    ],
                },
                select: { price: true },
            });
            if (productMatch) {
                productValue = productMatch.price;
            }
        } catch (e) {
            console.error("[CRM] Error fetching product price:", e);
        }

        autoCreateOrUpdateDeal({
            companyId: context.companyId,
            customerPhone: conversation.customerPhone,
            customerName: conversation.customerName,
            title: `Interesse: ${produto}`,
            value: productValue,
            source: "INTEREST",
        }).catch(err => console.error("[CRM] Auto deal failed:", err));

        // Dispatch CUSTOMER_INTEREST webhook
        dispatchWebhook(context.companyId, "CUSTOMER_INTEREST", {
            conversationId: context.conversationId,
            productName: produto,
            details: detalhes,
            customerPhone: conversation.customerPhone,
            customerName: conversation.customerName,
            timestamp: new Date().toISOString(),
        }).catch((err) => console.error("[Webhook] CUSTOMER_INTEREST failed:", err));

        return {
            success: true,
            message: `Show! Anotei aqui seu interesse 📝 Alguém da equipe vai te chamar pra gente fechar, beleza?`,
            data: { registered: true }
        };
    } catch (error) {
        console.error("[AI Functions] Error in registrarInteresse:", error);
        return {
            success: false,
            message: "Anotado! Já já a gente te chama.",
        };
    }
}

/**
 * Processa uma venda - envia PIX e cria pedido
 */
async function processarVenda(
    args: Record<string, unknown>,
    context: FunctionContext
): Promise<FunctionResult> {
    const produto = args.produto as string;
    const precoInformado = args.preco as number; // Preço informado pela IA (backup)
    const quantidade = (args.quantidade as number) || 1;
    const observacoes = (args.observacoes as string || "").trim();

    try {
        // Buscar PIX da empresa
        const company = await prisma.company.findUnique({
            where: { id: context.companyId },
            select: { pixKey: true, pixKeyType: true, name: true },
        });

        if (!company?.pixKey) {
            return {
                success: false,
                message: "Opa, deixa eu verificar aqui com o pessoal como você pode pagar. Já te falo!",
                data: { needsPixSetup: true }
            };
        }

        // Buscar dados da conversa
        const conversation = await prisma.conversation.findUnique({
            where: { id: context.conversationId },
            select: { customerPhone: true, customerName: true },
        });

        if (!conversation) {
            return {
                success: false,
                message: "Tive um probleminha aqui, mas relaxa que já vou resolver!",
            };
        }

        // ✅ IMPORTANTE: Buscar o preço REAL do produto no catálogo
        let precoReal = precoInformado;
        const productMatch = await prisma.product.findFirst({
            where: {
                companyId: context.companyId,
                isActive: true,
                OR: [
                    { name: { contains: produto, mode: "insensitive" } },
                    { name: { equals: produto, mode: "insensitive" } },
                ],
            },
            select: { price: true, name: true },
        });

        if (productMatch) {
            precoReal = productMatch.price;
            console.log(`[AI Functions] ✅ Preço do CATÁLOGO: "${productMatch.name}" = R$ ${precoReal}`);
        } else {
            console.log(`[AI Functions] ⚠️ Produto "${produto}" não encontrado no catálogo - usando preço informado: R$ ${precoInformado}`);
        }

        const totalItem = precoReal * quantidade;

        // ✅ NOVO: Verificar se já existe pedido pendente RECENTE nesta conversa
        // Apenas combina com pedidos dos últimos 30 minutos para evitar misturar com antigos
        const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000);
        const existingOrder = await prisma.order.findFirst({
            where: {
                conversationId: context.conversationId,
                status: "AWAITING_PAYMENT",
                createdAt: { gte: thirtyMinutesAgo }, // ✅ Apenas pedidos recentes
                deliveryType: null, // ✅ Ainda não perguntou sobre entrega
            },
            orderBy: { createdAt: "desc" },
        });

        let order;
        let totalGeral = totalItem;
        let itensCombinados = `${quantidade}x ${produto}`;

        if (existingOrder) {
            // Adicionar ao pedido existente RECENTE
            const novoProductName = existingOrder.productName + ` | ${quantidade}x ${produto}`;
            totalGeral = existingOrder.totalAmount + totalItem;

            order = await prisma.order.update({
                where: { id: existingOrder.id },
                data: {
                    productName: novoProductName,
                    totalAmount: totalGeral,
                    notes: (existingOrder.notes || "") + `\n+ ${quantidade}x ${produto} (R$${precoReal})`,
                },
            });

            itensCombinados = novoProductName;
            console.log(`[AI Functions] 📦 Item adicionado ao pedido existente #${order.id.slice(-6)} - Total: R$${totalGeral}`);
        } else {
            // Criar novo pedido
            order = await prisma.order.create({
                data: {
                    companyId: context.companyId,
                    conversationId: context.conversationId,
                    customerPhone: conversation.customerPhone,
                    customerName: conversation.customerName,
                    productName: `${quantidade}x ${produto}`,
                    productPrice: precoReal,
                    quantity: quantidade,
                    totalAmount: totalItem,
                    pixKey: company.pixKey,
                    pixKeyType: company.pixKeyType,
                    status: "AWAITING_PAYMENT",
                    notes: `${quantidade}x ${produto} (R$${precoReal})`,
                    customerNotes: observacoes || null,
                },
            });
            console.log(`[AI Functions] 🆕 Novo pedido criado #${order.id.slice(-6)}`);
        }

        // CRM: Mover deal para CLOSED_WON ou criar novo
        moveDealToClosed(context.companyId, conversation.customerPhone, totalGeral)
            .then(result => {
                if (result.action === "not_found") {
                    autoCreateOrUpdateDeal({
                        companyId: context.companyId,
                        customerPhone: conversation.customerPhone,
                        customerName: conversation.customerName,
                        title: `Pedido: ${itensCombinados}`,
                        value: totalGeral,
                        source: "ORDER",
                    }).catch(err => console.error("[CRM] Auto deal failed:", err));
                }
            })
            .catch(err => console.error("[CRM] Close deal failed:", err));

        // Dispatch webhook
        dispatchWebhook(context.companyId, "SALE_COMPLETED", {
            conversationId: context.conversationId,
            orderId: order.id,
            productName: itensCombinados,
            productPrice: precoReal,
            quantity: quantidade,
            totalAmount: totalGeral,
            customerPhone: conversation.customerPhone,
            customerName: conversation.customerName,
            status: "AWAITING_PAYMENT",
            timestamp: new Date().toISOString(),
        }).catch((err) => console.error("[Webhook] SALE_COMPLETED failed:", err));

        // Formatar valor (SUBTOTAL - sem taxa de entrega ainda)
        const subtotalFormatado = totalGeral.toLocaleString("pt-BR", {
            style: "currency",
            currency: "BRL",
        });

        // ✅ MUDANÇA: NÃO ENVIAR PIX AINDA!
        // Primeiro perguntar sobre entrega/retirada para calcular taxa
        // O PIX será enviado depois que soubermos o total final com taxa
        return {
            success: true,
            message: `Anotado! ✅

📝 *Seu pedido:*
${order.notes || itensCombinados}

💰 *Subtotal:* ${subtotalFormatado}

*É para entrega ou retirada?* 🛵🏪

(A taxa de entrega será calculada conforme o bairro)`,
            data: {
                orderId: order.id,
                subtotal: totalGeral,
                askDeliveryType: true, // Sinaliza que precisa perguntar tipo de entrega
                waitingDeliveryType: true, // ✅ NOVO: indica que não deve enviar PIX ainda
            }
        };
    } catch (error) {
        console.error("[AI Functions] Error in processarVenda:", error);
        return {
            success: false,
            message: "Opa, tive um probleminha aqui. Mas relaxa que a gente resolve!",
        };
    }
}

/**
 * Agenda uma reunião - REMOVIDA para loja de roupas
 * Agendamentos não são aplicáveis para este nicho
 */
async function agendarReuniao(
    _args: Record<string, unknown>,
    _context: FunctionContext
): Promise<FunctionResult> {
    // Loja de roupas não utiliza agendamento de reunião
    return {
        success: true,
        message: "Agendamento de reuniões não está disponível para nossa loja. Posso ajudar com nossos produtos, tamanhos ou outras dúvidas! 👗",
        data: { notAvailable: true, reason: "Loja de roupas não faz agendamentos" }
    };
}

/**
 * Agenda uma consulta - REMOVIDA para loja de roupas
 * Agendamentos não são aplicáveis para este nicho
 */
async function agendarConsulta(
    _args: Record<string, unknown>,
    _context: FunctionContext
): Promise<FunctionResult> {
    // Loja de roupas não utiliza agendamento de consulta
    return {
        success: true,
        message: "Agendamento de consultas não está disponível para nossa loja. Posso ajudar com nossos produtos, tamanhos ou outras dúvidas! 👗",
        data: { notAvailable: true, reason: "Loja de roupas não faz agendamentos" }
    };
}
























































async function solicitarOrcamento(
    args: Record<string, unknown>,
    context: FunctionContext
): Promise<FunctionResult> {
    const produto = args.produto as string;
    const especificacoes = args.especificacoes as string | undefined;
    const quantidade = (args.quantidade as number) || 1;

    try {
        const conversation = await prisma.conversation.findUnique({
            where: { id: context.conversationId },
            select: { customerPhone: true, customerName: true },
        });

        // Dispatch QUOTE_REQUESTED webhook
        dispatchWebhook(context.companyId, "QUOTE_REQUESTED", {
            conversationId: context.conversationId,
            customerPhone: conversation?.customerPhone,
            customerName: conversation?.customerName,
            product: produto,
            specifications: especificacoes,
            quantity: quantidade,
            timestamp: new Date().toISOString(),
        }).catch((err) => console.error("[Webhook] QUOTE_REQUESTED failed:", err));

        return {
            success: true,
            message: `Beleza! 💰 Anotei seu pedido de orçamento:\n\n📦 *${produto}*${quantidade > 1 ? ` x${quantidade}` : ""}\n${especificacoes ? `📝 ${especificacoes}\n` : ""}\nA equipe vai preparar e te enviar em breve!`,
            data: { quoteRequested: true }
        };
    } catch (error) {
        console.error("[AI Functions] Error in solicitarOrcamento:", error);
        return {
            success: false,
            message: "Anotado! A equipe vai preparar o orçamento!",
        };
    }
}

/**
 * Captura lead
 */
async function capturarLead(
    args: Record<string, unknown>,
    context: FunctionContext
): Promise<FunctionResult> {
    const nome = args.nome as string;
    const email = args.email as string | undefined;
    const empresa = args.empresa as string | undefined;
    const interesse = args.interesse as string | undefined;

    try {
        const conversation = await prisma.conversation.findUnique({
            where: { id: context.conversationId },
            select: { customerPhone: true },
        });

        // Update conversation with customer name
        await prisma.conversation.update({
            where: { id: context.conversationId },
            data: { customerName: nome },
        });

        // Dispatch LEAD_CAPTURED webhook
        dispatchWebhook(context.companyId, "LEAD_CAPTURED", {
            conversationId: context.conversationId,
            customerPhone: conversation?.customerPhone,
            name: nome,
            email,
            company: empresa,
            interest: interesse,
            timestamp: new Date().toISOString(),
        }).catch((err) => console.error("[Webhook] LEAD_CAPTURED failed:", err));

        return {
            success: true,
            message: `Prazer, ${nome}! 😊 Anotei seus dados aqui.${interesse ? ` Vou te ajudar com ${interesse}!` : ""}`,
            data: { leadCaptured: true }
        };
    } catch (error) {
        console.error("[AI Functions] Error in capturarLead:", error);
        return {
            success: false,
            message: "Prazer em te conhecer!",
        };
    }
}

/**
 * Envia documento para o cliente
 * 
 * Busca documentos do tipo DOCUMENT que tenham fileUrl configurado
 * e retorna a URL para envio via WhatsApp
 */
async function enviarDocumento(
    args: Record<string, unknown>,
    context: FunctionContext
): Promise<FunctionResult> {
    const tipoDocumento = (args.tipoDocumento as string || "").toLowerCase();
    const motivoEnvio = args.motivoEnvio as string || "cliente solicitou";

    try {
        // Buscar documentos do agente que tenham fileUrl
        const documents = await prisma.trainingData.findMany({
            where: {
                agentId: context.agentId,
                type: "DOCUMENT",
                fileUrl: { not: null },
            },
            select: {
                id: true,
                title: true,
                fileUrl: true,
                fileName: true,
            },
        });

        if (documents.length === 0) {
            return {
                success: false,
                message: "Desculpe, não tenho nenhum documento disponível para enviar no momento. Posso te ajudar de outra forma?",
            };
        }

        // Tentar encontrar documento que corresponda ao tipo solicitado
        const keywords = {
            cardapio: ["cardapio", "cardápio", "menu", "pratos", "pizza", "comida"],
            catalogo: ["catalogo", "catálogo", "produtos", "lista"],
            tabela_precos: ["precos", "preços", "tabela", "valores"],
            manual: ["manual", "instrucao", "instrução", "guia"],
        };

        let documentToSend = documents[0]; // Default: primeiro documento

        // Buscar documento específico pelo tipo
        const searchTerms = keywords[tipoDocumento as keyof typeof keywords] || [tipoDocumento];

        for (const doc of documents) {
            const titleLower = doc.title.toLowerCase();
            const fileNameLower = (doc.fileName || "").toLowerCase();

            if (searchTerms.some(term => titleLower.includes(term) || fileNameLower.includes(term))) {
                documentToSend = doc;
                break;
            }
        }

        console.log(`[AI Functions] enviarDocumento: Found document`, {
            id: documentToSend.id,
            title: documentToSend.title,
            fileUrl: documentToSend.fileUrl,
            tipoSolicitado: tipoDocumento,
            motivo: motivoEnvio,
        });

        // Retornar com flag especial para envio de arquivo
        return {
            success: true,
            message: `📎 Estou enviando o *${documentToSend.title}* para você!`,
            data: {
                sendFile: true,
                fileUrl: documentToSend.fileUrl,
                fileName: documentToSend.fileName || `${documentToSend.title}.pdf`,
                documentTitle: documentToSend.title,
            },
        };
    } catch (error) {
        console.error("[AI Functions] Error in enviarDocumento:", error);
        return {
            success: false,
            message: "Desculpe, tive um problema ao buscar o documento. Pode tentar novamente?",
        };
    }
}

/**
 * Informa sobre retirada - NÃO FAZEMOS ENTREGA!
 * Sistema apenas com retirada na loja
 */
async function coletarEnderecoEntrega(
    _args: Record<string, unknown>,
    context: FunctionContext
): Promise<FunctionResult> {
    try {
        // Buscar pedidos pendentes para calcular total
        const pendingOrders = await prisma.order.findMany({
            where: {
                conversationId: context.conversationId,
                status: { in: ["AWAITING_PAYMENT", "PROOF_SENT"] },
            },
        });

        let totalGeral = 0;
        for (const order of pendingOrders) {
            totalGeral += order.totalAmount;
            await prisma.order.update({
                where: { id: order.id },
                data: {
                    deliveryType: "PICKUP",
                    deliveryFee: 0,
                },
            });
        }

        // Buscar dados do PIX
        const company = await prisma.company.findUnique({
            where: { id: context.companyId },
            select: { pixKey: true, pixKeyType: true },
        });

        const totalFormatado = totalGeral.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

        // Se não tem PIX configurado
        if (!company?.pixKey) {
            return {
                success: true,
                message: `🚚 *Opções de entrega:*

• *Transportadora* - Enviamos para todo Brasil
• *Frete grátis* acima de R$ 299,00
• *Van* - Para algumas regiões
• *Motoboy* - Entregas em Castanhal
• *Retirada* - Sem custo na loja

${totalGeral > 0 ? `💰 *Subtotal:* ${totalFormatado}\n\n` : ""}Como você prefere receber? 😊`,
                data: {
                    tipoEntrega: null,
                    deliveryOptions: ["TRANSPORTADORA", "VAN", "MOTOBOY", "PICKUP"],
                    totalAmount: totalGeral,
                    needsPixSetup: true,
                },
            };
        }

        const tipoChave = company.pixKeyType || "Chave";

        return {
            success: true,
            message: `🚚 *Opções de entrega:*

• *Transportadora* - Enviamos para todo Brasil
• *Frete grátis* acima de R$ 299,00
• *Van* - Para algumas regiões
• *Motoboy* - Entregas em Castanhal
• *Retirada* - Sem custo na loja
${totalGeral > 0 ? `
💰 *Subtotal:* ${totalFormatado}` : ""}

Como você prefere receber? 🛵🏪`,
            data: {
                tipoEntrega: null,
                deliveryOptions: ["TRANSPORTADORA", "VAN", "MOTOBOY", "PICKUP"],
                totalAmount: totalGeral,
                pixKey: company.pixKey,
            },
        };
    } catch (error) {
        console.error("[AI Functions] Error in coletarEnderecoEntrega:", error);
        return {
            success: true,
            message: `🚚 Fazemos entrega sim! Temos transportadora, van e motoboy. Também temos retirada na loja. Como você prefere?`,
            data: { deliveryOptions: ["TRANSPORTADORA", "VAN", "MOTOBOY", "PICKUP"] },
        };
    }
}

/**
 * Finaliza a conversa com despedida personalizada
 * 
 * - Gera mensagem de despedida baseada no contexto
 * - Atualiza status da conversa para CLOSED  
 * - Dispara webhook CONVERSATION_CLOSED
 */
async function finalizarConversa(
    args: Record<string, unknown>,
    context: FunctionContext
): Promise<FunctionResult> {
    const nomeCliente = args.nomeCliente as string | undefined;
    const resumoConversa = args.resumoConversa as string || "sua solicitação";
    const tipoFarewell = args.tipoFarewell as string || "BRIEF";

    try {
        // Buscar dados da conversa
        const conversation = await prisma.conversation.findUnique({
            where: { id: context.conversationId },
            select: {
                customerPhone: true,
                customerName: true,
            },
        });

        if (!conversation) {
            return {
                success: false,
                message: "Qualquer coisa é só chamar! 😊",
            };
        }

        // Usar nome do cliente se disponível
        const nome = nomeCliente || conversation.customerName;

        // Atualizar status da conversa para CLOSED
        await prisma.conversation.update({
            where: { id: context.conversationId },
            data: {
                status: "CLOSED",
            },
        });

        // Log de finalização
        await prisma.auditLog.create({
            data: {
                action: "AI_CONVERSATION_CLOSED",
                entity: "Conversation",
                entityId: context.conversationId,
                companyId: context.companyId,
                changes: JSON.stringify({
                    closedBy: "AI",
                    farewellType: tipoFarewell,
                    summary: resumoConversa,
                }),
                userEmail: "system@ai",
            },
        });

        // Dispatch CONVERSATION_CLOSED webhook
        dispatchWebhook(context.companyId, "MESSAGE_RECEIVED", {
            type: "CONVERSATION_CLOSED",
            conversationId: context.conversationId,
            customerPhone: conversation.customerPhone,
            customerName: nome,
            summary: resumoConversa,
            closedBy: "AI",
            farewellType: tipoFarewell,
            timestamp: new Date().toISOString(),
        }).catch((err) => console.error("[Webhook] CONVERSATION_CLOSED failed:", err));

        // Gerar mensagem de despedida personalizada baseada no tipo
        let despedida = "";

        if (tipoFarewell === "THANKING") {
            // Cliente agradeceu
            despedida = nome
                ? `Por nada, ${nome}! 😊 Foi um prazer te ajudar${resumoConversa !== "sua solicitação" ? ` com ${resumoConversa}` : ""}!\n\nSempre que precisar, é só chamar! 🙌`
                : `Por nada! 😊 Foi um prazer ajudar${resumoConversa !== "sua solicitação" ? ` com ${resumoConversa}` : ""}!\n\nSempre que precisar, estou aqui! 🙌`;
        } else if (tipoFarewell === "GOODBYE") {
            // Cliente se despediu
            despedida = nome
                ? `Tchau, ${nome}! 👋\n\nFoi ótimo falar com você! Qualquer coisa sobre ${resumoConversa}, é só chamar!\n\nAté a próxima! 😊`
                : `Tchau! 👋 Até a próxima!\n\nQualquer coisa é só chamar! 😊`;
        } else if (tipoFarewell === "CONFIRMATION") {
            // Cliente confirmou que era só isso
            despedida = nome
                ? `Perfeito, ${nome}! 😊\n\nSe precisar de mais alguma coisa${resumoConversa !== "sua solicitação" ? ` sobre ${resumoConversa} ou` : ","} qualquer outra ajuda, é só mandar mensagem!\n\nAbraço! 🤗`
                : `Perfeito! Se precisar de mais alguma coisa, é só chamar! 😊`;
        } else {
            // Resposta breve genérica
            despedida = nome
                ? `Beleza, ${nome}! 😊 Qualquer coisa, é só chamar!\n\nAté mais! 👋`
                : `Beleza! Qualquer coisa, é só chamar! 😊`;
        }

        return {
            success: true,
            message: despedida,
            data: {
                conversationClosed: true,
                farewellType: tipoFarewell,
            },
        };
    } catch (error) {
        console.error("[AI Functions] Error in finalizarConversa:", error);
        return {
            success: true,
            message: "Qualquer coisa é só chamar! 😊",
            data: { conversationClosed: false },
        };
    }
}

// ============================================
// FUNCTION EXECUTOR
// ============================================

const FUNCTION_MAP: Record<string, (args: Record<string, unknown>, ctx: FunctionContext) => Promise<FunctionResult>> = {
    buscarProduto,
    verificarDisponibilidade,
    transferirParaHumano,
    registrarInteresse,
    processarVenda,
    solicitarVerificacao,
    agendarReuniao,
    agendarConsulta,
    solicitarOrcamento,
    capturarLead,
    enviarDocumento,
    coletarEnderecoEntrega,
    finalizarConversa,
};

/**
 * Executa uma função chamada pela IA
 */
export async function executeFunction(
    functionName: string,
    args: Record<string, unknown>,
    context: FunctionContext
): Promise<FunctionResult> {
    const fn = FUNCTION_MAP[functionName];

    if (!fn) {
        console.error(`[AI Functions] Unknown function: ${functionName}`);
        return {
            success: false,
            message: "Função não disponível.",
        };
    }

    console.log(`[AI Functions] Executing ${functionName}`, args);
    return fn(args, context);
}
