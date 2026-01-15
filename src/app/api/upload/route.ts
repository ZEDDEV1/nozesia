/**
 * API de Upload de Arquivos
 * 
 * POST - Upload de arquivo (base64 ou URL)
 */

import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { uploadBase64, uploadFromUrl, isConfigured, isValidFileType, isValidFileSize } from "@/lib/upload";
import { successResponse, errorResponse, handleApiError } from "@/lib/api-response";
import { logger } from "@/lib/logger";
import { z } from "zod";

const uploadSchema = z.object({
    file: z.string().min(1, "Arquivo é obrigatório"),
    type: z.enum(["base64", "url"]).default("base64"),
    folder: z.string().optional(),
    filename: z.string().optional(),
});

export async function POST(request: Request) {
    try {
        const user = await getCurrentUser();

        if (!user || !user.companyId) {
            return NextResponse.json(errorResponse("Não autorizado"), { status: 401 });
        }

        // Verificar se Cloudinary está configurado
        if (!isConfigured()) {
            logger.warn("[Upload API] Cloudinary not configured");
            return NextResponse.json(
                errorResponse("Serviço de upload não configurado. Configure CLOUDINARY_* no .env"),
                { status: 503 }
            );
        }

        const body = await request.json();
        const parsed = uploadSchema.safeParse(body);

        if (!parsed.success) {
            return NextResponse.json(
                errorResponse(parsed.error.issues[0].message),
                { status: 400 }
            );
        }

        const { file, type, folder, filename } = parsed.data;

        // Validar tipo de arquivo se nome fornecido e tiver extensão
        if (filename && filename.includes('.') && !isValidFileType(filename)) {
            return NextResponse.json(
                errorResponse("Tipo de arquivo não permitido. Use: JPG, PNG, GIF, WebP, PDF, MP3 ou MP4"),
                { status: 400 }
            );
        }

        // Validar tamanho para base64 (aproximação)
        if (type === "base64" && !isValidFileSize(file.length * 0.75, 10)) {
            return NextResponse.json(
                errorResponse("Arquivo muito grande. Máximo 10MB"),
                { status: 400 }
            );
        }

        // Fazer upload
        const uploadFolder = folder || `companies/${user.companyId}`;

        const result = type === "url"
            ? await uploadFromUrl(file, { folder: uploadFolder })
            : await uploadBase64(file, { folder: uploadFolder });

        if (!result.success) {
            return NextResponse.json(
                errorResponse(result.error || "Erro ao fazer upload"),
                { status: 500 }
            );
        }

        logger.info("[Upload API] File uploaded", {
            userId: user.id,
            companyId: user.companyId,
            publicId: result.publicId,
        });

        return NextResponse.json(
            successResponse({
                url: result.url,
                publicId: result.publicId,
                format: result.format,
                width: result.width,
                height: result.height,
                size: result.size,
            }, "Upload realizado com sucesso!")
        );
    } catch (error) {
        return NextResponse.json(handleApiError(error), { status: 500 });
    }
}
