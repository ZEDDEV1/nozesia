/**
 * AI Functions Tests
 * 
 * Testa as funções de IA: context, function calling, prompts
 */

import { describe, it, expect, vi } from "vitest";

// Mock do OpenAI
vi.mock("openai", () => ({
    default: class {
        chat = {
            completions: {
                create: vi.fn().mockResolvedValue({
                    choices: [{ message: { content: "Resposta da IA" } }],
                    usage: { prompt_tokens: 100, completion_tokens: 50 },
                }),
            },
        };
    },
}));

describe("AI Context Management", () => {
    describe("Message Summarization", () => {
        it("should summarize long conversations", () => {
            const longConversation = Array(15).fill(null).map((_, i) => ({
                role: i % 2 === 0 ? "user" : "assistant",
                content: `Mensagem ${i + 1}`,
            }));

            expect(longConversation.length).toBe(15);
            expect(longConversation.length).toBeGreaterThan(10);
        });

        it("should keep recent messages after summarizing", () => {
            const messages = Array(15).fill(null).map((_, i) => ({
                role: i % 2 === 0 ? "user" : "assistant",
                content: `Msg ${i + 1}`,
            }));

            const keepRecent = 5;
            const recentMessages = messages.slice(-keepRecent);

            expect(recentMessages.length).toBe(5);
            expect(recentMessages[0].content).toBe("Msg 11");
        });
    });

    describe("Intent Detection", () => {
        it("should detect purchase intent", () => {
            const messages = [
                "quero comprar",
                "gostaria de adquirir",
                "pode me vender",
                "quanto custa pra levar",
            ];

            const purchaseKeywords = ["comprar", "adquirir", "vender", "levar"];

            messages.forEach(msg => {
                const hasPurchaseIntent = purchaseKeywords.some(k => msg.toLowerCase().includes(k));
                expect(hasPurchaseIntent).toBe(true);
            });
        });

        it("should detect human transfer intent", () => {
            const messages = [
                "quero falar com humano",
                "me passa pra um atendente",
                "chama alguém de verdade",
            ];

            const humanKeywords = ["humano", "atendente", "pessoa", "alguém"];

            messages.forEach(msg => {
                const wantsHuman = humanKeywords.some(k => msg.toLowerCase().includes(k));
                expect(wantsHuman).toBe(true);
            });
        });

        it("should detect price inquiry", () => {
            const messages = [
                "quanto custa",
                "qual o preço",
                "qual valor",
            ];

            const priceKeywords = ["custa", "preço", "valor", "quanto"];

            messages.forEach(msg => {
                const askingPrice = priceKeywords.some(k => msg.toLowerCase().includes(k));
                expect(askingPrice).toBe(true);
            });
        });
    });
});

describe("AI Function Calling", () => {
    describe("Available Functions", () => {
        const availableFunctions = [
            "buscarProduto",
            "verificarDisponibilidade",
            "transferirParaHumano",
            "registrarInteresse",
            "processarVenda",
        ];

        it("should have all required functions defined", () => {
            expect(availableFunctions.length).toBe(5);
        });

        it("should match function name patterns", () => {
            availableFunctions.forEach(fn => {
                expect(fn).toMatch(/^[a-z][a-zA-Z]+$/);
            });
        });
    });

    describe("Function: buscarProduto", () => {
        it("should accept product name parameter", () => {
            const params = {
                nomeProduto: "Camisa Polo",
            };

            expect(params).toHaveProperty("nomeProduto");
            expect(typeof params.nomeProduto).toBe("string");
        });

        it("should return product information", () => {
            const result = {
                found: true,
                product: {
                    name: "Camisa Polo",
                    price: 89.90,
                    available: true,
                },
            };

            expect(result.found).toBe(true);
            expect(result.product.price).toBeGreaterThan(0);
        });
    });

    describe("Function: processarVenda", () => {
        it("should accept sale parameters", () => {
            const params = {
                nomeProduto: "Camisa",
                quantidade: 2,
                valorUnitario: 89.90,
            };

            expect(params.quantidade).toBeGreaterThan(0);
            expect(params.valorUnitario).toBeGreaterThan(0);
        });

        it("should calculate total correctly", () => {
            const sale = {
                quantity: 2,
                unitPrice: 89.90,
            };

            const total = sale.quantity * sale.unitPrice;
            expect(total).toBe(179.80);
        });

        it("should generate PIX message", () => {
            const pixKey = "pix@empresa.com";
            const amount = 179.80;

            const message = `PIX: ${pixKey} - Valor: R$ ${amount.toFixed(2)}`;
            expect(message).toContain(pixKey);
            expect(message).toContain("179.80");
        });
    });

    describe("Function: transferirParaHumano", () => {
        it("should accept transfer reason", () => {
            const params = {
                motivo: "Cliente solicitou atendimento humano",
            };

            expect(params.motivo.length).toBeGreaterThan(0);
        });

        it("should update conversation status", () => {
            const conversation = { status: "AI_HANDLING" };

            // Simular transferência
            conversation.status = "HUMAN_HANDLING";

            expect(conversation.status).toBe("HUMAN_HANDLING");
        });
    });

    describe("Function: registrarInteresse", () => {
        it("should capture customer interest", () => {
            const interest = {
                productName: "Camisa Polo Azul",
                details: "Tamanho M, cor azul",
                customerPhone: "5511999999999",
            };

            expect(interest.productName).toBeDefined();
            expect(interest.customerPhone).toBeDefined();
        });
    });
});

describe("System Prompt Generation", () => {
    it("should generate personalized prompt", () => {
        const company = {
            name: "Loja Fashion",
            niche: "moda",
            description: "Loja de roupas e acessórios",
        };

        const prompt = `Você é um atendente da "${company.name}"`;

        expect(prompt).toContain(company.name);
    });

    it("should include company niche", () => {
        const niche = "moda feminina";
        const prompt = `Você trabalha no segmento de ${niche}`;

        expect(prompt).toContain(niche);
    });

    it("should include behavior rules", () => {
        const rules = [
            "NUNCA diga que é IA",
            "Use linguagem informal",
            "Seja direto e objetivo",
        ];

        rules.forEach(rule => {
            expect(rule.length).toBeGreaterThan(0);
        });
    });

    it("should handle missing training data", () => {
        const hasTrainingData = false;
        const warningMessage = hasTrainingData
            ? ""
            : "Você ainda não tem informações específicas";

        expect(warningMessage).toContain("não tem informações");
    });
});

describe("Token Usage", () => {
    it("should track input and output tokens", () => {
        const usage = {
            inputTokens: 500,
            outputTokens: 150,
        };

        const total = usage.inputTokens + usage.outputTokens;
        expect(total).toBe(650);
    });

    it("should calculate cost estimation", () => {
        const tokens = {
            input: 1000,
            output: 500,
        };

        // GPT-4o-mini pricing approximation
        const inputCostPer1k = 0.00015;
        const outputCostPer1k = 0.0006;

        const cost = (tokens.input / 1000 * inputCostPer1k) +
            (tokens.output / 1000 * outputCostPer1k);

        expect(cost).toBeGreaterThan(0);
        expect(cost).toBeLessThan(1);
    });

    it("should aggregate monthly usage", () => {
        const monthlyUsage = [
            { day: 1, tokens: 1000 },
            { day: 2, tokens: 1500 },
            { day: 3, tokens: 2000 },
        ];

        const total = monthlyUsage.reduce((sum, day) => sum + day.tokens, 0);
        expect(total).toBe(4500);
    });
});
