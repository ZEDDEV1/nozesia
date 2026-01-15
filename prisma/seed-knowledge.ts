import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const KNOWLEDGE_BASE = [
    // GETTING_STARTED
    {
        category: "GETTING_STARTED",
        question: "Como começar a usar o LumusAI?",
        answer: `Para começar a usar o LumusAI, siga estes passos:
1. Conecte seu WhatsApp em Dashboard > WhatsApp
2. Crie um Agente de IA em Dashboard > Agentes
3. Cadastre seus produtos/serviços em Dashboard > Produtos
4. Pronto! A IA já vai começar a atender seus clientes automaticamente.`,
        keywords: "começar,iniciar,primeiro,tutorial,guia,inicio",
    },
    {
        category: "GETTING_STARTED",
        question: "O que é o LumusAI?",
        answer: `O LumusAI é uma plataforma de atendimento automatizado via WhatsApp usando Inteligência Artificial.
Com ele você pode:
- Atender clientes 24/7 automaticamente
- Receber pedidos e pagamentos via PIX
- Agendar consultas e reuniões
- Responder dúvidas frequentes
- E muito mais!`,
        keywords: "lumus,plataforma,sobre,o que é,funciona",
    },

    // WHATSAPP
    {
        category: "WHATSAPP",
        question: "Como conectar o WhatsApp?",
        answer: `Para conectar seu WhatsApp:
1. Vá em Dashboard > WhatsApp
2. Clique em "Conectar Nova Sessão"
3. Dê um nome para a sessão (ex: "Atendimento Principal")
4. Escaneie o QR Code com seu celular
5. Aguarde a conexão (status ficará verde)

Dica: Use um número exclusivo para atendimento, não seu número pessoal.`,
        keywords: "conectar,whatsapp,qr,qrcode,sessão,vincular",
    },
    {
        category: "WHATSAPP",
        question: "Meu WhatsApp desconectou, o que fazer?",
        answer: `Se seu WhatsApp desconectou:
1. Vá em Dashboard > WhatsApp
2. Clique no botão "Reconectar" na sessão
3. Se não funcionar, delete a sessão e crie uma nova
4. Escaneie o QR Code novamente

Motivos comuns de desconexão:
- Celular ficou sem internet
- WhatsApp Web foi aberto em outro lugar
- Sessão expirou (normal após alguns dias)`,
        keywords: "desconectou,offline,reconectar,problema,erro,caiu",
    },

    // AGENTS
    {
        category: "AGENTS",
        question: "Como criar um agente de IA?",
        answer: `Para criar um agente:
1. Vá em Dashboard > Agentes
2. Clique em "Novo Agente"
3. Preencha o nome (ex: "Atendente Virtual")
4. Defina a personalidade (formal, descontraído, etc.)
5. Selecione qual sessão WhatsApp ele vai atender
6. Clique em Salvar

Dica: Você pode ter múltiplos agentes para diferentes propósitos.`,
        keywords: "agente,ia,criar,novo,bot,robô",
    },
    {
        category: "AGENTS",
        question: "A IA não está respondendo, o que fazer?",
        answer: `Se a IA não está respondendo, verifique:
1. O agente está ativo? (Dashboard > Agentes)
2. A sessão WhatsApp está conectada? (status verde)
3. O toggle "IA Ativa" está ligado? (topo da página Conversas)
4. Você tem tokens disponíveis? (Dashboard principal)

Se tudo estiver OK e ainda não funcionar, tente:
- Desativar e ativar o agente novamente
- Reconectar o WhatsApp`,
        keywords: "ia,responde,responder,parou,problema,erro,não funciona",
    },

    // PRODUCTS
    {
        category: "PRODUCTS",
        question: "Como cadastrar produtos/cardápio?",
        answer: `Para cadastrar produtos:
1. Vá em Dashboard > Produtos
2. Clique em "Novo Produto"
3. Preencha nome, descrição e preço
4. Adicione uma categoria (opcional)
5. Adicione imagem (opcional)
6. Clique em Salvar

A IA automaticamente vai conhecer seus produtos e responder perguntas sobre eles.`,
        keywords: "produto,cadastrar,cardápio,menu,item,adicionar",
    },
    {
        category: "PRODUCTS",
        question: "Como definir taxas de entrega por bairro?",
        answer: `Para configurar taxas de entrega:
1. Vá em Dashboard > Taxas de Entrega
2. Clique em "Adicionar Bairro"
3. Digite o nome do bairro
4. Defina o valor da taxa
5. Salve

A IA vai perguntar o bairro do cliente e calcular automaticamente a taxa.`,
        keywords: "entrega,taxa,bairro,frete,delivery",
    },

    // PIX
    {
        category: "PIX",
        question: "Como configurar o PIX?",
        answer: `Para configurar seu PIX:
1. Vá em Dashboard > Configurações
2. Na seção "Pagamentos", escolha o tipo de chave
3. Digite sua chave PIX (CPF, CNPJ, email, telefone ou aleatória)
4. Clique em Salvar

A IA vai usar essa chave para enviar dados de pagamento aos clientes.`,
        keywords: "pix,configurar,chave,pagamento,receber",
    },

    // BILLING
    {
        category: "BILLING",
        question: "Como ver meu consumo de tokens?",
        answer: `Para ver seu consumo:
1. Acesse o Dashboard principal
2. Veja o card "Tokens" com o consumo atual
3. Para mais detalhes, vá em Faturamento

Cada resposta da IA consome tokens. Quando acabar, você pode:
- Aguardar o próximo mês (reset automático)
- Fazer upgrade de plano`,
        keywords: "token,consumo,limite,quanto,ver",
    },
    {
        category: "BILLING",
        question: "Como fazer upgrade de plano?",
        answer: `Para fazer upgrade:
1. Vá em Dashboard > Faturamento
2. Veja os planos disponíveis
3. Clique em "Fazer Upgrade" no plano desejado
4. Complete o pagamento

Benefícios do upgrade:
- Mais tokens mensais
- Mais agentes de IA
- Mais sessões WhatsApp
- Funcionalidades avançadas`,
        keywords: "upgrade,plano,mudar,trocar,aumentar",
    },

    // ORDERS
    {
        category: "ORDERS",
        question: "Como ver meus pedidos?",
        answer: `Para ver pedidos:
1. Vá em Dashboard > Pedidos
2. Veja todos os pedidos com status
3. Filtre por status (Aguardando, Comprovante, etc.)
4. Clique em um pedido para ver detalhes

Você pode aprovar comprovantes de pagamento e marcar como entregue.`,
        keywords: "pedido,ver,encontrar,onde,lista",
    },
    {
        category: "ORDERS",
        question: "Como aprovar um comprovante de pagamento?",
        answer: `Para aprovar comprovante:
1. Vá em Dashboard > Pedidos
2. Encontre o pedido com status "Comprovante Enviado"
3. Clique no pedido para ver detalhes
4. Verifique o comprovante anexado
5. Clique em "Aprovar" se estiver correto

Após aprovar, o status muda para "Verificado".`,
        keywords: "comprovante,aprovar,verificar,pix,pagamento",
    },

    // SUPPORT
    {
        category: "SUPPORT",
        question: "Como falar com suporte humano?",
        answer: `Se precisar de ajuda humana:
1. Digite "quero falar com suporte humano"
2. Seu chat será transferido para nossa equipe
3. Aguarde a resposta (horário comercial)

Ou envie email para: suporte@lumusai.com`,
        keywords: "humano,pessoa,atendente,suporte,ajuda,real",
    },
];

async function seedKnowledgeBase() {
    console.log("🧠 Iniciando seed da base de conhecimento...\n");

    for (const item of KNOWLEDGE_BASE) {
        const existing = await prisma.supportKnowledge.findFirst({
            where: { question: item.question },
        });

        if (existing) {
            console.log(`⏭️  Pulando: "${item.question.substring(0, 40)}..."`);
            continue;
        }

        await prisma.supportKnowledge.create({
            data: {
                category: item.category,
                question: item.question,
                answer: item.answer,
                keywords: item.keywords,
                isActive: true,
            },
        });

        console.log(`✅ Adicionado: "${item.question.substring(0, 40)}..."`);
    }

    console.log("\n🎉 Base de conhecimento populada com sucesso!");
}

seedKnowledgeBase()
    .catch((e) => {
        console.error("Erro:", e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
