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
            description: `Busca peças de roupa/acessórios no catálogo e ENVIA A FOTO automaticamente.
            
✅ SEMPRE USE quando cliente:
- Perguntar sobre uma peça ("tem camiseta?", "vocês têm vestido?")
- Quiser ver fotos ("manda foto da calça", "quero ver as blusas")
- Perguntar preço ("quanto é a jaqueta?")
- Pedir uma COR ESPECÍFICA ("quero ver o marrom", "manda a azul")

⚠️ IMPORTANTE: Se o cliente mencionar uma COR, SEMPRE passe no parâmetro 'cor'!

Exemplos:
- "manda foto da camiseta" → buscarProduto(termo: "camiseta")
- "tem vestido?" → buscarProduto(termo: "vestido")
- "quero ver o agasalho marrom" → buscarProduto(termo: "agasalho", cor: "marrom")
- "manda a calça preta" → buscarProduto(termo: "calça", cor: "preta")
- "quero ver o azul escuro" → buscarProduto(termo: "[produto anterior]", cor: "azul escuro")`,
            parameters: {
                type: "object",
                properties: {
                    termo: {
                        type: "string",
                        description: "Nome da peça: 'camiseta', 'vestido', 'calça', 'agasalho', 'blusa', etc."
                    },
                    cor: {
                        type: "string",
                        description: "Cor ESPECÍFICA se o cliente mencionar: 'marrom', 'azul', 'preto', 'azul escuro', 'off white', etc. SEMPRE preencha quando o cliente pedir uma cor!"
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
- NÃO oferecemos entrega, apenas RETIRADA NA LOJA!
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
            description: `Informa sobre retirada na loja.

⚠️ IMPORTANTE: Trabalhamos APENAS com RETIRADA NA LOJA!
NÃO fazemos entrega!

Use quando cliente perguntar sobre:
- "Vocês entregam?"
- "Faz entrega?"
- "Qual o frete?"
- "Como recebo o produto?"

Resposta padrão: "Trabalhamos apenas com retirada na loja!"`,
            parameters: {
                type: "object",
                properties: {
                    tipoEntrega: {
                        type: "string",
                        enum: ["PICKUP"],
                        description: "Sempre PICKUP - trabalhamos só com retirada"
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








async function buscarProduto(
    args: Record<string, unknown>,
    context: FunctionContext
): Promise<FunctionResult> {
    const termo = (args.termo as string || "").toLowerCase().trim();
    const cor = (args.cor as string || "").toLowerCase().trim();

    if (!termo) {
        return {
            success: false,
            message: "Me diz o nome do produto que você procura! 😊",
        };
    }

    try {
        // 1. Buscar na tabela Product (prioridade)
        // Primeiro tenta busca exata/parcial com o termo completo
        let products = await prisma.product.findMany({
            where: {
                companyId: context.companyId,
                isActive: true,
                OR: [
                    { name: { contains: termo, mode: "insensitive" } },
                    { description: { contains: termo, mode: "insensitive" } },
                    { category: { name: { contains: termo, mode: "insensitive" } } },
                ],
            },
            include: {
                category: { select: { name: true } },
            },
            take: 10, // Buscar mais resultados para melhor matching por cor
            orderBy: { name: "asc" },
        });

        // 2. Se não encontrou, buscar por palavras individuais
        if (products.length === 0) {
            const palavras = termo.split(/\s+/).filter(p => p.length >= 3);

            if (palavras.length > 0) {
                products = await prisma.product.findMany({
                    where: {
                        companyId: context.companyId,
                        isActive: true,
                        OR: palavras.flatMap(palavra => [
                            { name: { contains: palavra, mode: "insensitive" } },
                            { description: { contains: palavra, mode: "insensitive" } },
                        ]),
                    },
                    include: {
                        category: { select: { name: true } },
                    },
                    take: 10,
                    orderBy: { name: "asc" },
                });

                if (products.length > 0) {
                    console.log(`[AI Functions] Produto encontrado por busca de palavras: "${palavras.join(", ")}" → ${products[0].name}`);
                }
            }
        }

        // 3. Se cor foi especificada, priorizar produtos que contenham essa cor
        if (cor && products.length > 1) {
            const productWithColor = products.find(p =>
                p.name.toLowerCase().includes(cor) ||
                (p.description?.toLowerCase().includes(cor) ?? false)
            );

            if (productWithColor) {
                // Reordenar para que o produto com a cor apareça primeiro
                products = [productWithColor, ...products.filter(p => p.id !== productWithColor.id)];
                console.log(`[AI Functions] Produto priorizado por cor "${cor}": ${productWithColor.name}`);
            } else {
                console.log(`[AI Functions] Nenhum produto encontrado com cor "${cor}" - usando primeiro resultado`);
            }
        }

        // Se encontrou produtos cadastrados
        if (products.length > 0) {
            // Limitar a 5 resultados para exibição
            products = products.slice(0, 5);
            const bestMatch = products[0];
            const priceFormatted = bestMatch.price.toLocaleString("pt-BR", {
                style: "currency",
                currency: "BRL",
            });

            // Se tem imagem, sinaliza para enviar
            const hasImage = !!bestMatch.imageUrl;

            // Montar lista de produtos se houver mais de um
            const productList = products.length > 1
                ? "\n\n📦 *Outros resultados:*\n" + products.slice(1).map((p: typeof products[0]) => {
                    const pFormatted = p.price.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
                    return `• ${p.name} - ${pFormatted}`;
                }).join("\n")
                : "";

            // Verificar estoque
            let stockInfo = "";
            let needsStockVerification = false;
            if (bestMatch.stockEnabled) {
                if (bestMatch.stockQuantity > 0) {
                    stockInfo = `\n✅ Temos ${bestMatch.stockQuantity} unidades em estoque!`;
                } else {
                    // NÃO dizer que está sem estoque - pedir verificação
                    stockInfo = "\n⏳ Deixa eu confirmar a disponibilidade...";
                    needsStockVerification = true;
                }
            }

            // 📐 Buscar tamanhos disponíveis
            let sizesInfo = "";
            let availableSizes: string[] = [];

            // 1. Primeiro, verificar se tem variantes com estoque (mais preciso)
            const variants = await prisma.productVariant.findMany({
                where: {
                    productId: bestMatch.id,
                    stock: { gt: 0 }
                },
                select: { size: true, stock: true }
            });

            if (variants.length > 0) {
                // Usar tamanhos das variantes com estoque
                availableSizes = [...new Set(variants.map(v => v.size))];
                sizesInfo = `\n📐 *Tamanhos disponíveis:* ${availableSizes.join(", ")}`;
                console.log(`[AI Functions] Tamanhos com estoque (variantes): ${availableSizes.join(", ")}`);
            } else if (bestMatch.sizes && bestMatch.sizes.length > 0) {
                // 2. Fallback: usar campo sizes do produto
                availableSizes = bestMatch.sizes;
                sizesInfo = `\n📐 *Tamanhos:* ${availableSizes.join(", ")}`;
                console.log(`[AI Functions] Tamanhos cadastrados (produto): ${availableSizes.join(", ")}`);
            }

            return {
                success: true,
                message: `Achei! 🎉\n\n📦 *${bestMatch.name}*\n💰 *Preço:* ${priceFormatted}${bestMatch.category ? `\n🏷️ Categoria: ${bestMatch.category.name}` : ""}${sizesInfo}${bestMatch.description ? `\n📝 ${bestMatch.description.substring(0, 150)}${bestMatch.description.length > 150 ? "..." : ""}` : ""}${stockInfo}${productList}\n\n*Deseja comprar?* Posso gerar o pedido pra você! 🛒`,
                data: {
                    found: true,
                    productId: bestMatch.id,
                    productName: bestMatch.name,
                    productPrice: bestMatch.price,
                    priceFormatted,
                    hasImage,
                    imageUrl: bestMatch.imageUrl,
                    sendProductImage: hasImage, // Flag para o worker enviar a imagem
                    stockAvailable: !bestMatch.stockEnabled || bestMatch.stockQuantity > 0,
                    stockQuantity: bestMatch.stockQuantity,
                    availableSizes, // Tamanhos disponíveis para a IA saber
                    needsStockVerification, // Nova flag para IA chamar solicitarVerificacao
                }
            };
        }

        // 2. Fallback: Buscar no TrainingData do agente
        const trainingData = await prisma.trainingData.findMany({
            where: {
                agentId: context.agentId,
                OR: [
                    { title: { contains: termo, mode: "insensitive" } },
                    { content: { contains: termo, mode: "insensitive" } },
                ],
                type: { in: ["PRODUCT", "FAQ", "QA"] }
            },
            take: 3,
        });

        if (trainingData.length === 0) {
            // NÃO dizer que não tem - retornar para IA chamar solicitarVerificacao
            return {
                success: true,
                message: `Boa pergunta sobre "${termo}"! Deixa eu verificar aqui...`,
                data: {
                    found: false,
                    needsVerification: true,
                    searchTerm: termo
                }
            };
        }

        const results = trainingData.map(td => ({
            titulo: td.title,
            info: td.content.substring(0, 200),
        }));

        return {
            success: true,
            message: `Achei algumas informações sobre "${termo}"! Vou te passar os detalhes.`,
            data: { found: true, results, fromTraining: true }
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
                message: `🏪 Trabalhamos apenas com *RETIRADA NA LOJA*!

${totalGeral > 0 ? `💰 *Total do pedido:* ${totalFormatado}\n\n` : ""}Vou verificar como você pode pagar e já te aviso! 😊`,
                data: {
                    tipoEntrega: "PICKUP",
                    noDelivery: true,
                    totalAmount: totalGeral,
                    needsPixSetup: true,
                },
            };
        }

        const tipoChave = company.pixKeyType || "Chave";

        return {
            success: true,
            message: `🏪 Trabalhamos apenas com *RETIRADA NA LOJA*!
${totalGeral > 0 ? `
💰 *Total:* ${totalFormatado}

💳 *PIX (${tipoChave}):* ${company.pixKey}

Quando pagar, me manda o comprovante aqui! 📱
Vou te avisar quando estiver pronto pra buscar.` : `
Quando você fechar seu pedido, te passo os dados pra pagamento! 😊`}`,
            data: {
                tipoEntrega: "PICKUP",
                noDelivery: true,
                totalAmount: totalGeral,
                pixKey: company.pixKey,
                awaitingProof: totalGeral > 0,
            },
        };
    } catch (error) {
        console.error("[AI Functions] Error in coletarEnderecoEntrega:", error);
        return {
            success: true,
            message: `🏪 Trabalhamos apenas com *RETIRADA NA LOJA*! Não fazemos entrega no momento.`,
            data: { tipoEntrega: "PICKUP", noDelivery: true },
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
