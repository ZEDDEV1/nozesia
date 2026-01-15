"use server";

import { NextResponse } from "next/server";
import OpenAI from "openai";
import { successResponse, errorResponse } from "@/lib/api-response";
import { logger } from "@/lib/logger";

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});

// Templates de prompt por nicho
const nichePrompts: Record<string, string[]> = {
    restaurante: [
        "Foto profissional de pizza artesanal com queijo derretendo, fundo de madeira rústica, iluminação ambiente quente, estilo food photography",
        "Hambúrguer gourmet suculento com bacon crocante, batatas fritas douradas, fundo escuro, iluminação dramática",
        "Prato de massa italiana fresca com molho vermelho, ervas frescas, mesa de madeira elegante, sensação aconchegante",
        "Sobremesa de chocolate irresistível, calda escorrendo, frutas vermelhas, fundo minimalista preto",
    ],
    loja: [
        "Produtos de moda expostos em vitrine moderna, iluminação suave, cores vibrantes, estilo editorial",
        "Roupa casual elegante em cabide dourado, fundo de mármore branco, luz natural, atmosfera premium",
        "Acessórios de luxo dispostos em bancada minimalista, reflexos sutis, fotografia de produto profissional",
        "Sapatos elegantes em pedestal, fundo gradiente suave, sombras dramáticas, estilo comercial",
    ],
    clinica: [
        "Ambiente de clínica moderna e acolhedora, tons de azul e branco, plantas decorativas, sensação de calma",
        "Profissional de saúde sorridente em ambiente clínico moderno, iluminação suave, transmitindo confiança",
        "Sala de espera elegante de clínica, sofás confortáveis, decoração minimalista, tons neutros",
        "Equipamentos médicos modernos em ambiente clean, tons de azul, transmitindo tecnologia e cuidado",
    ],
    servicos: [
        "Profissional trabalhando com ferramentas, fundo de oficina organizada, iluminação natural, transmitindo competência",
        "Equipe de trabalho reunida em ambiente moderno, sorrindo, transmitindo confiança e profissionalismo",
        "Ferramentas de trabalho organizadas em bancada, fundo clean, iluminação profissional",
        "Resultado de trabalho bem feito, antes e depois, comparação visual impressionante",
    ],
    beleza: [
        "Produtos de beleza luxuosos em bancada de mármore, flores frescas, iluminação suave dourada",
        "Ambiente de salão de beleza moderno, cadeiras elegantes, espelhos iluminados, atmosfera premium",
        "Kit de maquiagem profissional aberto, pincéis de qualidade, fundo rosa suave, estilo editorial",
        "Unhas decoradas perfeitas em close, design artístico, fundo minimalista, iluminação de estúdio",
    ],
    geral: [
        "Banner promocional moderno com formas geométricas, cores vibrantes, espaço para texto, design profissional",
        "Imagem de fundo abstrata com ondas de cores, gradiente suave, perfeita para marketing digital",
        "Cena de sucesso e celebração, confetes dourados, fundo escuro elegante, atmosfera de vitória",
        "Ambiente de trabalho moderno e inspirador, luz natural, plantas, design de interiores contemporâneo",
    ],
};

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { prompt, niche, useTemplate } = body;

        // Determinar o prompt final
        let finalPrompt = prompt;

        if (useTemplate && niche && nichePrompts[niche]) {
            const templates = nichePrompts[niche];
            finalPrompt = templates[Math.floor(Math.random() * templates.length)];
        }

        if (!finalPrompt) {
            return NextResponse.json(
                errorResponse("Prompt é obrigatório"),
                { status: 400 }
            );
        }

        // Gerar imagem com DALL-E 3
        const response = await openai.images.generate({
            model: "dall-e-3",
            prompt: finalPrompt,
            n: 1,
            size: "1024x1024",
            quality: "standard",
        });

        const imageData = response.data?.[0];
        const imageUrl = imageData?.url;

        if (!imageUrl) {
            return NextResponse.json(
                errorResponse("Erro ao gerar imagem"),
                { status: 500 }
            );
        }

        // Registrar uso
        logger.ai("[Creatives] Image generated", { prompt: finalPrompt.substring(0, 50) });

        return NextResponse.json(
            successResponse({
                imageUrl,
                prompt: finalPrompt,
                revisedPrompt: imageData?.revised_prompt,
            })
        );
    } catch (error) {
        logger.error("[Creatives] Error", { error, route: "/api/creatives/generate" });
        return NextResponse.json(
            errorResponse("Erro ao gerar criativo"),
            { status: 500 }
        );
    }
}

// GET retorna os templates disponíveis
export async function GET() {
    return NextResponse.json(
        successResponse({
            niches: Object.keys(nichePrompts),
            templates: nichePrompts,
        })
    );
}
