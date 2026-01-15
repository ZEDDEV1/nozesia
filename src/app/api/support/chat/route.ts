import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { successResponse, errorResponse, handleApiError } from "@/lib/api-response";
import openai from "@/lib/openai";
import { logger } from "@/lib/logger";

// Base de conhecimento inline (pode ser movida para DB depois)
const KNOWLEDGE_BASE = `
# NozesIA - Base de Conhecimento do Suporte

## Conectar WhatsApp
1. Vá em Dashboard > WhatsApp
2. Clique em "Conectar Nova Sessão"
3. Escaneie o QR Code com seu celular
4. Aguarde a conexão ser estabelecida (status verde)

## Criar Agente de IA
1. Vá em Dashboard > Agentes
2. Clique em "Novo Agente"
3. Preencha nome e personalidade
4. Selecione qual sessão WhatsApp ele vai atender
5. Clique em Salvar

## Cadastrar Produtos/Cardápio
1. Vá em Dashboard > Produtos
2. Clique em "Novo Produto"
3. Preencha nome, descrição e preço
4. Adicione categorias se necessário
5. Salve e a IA já vai conhecer o produto

## Configurar Zonas de Entrega
1. Vá em Dashboard > Zonas de Entrega
2. Adicione bairros com nome e taxa
3. A IA vai calcular automaticamente a taxa pelo bairro

## Configurar PIX
1. Vá em Dashboard > Configurações
2. Na seção PIX, escolha o tipo de chave
3. Digite sua chave PIX
4. Salve. A IA vai usar essa chave para pagamentos.

## Ver Pedidos/Vendas
1. Vá em Dashboard > Pedidos
2. Veja todos os pedidos pendentes e finalizados
3. Clique em um pedido para ver detalhes
4. Aprove comprovantes de pagamento

## Problema: WhatsApp Desconectou
1. Vá em Dashboard > WhatsApp
2. Clique no botão "Reconectar"
3. Se não funcionar, delete a sessão e crie uma nova
4. Escaneie o QR Code novamente

## Problema: IA Não Responde
1. Verifique se o agente está ativo
2. Verifique se a sessão WhatsApp está conectada
3. No topo da página de Conversas, verifique se o toggle "IA Ativa" está ligado
4. Se persistir, fale com suporte humano

## Limite de Tokens
- Cada resposta da IA consome tokens
- Veja seu consumo em Dashboard > principal
- Se acabar, você pode aguardar o próximo mês ou fazer upgrade

## Trocar de Plano
1. Vá em Dashboard > Assinatura
2. Veja os planos disponíveis
3. Clique em "Fazer Upgrade"
4. Complete o pagamento

## Preciso de Suporte Humano
Se você precisar falar com uma pessoa real, é só me dizer "quero falar com suporte humano" que eu vou te transferir.
`;

// GET - Carregar histórico do ticket atual
export async function GET() {
    try {
        const user = await getCurrentUser();
        if (!user) {
            return NextResponse.json(errorResponse("Não autenticado"), { status: 401 });
        }

        // Buscar ticket ativo do usuário
        const activeTicket = await prisma.supportTicket.findFirst({
            where: {
                userId: user.id,
                status: { in: ["AI_HANDLING", "HUMAN_HANDLING", "WAITING_USER"] },
            },
            orderBy: { createdAt: "desc" },
            include: {
                messages: {
                    orderBy: { createdAt: "asc" },
                },
            },
        });

        if (!activeTicket) {
            return NextResponse.json(successResponse({ ticketId: null, messages: [] }));
        }

        return NextResponse.json(successResponse({
            ticketId: activeTicket.id,
            messages: activeTicket.messages.map(m => ({
                id: m.id,
                sender: m.sender,
                content: m.content,
                createdAt: m.createdAt.toISOString(),
                actionType: m.actionType,
                actionData: m.actionData,
            })),
        }));
    } catch (error) {
        return NextResponse.json(handleApiError(error), { status: 500 });
    }
}

// POST - Enviar mensagem e obter resposta da IA
export async function POST(request: Request) {
    try {
        const user = await getCurrentUser();
        if (!user || !user.companyId) {
            return NextResponse.json(errorResponse("Não autenticado"), { status: 401 });
        }

        const { message, ticketId } = await request.json();

        if (!message?.trim()) {
            return NextResponse.json(errorResponse("Mensagem vazia"), { status: 400 });
        }

        // Buscar ou criar ticket
        let ticket;
        if (ticketId) {
            ticket = await prisma.supportTicket.findUnique({
                where: { id: ticketId },
                include: { messages: { orderBy: { createdAt: "asc" }, take: 20 } },
            });
        }

        if (!ticket) {
            ticket = await prisma.supportTicket.create({
                data: {
                    companyId: user.companyId,
                    userId: user.id,
                    status: "AI_HANDLING",
                    priority: "NORMAL",
                },
                include: { messages: true },
            });
            logger.info("[NozesSupport] New ticket created", { ticketId: ticket.id, userId: user.id });
        }

        // Salvar mensagem do usuário
        await prisma.supportMessage.create({
            data: {
                ticketId: ticket.id,
                sender: "USER",
                content: message,
            },
        });

        // Se ticket está em atendimento humano, não gerar resposta IA
        if (ticket.status === "HUMAN_HANDLING") {
            return NextResponse.json(successResponse({
                ticketId: ticket.id,
                response: "Sua mensagem foi enviada para o suporte. Aguarde a resposta.",
                messageId: null,
            }));
        }

        // Verificar se quer falar com humano
        const lowerMsg = message.toLowerCase();
        if (
            lowerMsg.includes("falar com humano") ||
            lowerMsg.includes("suporte humano") ||
            lowerMsg.includes("atendente real") ||
            lowerMsg.includes("pessoa real")
        ) {
            await prisma.supportTicket.update({
                where: { id: ticket.id },
                data: { status: "HUMAN_HANDLING", priority: "HIGH" },
            });

            const aiMessage = await prisma.supportMessage.create({
                data: {
                    ticketId: ticket.id,
                    sender: "AI",
                    content: "Entendi! Estou transferindo você para o suporte humano. Alguém da nossa equipe vai te responder em breve. 🙏",
                },
            });

            logger.info("[LumusSupport] Escalated to human", { ticketId: ticket.id });

            return NextResponse.json(successResponse({
                ticketId: ticket.id,
                response: aiMessage.content,
                messageId: aiMessage.id,
                escalated: true,
            }));
        }

        // Construir histórico para contexto
        const conversationHistory = ticket.messages.slice(-10).map(m => ({
            role: m.sender === "USER" ? "user" as const : "assistant" as const,
            content: m.content,
        }));

        // Buscar contexto do usuário (sessões, agentes, etc.)
        const [sessions, agents] = await Promise.all([
            prisma.whatsAppSession.findMany({
                where: { companyId: user.companyId },
                select: { status: true, sessionName: true },
            }),
            prisma.aIAgent.findMany({
                where: { companyId: user.companyId },
                select: { name: true, isActive: true },
            }),
        ]);

        const userContext = `
CONTEXTO DO USUÁRIO:
- Nome: ${user.name || "Usuário"}
- Email: ${user.email}
- Sessões WhatsApp: ${sessions.length > 0 ? sessions.map(s => `${s.sessionName} (${s.status})`).join(", ") : "Nenhuma"}
- Agentes: ${agents.length > 0 ? agents.map(a => `${a.name} (${a.isActive ? "ativo" : "inativo"})`).join(", ") : "Nenhum"}
`;

        // Buscar base de conhecimento do banco
        const knowledgeItems = await prisma.supportKnowledge.findMany({
            where: { isActive: true },
            orderBy: { category: "asc" },
        });

        const knowledgeBase = knowledgeItems.length > 0
            ? knowledgeItems.map(k => `## ${k.question}\n${k.answer}`).join("\n\n")
            : KNOWLEDGE_BASE; // Fallback para inline se DB estiver vazio

        // Chamar OpenAI
        const completion = await openai.chat.completions.create({
            model: "gpt-4o-mini",
            messages: [
                {
                    role: "system",
                    content: `Você é a Nozes, assistente de suporte da NozesIA.
Sua missão é ajudar usuários com dúvidas sobre a plataforma.

REGRAS:
- Responda APENAS em português do Brasil
- Seja simpática, prestativa e direta
- Use emojis moderadamente para ser amigável
- Se não souber a resposta, sugira falar com suporte humano
- Para problemas técnicos graves, sugira suporte humano

# Base de Conhecimento
${knowledgeBase}

${userContext}

Se o problema for técnico (WhatsApp desconectado, etc.), você pode sugerir ações como:
- RECONNECT_WHATSAPP: Para reconectar o WhatsApp
- OPEN_PAGE:/dashboard/agents: Para ir para página de agentes
- OPEN_PAGE:/dashboard/settings: Para configurações

Para sugerir uma ação, termine sua resposta com [AÇÃO:TIPO:DADOS]
Exemplo: [AÇÃO:OPEN_PAGE:/dashboard/whatsapp]`,
                },
                ...conversationHistory,
                { role: "user", content: message },
            ],
            max_tokens: 500,
            temperature: 0.7,
        });

        let aiResponse = completion.choices[0]?.message?.content || "Desculpe, não entendi. Pode reformular?";

        // Extrair ação se houver
        let actionType: string | null = null;
        let actionData: string | null = null;

        const actionMatch = aiResponse.match(/\[AÇÃO:(\w+):([^\]]+)\]/);
        if (actionMatch) {
            actionType = actionMatch[1];
            actionData = actionMatch[2];
            aiResponse = aiResponse.replace(actionMatch[0], "").trim();
        }

        // Detectar categoria automaticamente
        let category = ticket.category;
        if (!category) {
            if (lowerMsg.includes("whatsapp") || lowerMsg.includes("conectar") || lowerMsg.includes("qr")) {
                category = "WHATSAPP";
            } else if (lowerMsg.includes("agente") || lowerMsg.includes("ia") || lowerMsg.includes("bot")) {
                category = "AGENTS";
            } else if (lowerMsg.includes("plano") || lowerMsg.includes("pagar") || lowerMsg.includes("upgrade")) {
                category = "BILLING";
            } else if (lowerMsg.includes("produto") || lowerMsg.includes("cardápio")) {
                category = "PRODUCTS";
            } else {
                category = "OTHER";
            }

            await prisma.supportTicket.update({
                where: { id: ticket.id },
                data: { category },
            });
        }

        // Salvar resposta da IA
        const aiMessage = await prisma.supportMessage.create({
            data: {
                ticketId: ticket.id,
                sender: "AI",
                content: aiResponse,
                actionType,
                actionData,
            },
        });

        logger.info("[LumusSupport] AI response sent", {
            ticketId: ticket.id,
            hasAction: !!actionType,
        });

        return NextResponse.json(successResponse({
            ticketId: ticket.id,
            response: aiResponse,
            messageId: aiMessage.id,
            actionType,
            actionData,
        }));

    } catch (error) {
        logger.error("[LumusSupport] Error", { error });
        return NextResponse.json(handleApiError(error), { status: 500 });
    }
}
