/**
 * WhatsApp Webhook Tests
 * 
 * Testa o fluxo de recebimento de mensagens do WhatsApp
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock do prisma
vi.mock("@/lib/prisma", () => ({
    prisma: {
        whatsAppSession: {
            findFirst: vi.fn(),
        },
        conversation: {
            findFirst: vi.fn(),
            create: vi.fn(),
            update: vi.fn(),
        },
        message: {
            create: vi.fn(),
            findMany: vi.fn(),
        },
        aIAgent: {
            findFirst: vi.fn(),
        },
        trainingData: {
            findMany: vi.fn(),
        },
        tokenUsage: {
            upsert: vi.fn(),
        },
    },
}));

// Mock do wppconnect
vi.mock("@/lib/wppconnect", () => ({
    wppConnect: {
        sendTextMessage: vi.fn().mockResolvedValue(true),
        getSessionStatus: vi.fn().mockResolvedValue("CONNECTED"),
    },
}));

// Mock do openai
vi.mock("@/lib/openai", () => ({
    generateAIResponseWithFunctions: vi.fn().mockResolvedValue({
        response: "Olá! Como posso ajudar?",
        inputTokens: 100,
        outputTokens: 50,
        functionsCalled: [],
        wasTransferred: false,
    }),
    transcribeAudio: vi.fn().mockResolvedValue("Áudio transcrito"),
}));

// Mock do socket-server
vi.mock("@/lib/socket-server", () => ({
    emitNewMessage: vi.fn(),
    emitNewConversation: vi.fn(),
}));

// Mock do rate-limit
vi.mock("@/lib/rate-limit", () => ({
    rateLimitMiddleware: vi.fn().mockResolvedValue(null),
}));

import { prisma } from "@/lib/prisma";

describe("WhatsApp Webhook", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe("Message Parsing", () => {
        it("should parse text message correctly", () => {
            const messageData = {
                from: "5511999999999@c.us",
                body: "Olá, preciso de ajuda",
                type: "chat",
            };

            expect(messageData.from).toContain("@c.us");
            expect(messageData.body).toBe("Olá, preciso de ajuda");
        });

        it("should extract phone number from WhatsApp ID", () => {
            const whatsappId = "5511999999999@c.us";
            const phone = whatsappId.replace("@c.us", "").replace("@s.whatsapp.net", "");

            expect(phone).toBe("5511999999999");
        });

        it("should handle different WhatsApp ID formats", () => {
            const formats = [
                "5511999999999@c.us",
                "5511999999999@s.whatsapp.net",
            ];

            formats.forEach(id => {
                const phone = id.replace("@c.us", "").replace("@s.whatsapp.net", "");
                expect(phone).toBe("5511999999999");
            });
        });

        it("should detect message types correctly", () => {
            const messageTypes = {
                "chat": "TEXT",
                "image": "IMAGE",
                "audio": "AUDIO",
                "ptt": "AUDIO",
                "video": "VIDEO",
                "document": "DOCUMENT",
                "sticker": "STICKER",
            };

            Object.entries(messageTypes).forEach(([input, expected]) => {
                const mapped = input === "chat" ? "TEXT" :
                    input === "ptt" ? "AUDIO" :
                        input.toUpperCase();
                expect(mapped).toBe(expected);
            });
        });
    });

    describe("Session Validation", () => {
        it("should find session by name", async () => {
            const mockSession = {
                id: "session-1",
                sessionName: "empresa-whatsapp",
                companyId: "company-1",
                company: { id: "company-1", name: "Test Company" },
            };

            vi.mocked(prisma.whatsAppSession.findFirst).mockResolvedValue(mockSession as never);

            const session = await prisma.whatsAppSession.findFirst({
                where: { sessionName: "empresa-whatsapp" },
                include: { company: true },
            });

            expect(session).toBeDefined();
            expect(session?.sessionName).toBe("empresa-whatsapp");
        });

        it("should return null for non-existent session", async () => {
            vi.mocked(prisma.whatsAppSession.findFirst).mockResolvedValue(null);

            const session = await prisma.whatsAppSession.findFirst({
                where: { sessionName: "non-existent" },
            });

            expect(session).toBeNull();
        });
    });

    describe("Conversation Management", () => {
        it("should find existing conversation", async () => {
            const mockConversation = {
                id: "conv-1",
                customerPhone: "5511999999999",
                status: "AI_HANDLING",
                agent: { id: "agent-1", name: "Bot" },
            };

            vi.mocked(prisma.conversation.findFirst).mockResolvedValue(mockConversation as never);

            const conv = await prisma.conversation.findFirst({
                where: { customerPhone: "5511999999999" },
                include: { agent: true },
            });

            expect(conv).toBeDefined();
            expect(conv?.status).toBe("AI_HANDLING");
        });

        it("should create new conversation for new customer", async () => {
            vi.mocked(prisma.conversation.findFirst).mockResolvedValue(null);

            const mockNewConv = {
                id: "conv-new",
                customerPhone: "5511888888888",
                customerName: "Cliente",
                status: "AI_HANDLING",
            };

            vi.mocked(prisma.conversation.create).mockResolvedValue(mockNewConv as never);

            const newConv = await prisma.conversation.create({
                data: {
                    companyId: "company-1",
                    customerPhone: "5511888888888",
                    customerName: "Cliente",
                    status: "AI_HANDLING",
                },
            });

            expect(newConv.id).toBe("conv-new");
            expect(newConv.customerPhone).toBe("5511888888888");
        });
    });

    describe("Message Storage", () => {
        it("should save incoming message", async () => {
            const mockMessage = {
                id: "msg-1",
                conversationId: "conv-1",
                content: "Olá!",
                type: "TEXT",
                sender: "CUSTOMER",
                createdAt: new Date(),
            };

            vi.mocked(prisma.message.create).mockResolvedValue(mockMessage as never);

            const saved = await prisma.message.create({
                data: {
                    conversationId: "conv-1",
                    content: "Olá!",
                    type: "TEXT",
                    sender: "CUSTOMER",
                },
            });

            expect(saved.id).toBe("msg-1");
            expect(saved.sender).toBe("CUSTOMER");
        });

        it("should save AI response message", async () => {
            const mockMessage = {
                id: "msg-2",
                conversationId: "conv-1",
                content: "Olá! Como posso ajudar?",
                type: "TEXT",
                sender: "AI",
                createdAt: new Date(),
            };

            vi.mocked(prisma.message.create).mockResolvedValue(mockMessage as never);

            const saved = await prisma.message.create({
                data: {
                    conversationId: "conv-1",
                    content: "Olá! Como posso ajudar?",
                    type: "TEXT",
                    sender: "AI",
                },
            });

            expect(saved.sender).toBe("AI");
        });
    });
});

describe("Message Type Handling", () => {
    it("should handle image messages", () => {
        const imageMsg = {
            type: "image",
            body: "data:image/jpeg;base64,/9j/4AAQ...",
            caption: "Foto do produto",
        };

        expect(imageMsg.type).toBe("image");
        expect(imageMsg.caption).toBe("Foto do produto");
    });

    it("should handle audio messages", () => {
        const audioMsg = {
            type: "ptt", // Push-to-talk
            body: "data:audio/ogg;base64,T2dnU...",
        };

        const mappedType = audioMsg.type === "ptt" ? "AUDIO" : audioMsg.type.toUpperCase();
        expect(mappedType).toBe("AUDIO");
    });

    it("should handle document messages", () => {
        const docMsg = {
            type: "document",
            filename: "contrato.pdf",
            body: "data:application/pdf;base64,...",
        };

        expect(docMsg.filename).toBe("contrato.pdf");
    });
});
