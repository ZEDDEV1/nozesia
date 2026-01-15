import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { wppConnect } from "@/lib/wppconnect";
import { successResponse, errorResponse, handleApiError } from "@/lib/api-response";
import { logger } from "@/lib/logger";

interface Contact {
    id: string;
    name: string;
    pushname?: string;
    shortName?: string;
    phone: string;
    isMyContact: boolean;
    isWAContact: boolean;
    profilePic?: string;
}

// GET - Get all contacts from connected WhatsApp
export async function GET() {
    try {
        const user = await getCurrentUser();

        if (!user || !user.companyId) {
            return NextResponse.json(errorResponse("Não autorizado"), { status: 401 });
        }

        // Get active session for this company
        const session = await prisma.whatsAppSession.findFirst({
            where: {
                companyId: user.companyId,
                status: "CONNECTED",
            },
        });

        if (!session) {
            return NextResponse.json(errorResponse("Nenhuma sessão WhatsApp conectada"), { status: 400 });
        }

        const sessionName = `${user.companyId}_${session.sessionName}`.toLowerCase().replace(/\s/g, "_");

        // Get contacts from WPPConnect
        const rawContacts = await wppConnect.getContacts(sessionName);

        // Format contacts
        const contacts: Contact[] = [];

        for (const c of rawContacts as Array<{
            id?: { user?: string; _serialized?: string };
            name?: string;
            pushname?: string;
            shortName?: string;
            isMyContact?: boolean;
            isWAContact?: boolean;
        }>) {
            if (!c.id?.user) continue;

            // Skip groups and broadcast lists
            const serialized = c.id._serialized || "";
            if (serialized.includes("@g.us") || serialized.includes("@broadcast")) continue;

            const phone = c.id.user.replace("@c.us", "").replace("@s.whatsapp.net", "");

            contacts.push({
                id: serialized || phone,
                name: c.name || c.pushname || phone,
                pushname: c.pushname,
                shortName: c.shortName,
                phone,
                isMyContact: c.isMyContact || false,
                isWAContact: c.isWAContact || false,
            });
        }

        // Sort: contacts with name first, then by name
        contacts.sort((a, b) => {
            const aHasName = a.name !== a.phone;
            const bHasName = b.name !== b.phone;
            if (aHasName && !bHasName) return -1;
            if (!aHasName && bHasName) return 1;
            return a.name.localeCompare(b.name);
        });

        return NextResponse.json(successResponse({
            contacts,
            total: contacts.length,
            sessionId: session.id,
        }));
    } catch (error) {
        logger.error("[Contacts API] Error", { error, route: "/api/contacts" });
        return NextResponse.json(handleApiError(error), { status: 500 });
    }
}
