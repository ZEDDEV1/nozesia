/**
 * Serviço de Upload com Cloudinary
 * 
 * PARA QUE SERVE:
 * - Upload de imagens e arquivos para a nuvem
 * - Armazenar mídia das conversas do WhatsApp
 * - Avatares de usuários
 * - Arquivos de treinamento da IA
 * 
 * CONFIGURAÇÃO:
 * Adicione no .env:
 * CLOUDINARY_CLOUD_NAME=seu_cloud_name
 * CLOUDINARY_API_KEY=sua_api_key
 * CLOUDINARY_API_SECRET=seu_api_secret
 */

import { v2 as cloudinary, UploadApiResponse } from "cloudinary";
import { logger } from "./logger";

// Configurar Cloudinary
cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
});

// ============================================
// TIPOS
// ============================================

export interface UploadResult {
    success: boolean;
    url?: string;
    publicId?: string;
    format?: string;
    width?: number;
    height?: number;
    size?: number;
    error?: string;
}

export interface UploadOptions {
    folder?: string;
    resourceType?: "image" | "video" | "raw" | "auto";
    transformation?: {
        width?: number;
        height?: number;
        crop?: string;
        quality?: string | number;
    };
    publicId?: string;
}

// ============================================
// FUNÇÕES DE UPLOAD
// ============================================

/**
 * Upload de arquivo Base64
 */
export async function uploadBase64(
    base64String: string,
    options: UploadOptions = {}
): Promise<UploadResult> {
    if (!isConfigured()) {
        logger.warn("[Upload] Cloudinary not configured");
        return { success: false, error: "Serviço de upload não configurado" };
    }

    try {
        const result: UploadApiResponse = await cloudinary.uploader.upload(
            base64String,
            {
                folder: options.folder || "uploads",
                resource_type: options.resourceType || "auto",
                public_id: options.publicId,
                transformation: options.transformation ? [options.transformation] : undefined,
            }
        );

        logger.info("[Upload] File uploaded successfully", {
            publicId: result.public_id,
            size: result.bytes,
        });

        return {
            success: true,
            url: result.secure_url,
            publicId: result.public_id,
            format: result.format,
            width: result.width,
            height: result.height,
            size: result.bytes,
        };
    } catch (error) {
        logger.error("[Upload] Failed to upload file", { error });
        return {
            success: false,
            error: error instanceof Error ? error.message : "Erro ao fazer upload",
        };
    }
}

/**
 * Upload de arquivo via URL
 */
export async function uploadFromUrl(
    url: string,
    options: UploadOptions = {}
): Promise<UploadResult> {
    if (!isConfigured()) {
        logger.warn("[Upload] Cloudinary not configured");
        return { success: false, error: "Serviço de upload não configurado" };
    }

    try {
        const result: UploadApiResponse = await cloudinary.uploader.upload(url, {
            folder: options.folder || "uploads",
            resource_type: options.resourceType || "auto",
            public_id: options.publicId,
        });

        logger.info("[Upload] File uploaded from URL", {
            publicId: result.public_id,
            sourceUrl: url,
        });

        return {
            success: true,
            url: result.secure_url,
            publicId: result.public_id,
            format: result.format,
            width: result.width,
            height: result.height,
            size: result.bytes,
        };
    } catch (error) {
        logger.error("[Upload] Failed to upload from URL", { error, url });
        return {
            success: false,
            error: error instanceof Error ? error.message : "Erro ao fazer upload",
        };
    }
}

/**
 * Upload de arquivo Buffer
 */
export async function uploadBuffer(
    buffer: Buffer,
    options: UploadOptions = {}
): Promise<UploadResult> {
    if (!isConfigured()) {
        logger.warn("[Upload] Cloudinary not configured");
        return { success: false, error: "Serviço de upload não configurado" };
    }

    return new Promise((resolve) => {
        cloudinary.uploader
            .upload_stream(
                {
                    folder: options.folder || "uploads",
                    resource_type: options.resourceType || "auto",
                    public_id: options.publicId,
                },
                (error, result) => {
                    if (error || !result) {
                        logger.error("[Upload] Failed to upload buffer", { error });
                        resolve({
                            success: false,
                            error: error?.message || "Erro ao fazer upload",
                        });
                        return;
                    }

                    logger.info("[Upload] Buffer uploaded successfully", {
                        publicId: result.public_id,
                    });

                    resolve({
                        success: true,
                        url: result.secure_url,
                        publicId: result.public_id,
                        format: result.format,
                        width: result.width,
                        height: result.height,
                        size: result.bytes,
                    });
                }
            )
            .end(buffer);
    });
}

// ============================================
// FUNÇÕES DE GERENCIAMENTO
// ============================================

/**
 * Deletar arquivo do Cloudinary
 */
export async function deleteFile(publicId: string): Promise<boolean> {
    if (!isConfigured()) return false;

    try {
        await cloudinary.uploader.destroy(publicId);
        logger.info("[Upload] File deleted", { publicId });
        return true;
    } catch (error) {
        logger.error("[Upload] Failed to delete file", { error, publicId });
        return false;
    }
}

/**
 * Gerar URL otimizada para imagem
 */
export function getOptimizedUrl(
    publicId: string,
    options: { width?: number; height?: number; quality?: string | number } = {}
): string {
    return cloudinary.url(publicId, {
        secure: true,
        transformation: [
            {
                width: options.width,
                height: options.height,
                crop: "fill",
                quality: options.quality || "auto",
                fetch_format: "auto",
            },
        ],
    });
}

/**
 * Gerar thumbnail de imagem
 */
export function getThumbnailUrl(publicId: string, size: number = 150): string {
    return getOptimizedUrl(publicId, { width: size, height: size });
}

// ============================================
// HELPERS
// ============================================

/**
 * Verifica se Cloudinary está configurado
 */
export function isConfigured(): boolean {
    return !!(
        process.env.CLOUDINARY_CLOUD_NAME &&
        process.env.CLOUDINARY_API_KEY &&
        process.env.CLOUDINARY_API_SECRET
    );
}

/**
 * Converte arquivo para Base64
 */
export function fileToBase64(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = (error) => reject(error);
    });
}

/**
 * Extrai extensão do arquivo
 */
export function getFileExtension(filename: string): string {
    return filename.split(".").pop()?.toLowerCase() || "";
}

/**
 * Valida tipo de arquivo
 */
export function isValidFileType(
    filename: string,
    allowedTypes: string[] = ["jpg", "jpeg", "png", "gif", "webp", "pdf", "mp3", "mp4"]
): boolean {
    const ext = getFileExtension(filename);
    return allowedTypes.includes(ext);
}

/**
 * Valida tamanho do arquivo (em bytes)
 */
export function isValidFileSize(size: number, maxSizeMB: number = 10): boolean {
    return size <= maxSizeMB * 1024 * 1024;
}

// Export cloudinary instance para uso avançado
export { cloudinary };
