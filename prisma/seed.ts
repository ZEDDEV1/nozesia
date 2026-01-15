import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
    console.log("🌱 Seeding database for NozesIA...");

    // Criar plano único para NozesIA (ilimitado)
    const nozesiaPlan = await prisma.plan.upsert({
        where: { type: "ENTERPRISE" },
        update: {
            name: "NozesIA",
            price: 0, // Cliente único, sem cobrança
            maxWhatsAppNumbers: 10,
            maxAgents: 10,
            maxMessagesMonth: -1,
            maxTokensMonth: -1, // Ilimitado
            maxProducts: -1,
            maxTemplates: -1,
            maxCampaignsMonth: -1,
            maxWebhooks: 0, // Desabilitado
            maxDeliveryZones: -1,
            maxTeamMembers: 10,
            maxCreativesMonth: -1,
            features: JSON.stringify([
                "Sistema exclusivo NozesIA",
                "Agentes de IA ilimitados",
                "WhatsApps ilimitados",
                "Tokens ilimitados",
                "Produtos ilimitados",
                "Campanhas ilimitadas",
                "CRM completo",
                "Analytics avançado",
            ]),
            allowAudio: true,
            allowVoice: true,
            allowHumanTransfer: true,
            allowApiAccess: true,
            allowWhiteLabel: true,
            allowAnalytics: true,
            allowCRM: true,
            allowDeals: true,
            allowCampaigns: true,
            allowAutoRecovery: true,
        },
        create: {
            name: "NozesIA",
            type: "ENTERPRISE",
            price: 0,
            maxWhatsAppNumbers: 10,
            maxAgents: 10,
            maxMessagesMonth: -1,
            maxTokensMonth: -1,
            maxProducts: -1,
            maxTemplates: -1,
            maxCampaignsMonth: -1,
            maxWebhooks: 0,
            maxDeliveryZones: -1,
            maxTeamMembers: 10,
            maxCreativesMonth: -1,
            features: JSON.stringify([
                "Sistema exclusivo NozesIA",
                "Agentes de IA ilimitados",
                "WhatsApps ilimitados",
                "Tokens ilimitados",
                "Produtos ilimitados",
                "Campanhas ilimitadas",
                "CRM completo",
                "Analytics avançado",
            ]),
            allowAudio: true,
            allowVoice: true,
            allowHumanTransfer: true,
            allowApiAccess: true,
            allowWhiteLabel: true,
            allowAnalytics: true,
            allowCRM: true,
            allowDeals: true,
            allowCampaigns: true,
            allowAutoRecovery: true,
            extraAgentPrice: 0,
            extraWhatsAppPrice: 0,
        },
    });
    console.log("✅ Plano NozesIA criado");

    // Criar empresa NozesIA
    const company = await prisma.company.upsert({
        where: { email: "contato@nozesia.com" },
        update: {},
        create: {
            name: "NozesIA",
            email: "contato@nozesia.com",
            status: "ACTIVE",
            niche: "Loja de Roupas",
            description: "Loja de roupas e moda com atendimento inteligente via WhatsApp. Oferecemos peças femininas e masculinas em diversos tamanhos e estilos.",
            aiEnabled: true,
            timezone: "America/Sao_Paulo",
            settings: "{}",
            enabledModules: JSON.stringify([
                "analytics",
                "products",
                "orders",
                "interests",
                "crm",
                "campaigns",
                "templates",
            ]),
        },
    });
    console.log("✅ Empresa NozesIA criada");

    // Criar assinatura ativa
    await prisma.subscription.upsert({
        where: { companyId: company.id },
        update: {},
        create: {
            companyId: company.id,
            planId: nozesiaPlan.id,
            status: "ACTIVE",
            currentPeriodStart: new Date(),
            currentPeriodEnd: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // 1 ano
        },
    });
    console.log("✅ Assinatura criada");

    // Criar Super Admin
    const hashedAdminPassword = await bcrypt.hash("admin123", 12);
    await prisma.user.upsert({
        where: { email: "admin@nozesia.com" },
        update: {},
        create: {
            email: "admin@nozesia.com",
            password: hashedAdminPassword,
            name: "Administrador NozesIA",
            role: "SUPER_ADMIN",
        },
    });
    console.log("✅ Super Admin criado");
    console.log("   📧 Email: admin@nozesia.com");
    console.log("   🔑 Senha: admin123");

    // Criar usuário da empresa
    const hashedUserPassword = await bcrypt.hash("nozesia123", 12);
    await prisma.user.upsert({
        where: { email: "loja@nozesia.com" },
        update: {},
        create: {
            email: "loja@nozesia.com",
            password: hashedUserPassword,
            name: "Gerente NozesIA",
            role: "COMPANY_ADMIN",
            companyId: company.id,
            emailVerified: true,
            onboardingCompleted: true,
        },
    });
    console.log("✅ Usuário da loja criado");
    console.log("   📧 Email: loja@nozesia.com");
    console.log("   🔑 Senha: nozesia123");

    // Criar agente de IA para loja de roupas
    await prisma.aIAgent.upsert({
        where: {
            id: "nozesia-agent-default",
        },
        update: {},
        create: {
            id: "nozesia-agent-default",
            companyId: company.id,
            name: "Vendedora Virtual",
            description: "Atendente especializada em moda e roupas",
            personality: `Você é uma vendedora simpática e fashionista da loja NozesIA.
Você adora ajudar clientes a encontrar o look perfeito!
Seja amigável, use linguagem informal mas profissional.
Sempre pergunte sobre tamanho e cor preferida.
Sugira combinações de peças quando apropriado.`,
            tone: "simpático e fashionista",
            language: "pt-BR",
            canSell: true,
            canNegotiate: false,
            canSchedule: false,
            transferToHuman: true,
            isActive: true,
            isDefault: true,
        },
    });
    console.log("✅ Agente de IA criado");

    // Criar categorias de roupas
    const categories = [
        { name: "Camisetas", order: 1 },
        { name: "Blusas", order: 2 },
        { name: "Calças", order: 3 },
        { name: "Bermudas", order: 4 },
        { name: "Shorts", order: 5 },
        { name: "Vestidos", order: 6 },
        { name: "Saias", order: 7 },
        { name: "Jaquetas", order: 8 },
        { name: "Casacos", order: 9 },
        { name: "Acessórios", order: 10 },
    ];

    for (const cat of categories) {
        await prisma.category.upsert({
            where: {
                companyId_name: {
                    companyId: company.id,
                    name: cat.name,
                },
            },
            update: {},
            create: {
                companyId: company.id,
                name: cat.name,
                order: cat.order,
                isActive: true,
            },
        });
    }
    console.log("✅ Categorias de roupas criadas");

    console.log("\n🎉 Seed NozesIA completed successfully!");
    console.log("\n📋 Acesse o sistema:");
    console.log("   🔐 Admin: admin@nozesia.com / admin123");
    console.log("   👔 Loja: loja@nozesia.com / nozesia123");
}

main()
    .catch((e) => {
        console.error("❌ Seed failed:", e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
