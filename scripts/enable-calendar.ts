/**
 * Script para ativar allowCalendar nos planos Basic, Pro e Enterprise
 * Execute com: npx tsx scripts/enable-calendar.ts
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
    console.log("🗓️ Atualizando planos para incluir allowCalendar...\n");

    const result = await prisma.plan.updateMany({
        where: {
            type: {
                in: ["BASIC", "PRO", "ENTERPRISE"]
            }
        },
        data: {
            allowCalendar: true
        }
    });

    console.log(`✅ ${result.count} plano(s) atualizado(s) com allowCalendar = true`);

    // Listar planos atualizados
    const plans = await prisma.plan.findMany({
        select: {
            name: true,
            type: true,
            allowCalendar: true,
            allowAnalytics: true,
        }
    });

    console.log("\n📋 Status atual dos planos:");
    console.table(plans);
}

main()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
