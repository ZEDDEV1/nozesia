/**
 * Extract Work Hours from Training Text
 * 
 * Uses GPT to extract structured work hours from natural language text.
 * Runs asynchronously to not block training data creation.
 */

import OpenAI from "openai";
import { prisma } from "./prisma";
import { logger } from "./logger";

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});

interface ExtractedWorkHours {
    workStart: string;  // "09:00"
    workEnd: string;    // "18:00"
    lunchStart?: string; // "12:00"
    lunchEnd?: string;   // "13:00"
    workDays?: number[]; // [1,2,3,4,5] = seg-sex
}

/**
 * Extrai horários de funcionamento de texto usando GPT
 */
async function extractWorkHoursFromText(text: string): Promise<ExtractedWorkHours | null> {
    try {
        const response = await openai.chat.completions.create({
            model: "gpt-4o-mini",
            messages: [
                {
                    role: "system",
                    content: `Você é um extrator de horários de funcionamento. 
Dado um texto em português, extraia os horários de trabalho no formato JSON.

Regras:
- Formato de hora: "HH:MM" (24h)
- workDays: array de números (0=Dom, 1=Seg, 2=Ter, 3=Qua, 4=Qui, 5=Sex, 6=Sab)
- Se não mencionar almoço, não inclua lunchStart/lunchEnd
- Se não mencionar dias, assuma segunda a sexta [1,2,3,4,5]

Responda APENAS com JSON válido, sem markdown.`
                },
                {
                    role: "user",
                    content: `Extraia os horários deste texto:\n\n"${text}"`
                }
            ],
            temperature: 0.1,
            max_tokens: 200,
        });

        const content = response.choices[0]?.message?.content?.trim();
        if (!content) return null;

        // Tentar parsear JSON
        const parsed = JSON.parse(content);

        // Validar campos obrigatórios
        if (!parsed.workStart || !parsed.workEnd) {
            logger.warn("[ExtractWorkHours] Missing required fields", { parsed });
            return null;
        }

        return {
            workStart: parsed.workStart,
            workEnd: parsed.workEnd,
            lunchStart: parsed.lunchStart || null,
            lunchEnd: parsed.lunchEnd || null,
            workDays: parsed.workDays || [1, 2, 3, 4, 5],
        };
    } catch (error) {
        logger.error("[ExtractWorkHours] Failed to extract", { error, text: text.substring(0, 100) });
        return null;
    }
}

/**
 * Extrai e salva horários de funcionamento do texto de treinamento
 * Esta função roda assíncrona - erros são logados mas não propagados
 */
export async function extractAndSaveWorkHours(companyId: string, trainingContent: string): Promise<void> {
    try {
        logger.info("[ExtractWorkHours] Starting extraction", { companyId });

        // Extrair horários via GPT
        const extracted = await extractWorkHoursFromText(trainingContent);

        if (!extracted) {
            logger.info("[ExtractWorkHours] Could not extract hours from text", { companyId });
            return;
        }

        logger.info("[ExtractWorkHours] Extracted hours", { companyId, extracted });

        // Upsert na tabela GoogleCalendarIntegration
        // Esta tabela já existe e é usada pelo calendário local
        await prisma.googleCalendarIntegration.upsert({
            where: { companyId },
            update: {
                workStart: extracted.workStart,
                workEnd: extracted.workEnd,
                lunchStart: extracted.lunchStart,
                lunchEnd: extracted.lunchEnd,
                workDays: JSON.stringify(extracted.workDays || [1, 2, 3, 4, 5]),
            },
            create: {
                companyId,
                // Campos obrigatórios para criar (tokens vazios pois não tem Google Calendar)
                accessToken: "",
                refreshToken: "",
                expiresAt: new Date(0), // Expirado = não tem Google Calendar
                calendarId: "primary",
                // Horários extraídos
                workStart: extracted.workStart,
                workEnd: extracted.workEnd,
                lunchStart: extracted.lunchStart,
                lunchEnd: extracted.lunchEnd,
                workDays: JSON.stringify(extracted.workDays || [1, 2, 3, 4, 5]),
            },
        });

        logger.info("[ExtractWorkHours] Work hours saved successfully", { companyId, extracted });

    } catch (error) {
        // Não propagar erro - apenas logar
        logger.error("[ExtractWorkHours] Failed to save work hours", { companyId, error });
    }
}
