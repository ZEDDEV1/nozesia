/**
 * API: Delete User Data (LGPD)
 * 
 * Endpoint para exclusão de dados do usuário conforme a LGPD.
 * DELETE /api/users/me/data
 */

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { logger } from "@/lib/logger";

export async function DELETE() {
    try {
        const user = await getCurrentUser();

        if (!user) {
            return NextResponse.json(
                { success: false, error: "Não autenticado" },
                { status: 401 }
            );
        }

        const { id: userId, companyId } = user;

        logger.security("LGPD: Data deletion requested", { userId, companyId: companyId ?? undefined });

        // Inicia uma transação para deletar todos os dados relacionados
        await prisma.$transaction(async (tx) => {
            // 1. Deletar mensagens das conversas da empresa
            if (companyId) {
                const conversations = await tx.conversation.findMany({
                    where: { companyId },
                    select: { id: true }
                });
                const conversationIds = conversations.map(c => c.id);

                await tx.message.deleteMany({
                    where: { conversationId: { in: conversationIds } }
                });

                // 2. Deletar conversas
                await tx.conversation.deleteMany({
                    where: { companyId }
                });

                // 3. Deletar pedidos
                await tx.order.deleteMany({
                    where: { companyId }
                });

                // 4. Deletar dados de treinamento
                await tx.trainingData.deleteMany({
                    where: { agent: { companyId } }
                });

                // 6. Deletar agentes
                await tx.aIAgent.deleteMany({
                    where: { companyId }
                });

                // 7. Deletar produtos
                await tx.product.deleteMany({
                    where: { companyId }
                });

                // 8. Deletar categorias
                await tx.category.deleteMany({
                    where: { companyId }
                });

                // 9. Deletar memórias de clientes
                await tx.customerMemory.deleteMany({
                    where: { companyId }
                });

                // 10. Deletar sessões WhatsApp
                await tx.whatsAppSession.deleteMany({
                    where: { companyId }
                });

                // 11. Deletar webhooks
                await tx.webhook.deleteMany({
                    where: { companyId }
                });

                // 12. Deletar tokens de uso
                await tx.tokenUsage.deleteMany({
                    where: { companyId }
                });

                // 13. Deletar deals do CRM
                await tx.deal.deleteMany({
                    where: { companyId }
                });

                // 14. Deletar invoices
                await tx.invoice.deleteMany({
                    where: { companyId }
                });

                // 15. Deletar assinaturas
                await tx.subscription.deleteMany({
                    where: { companyId }
                });

                // 16. Deletar integrações
                await tx.googleCalendarIntegration.deleteMany({
                    where: { companyId }
                });

                // 17. Deletar zonas de entrega
                await tx.deliveryZone.deleteMany({
                    where: { companyId }
                });

                // 18. Deletar templates
                await tx.messageTemplate.deleteMany({
                    where: { companyId }
                });

                // 19. Deletar tags
                await tx.tag.deleteMany({
                    where: { companyId }
                });

                // 20. Deletar audit logs
                await tx.auditLog.deleteMany({
                    where: { companyId }
                });

                // 21. Deletar appointments
                await tx.appointment.deleteMany({
                    where: { companyId }
                });
            }

            // 22. Deletar verificações de email do usuário
            await tx.verificationToken.deleteMany({
                where: { userId }
            });

            // 23. Deletar o usuário
            await tx.user.delete({
                where: { id: userId }
            });

            // 24. Deletar a empresa (se for o único membro)
            if (companyId) {
                const remainingUsers = await tx.user.count({
                    where: { companyId }
                });

                if (remainingUsers === 0) {
                    await tx.company.delete({
                        where: { id: companyId }
                    });
                }
            }
        });

        logger.security("LGPD: Data deletion completed", { userId, companyId: companyId ?? undefined });

        return NextResponse.json({
            success: true,
            message: "Todos os seus dados foram excluídos permanentemente."
        });

    } catch (error) {
        logger.error("LGPD: Data deletion failed", { error });

        return NextResponse.json(
            {
                success: false,
                error: "Erro ao excluir dados. Entre em contato com o suporte."
            },
            { status: 500 }
        );
    }
}

// GET - Informações sobre exclusão de dados
export async function GET() {
    try {
        const user = await getCurrentUser();

        if (!user) {
            return NextResponse.json(
                { success: false, error: "Não autenticado" },
                { status: 401 }
            );
        }

        // Retorna informações sobre os dados armazenados
        const dataInfo = {
            userId: user.id,
            companyId: user.companyId,
            dataTypes: [
                "Dados de perfil (nome, email, telefone)",
                "Conversas e mensagens",
                "Pedidos e transações",
                "Agentes de IA e treinamentos",
                "Produtos e catálogos",
                "Contatos e CRM",
                "Histórico de uso e métricas"
            ],
            warning: "A exclusão é permanente e não pode ser desfeita.",
            steps: [
                "1. Faça backup de qualquer dado importante",
                "2. Cancele sua assinatura (se houver)",
                "3. Confirme a exclusão",
                "4. Todos os dados serão removidos imediatamente"
            ]
        };

        return NextResponse.json({
            success: true,
            data: dataInfo
        });

    } catch (error) {
        logger.error("Error getting data info", { error });
        return NextResponse.json(
            { success: false, error: "Erro interno" },
            { status: 500 }
        );
    }
}
