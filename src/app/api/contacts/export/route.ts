/**
 * API: Export Contacts to CSV
 * 
 * GET /api/contacts/export - Export all contacts as CSV
 */

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { errorResponse } from "@/lib/api-response";

export async function GET() {
    try {
        const user = await getCurrentUser();
        if (!user || !user.companyId) {
            return NextResponse.json(errorResponse("Não autorizado"), { status: 401 });
        }

        // Get unique phone numbers from conversations
        const conversations = await prisma.conversation.findMany({
            where: { companyId: user.companyId },
            select: {
                customerPhone: true,
                customerName: true,
                lastMessageAt: true,
                status: true,
                _count: {
                    select: { messages: true },
                },
            },
            orderBy: { lastMessageAt: "desc" },
        });

        // Deduplicate by phone
        const phoneMap = new Map<string, {
            phone: string;
            name: string | null;
            lastContact: Date | null;
            messageCount: number;
            status: string;
        }>();

        conversations.forEach(c => {
            if (!phoneMap.has(c.customerPhone)) {
                phoneMap.set(c.customerPhone, {
                    phone: c.customerPhone,
                    name: c.customerName,
                    lastContact: c.lastMessageAt,
                    messageCount: c._count.messages,
                    status: c.status,
                });
            } else {
                const existing = phoneMap.get(c.customerPhone)!;
                existing.messageCount += c._count.messages;
                if (c.lastMessageAt && (!existing.lastContact || c.lastMessageAt > existing.lastContact)) {
                    existing.lastContact = c.lastMessageAt;
                }
            }
        });

        const contacts = Array.from(phoneMap.values());

        // Build CSV content
        const headers = ["Telefone", "Nome", "Último Contato", "Mensagens", "Status"];
        const rows = contacts.map(c => [
            c.phone,
            c.name || "",
            c.lastContact ? new Date(c.lastContact).toLocaleDateString("pt-BR") : "",
            c.messageCount.toString(),
            c.status,
        ]);

        const csvContent = [
            headers.join(";"),
            ...rows.map(row => row.map(cell => `"${cell.replace(/"/g, '""')}"`).join(";")),
        ].join("\n");

        // Return as CSV file
        return new NextResponse(csvContent, {
            status: 200,
            headers: {
                "Content-Type": "text/csv; charset=utf-8",
                "Content-Disposition": `attachment; filename="contatos_${new Date().toISOString().split("T")[0]}.csv"`,
            },
        });
    } catch (error) {
        console.error("Export contacts error:", error);
        return NextResponse.json(errorResponse("Erro ao exportar"), { status: 500 });
    }
}
