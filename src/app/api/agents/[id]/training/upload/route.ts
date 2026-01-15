/**
 * API de Upload de Documentos para Treinamento
 * 
 * POST /api/agents/[id]/training/upload
 * 
 * Aceita: PDF, DOCX, TXT
 * Processa: Extrai texto, salva arquivo no Cloudinary, cria TrainingData, gera embeddings
 */

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { successResponse, errorResponse, handleApiError } from "@/lib/api-response";
import { parseDocument, isSupportedExtension, extractProductsFromText } from "@/lib/document-parser";
import { processTrainingData } from "@/lib/rag";
import { uploadBuffer as _uploadBuffer, isConfigured as _isCloudinaryConfigured } from "@/lib/upload";
import { logger } from "@/lib/logger";

interface RouteParams {
    params: Promise<{ id: string }>;
}

// Máximo 10MB
const MAX_FILE_SIZE = 10 * 1024 * 1024;

export async function POST(request: Request, { params }: RouteParams) {
    try {
        const user = await getCurrentUser();
        const { id: agentId } = await params;

        if (!user || !user.companyId) {
            return NextResponse.json(errorResponse("Não autorizado"), { status: 401 });
        }

        // Verificar se o agente pertence à empresa
        const agent = await prisma.aIAgent.findFirst({
            where: { id: agentId, companyId: user.companyId },
        });

        if (!agent) {
            return NextResponse.json(errorResponse("Agente não encontrado"), { status: 404 });
        }

        // Processar FormData
        const formData = await request.formData();
        const file = formData.get("file") as File | null;
        const title = formData.get("title") as string | null;
        const extractProducts = formData.get("extractProducts") === "true";

        if (!file) {
            return NextResponse.json(
                errorResponse("Arquivo é obrigatório"),
                { status: 400 }
            );
        }

        // Validar extensão
        if (!isSupportedExtension(file.name)) {
            return NextResponse.json(
                errorResponse("Formato não suportado. Use PDF, DOCX ou TXT."),
                { status: 400 }
            );
        }

        // Validar tamanho
        if (file.size > MAX_FILE_SIZE) {
            return NextResponse.json(
                errorResponse("Arquivo muito grande. Máximo 10MB."),
                { status: 400 }
            );
        }

        logger.info("[DocumentUpload] Processing file", {
            filename: file.name,
            size: file.size,
            agentId,
        });

        // Converter para Buffer
        const arrayBuffer = await file.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);

        // Extrair texto do documento
        const parseResult = await parseDocument(buffer, file.name);

        if (!parseResult.success || !parseResult.text) {
            return NextResponse.json(
                errorResponse(parseResult.error || "Erro ao processar documento"),
                { status: 400 }
            );
        }

        // Verificar se extraiu conteúdo suficiente
        if (parseResult.text.length < 50) {
            return NextResponse.json(
                errorResponse("O documento não contém texto suficiente para treinamento."),
                { status: 400 }
            );
        }

        // Salvar arquivo localmente para poder enviar ao cliente
        let fileUrl: string | null = null;
        const fileName: string | null = file.name;

        try {
            const fs = await import("fs/promises");
            const path = await import("path");

            // Gerar nome único para o arquivo
            const uniqueFileName = `${agentId}_${Date.now()}_${file.name.replace(/[^a-zA-Z0-9.-]/g, "_")}`;

            // Caminho para salvar: public/uploads/training/
            const uploadsDir = path.join(process.cwd(), "public", "uploads", "training");

            // Garantir que o diretório existe
            await fs.mkdir(uploadsDir, { recursive: true });

            const filePath = path.join(uploadsDir, uniqueFileName);

            // Salvar arquivo
            await fs.writeFile(filePath, buffer);

            // URL pública (relativa ao servidor)
            fileUrl = `/uploads/training/${uniqueFileName}`;

            logger.info("[DocumentUpload] File saved locally", {
                fileUrl,
                filePath,
                size: buffer.length,
            });
        } catch (uploadError) {
            // Não falhar se o salvamento local não funcionar - só log
            logger.warn("[DocumentUpload] Local file save failed, continuing without file URL", {
                error: uploadError,
            });
        }

        // Criar TrainingData
        const trainingData = await prisma.trainingData.create({
            data: {
                agentId,
                type: "DOCUMENT",
                title: title || file.name.replace(/\.[^.]+$/, ""), // Remove extensão
                content: parseResult.text,
                fileUrl,
                fileName,
                metadata: JSON.stringify({
                    filename: file.name,
                    fileSize: file.size,
                    pageCount: parseResult.pageCount,
                    wordCount: parseResult.wordCount,
                    uploadedAt: new Date().toISOString(),
                    uploadedBy: user.email,
                    hasFileUrl: !!fileUrl,
                }),
            },
        });

        logger.info("[DocumentUpload] TrainingData created", {
            trainingId: trainingData.id,
            wordCount: parseResult.wordCount,
            hasFileUrl: !!fileUrl,
        });

        // Criar Audit Log
        await prisma.auditLog.create({
            data: {
                action: "UPLOAD_DOCUMENT",
                entity: "TrainingData",
                entityId: trainingData.id,
                userEmail: user.email,
                companyId: user.companyId,
                changes: JSON.stringify({
                    filename: file.name,
                    wordCount: parseResult.wordCount,
                    hasFileUrl: !!fileUrl,
                }),
            },
        });

        // Processar embeddings assincronamente (RAG)
        processTrainingData(trainingData.id).catch((error) => {
            logger.error("[DocumentUpload] Failed to process embeddings", { error });
        });

        // ========================================
        // EXTRAÇÃO DE PRODUTOS (OPT-IN)
        // ========================================
        let productsCreated = 0;
        let extractionMessage = "";

        if (extractProducts && parseResult.text) {
            logger.info("[DocumentUpload] Starting product extraction", {
                agentId,
                textLength: parseResult.text.length,
            });

            // Buscar nicho da empresa para contexto
            const company = await prisma.company.findFirst({
                where: { id: user.companyId! },
                select: { id: true, niche: true },
            });

            // Extrair produtos do texto
            const extraction = await extractProductsFromText(
                parseResult.text,
                company?.niche || undefined,
                100 // máximo de produtos
            );

            if (extraction.success && extraction.products.length > 0) {
                logger.info("[DocumentUpload] Products extracted", {
                    count: extraction.products.length,
                    tokensUsed: extraction.tokensUsed,
                });

                // Criar produtos no banco
                for (const prod of extraction.products) {
                    try {
                        // Verificar se produto já existe
                        const exists = await prisma.product.findFirst({
                            where: {
                                companyId: user.companyId!,
                                name: {
                                    equals: prod.name,
                                    mode: "insensitive",
                                },
                            },
                        });

                        if (!exists) {
                            await prisma.product.create({
                                data: {
                                    companyId: user.companyId!,
                                    name: prod.name,
                                    description: prod.description || null,
                                    price: prod.price,
                                    isActive: true,
                                    // Marcadores de extração automática
                                    extractedFromAI: true,
                                    needsReview: true,
                                    sourceDocumentId: trainingData.id,
                                },
                            });
                            productsCreated++;
                        }
                    } catch (prodError) {
                        logger.warn("[DocumentUpload] Failed to create product", {
                            product: prod.name,
                            error: prodError,
                        });
                    }
                }

                // Criar audit log para extração
                await prisma.auditLog.create({
                    data: {
                        action: "AUTO_EXTRACT_PRODUCTS",
                        entity: "Product",
                        userEmail: user.email,
                        companyId: user.companyId,
                        changes: JSON.stringify({
                            trainingDataId: trainingData.id,
                            productsExtracted: extraction.products.length,
                            productsCreated,
                            tokensUsed: extraction.tokensUsed,
                        }),
                    },
                });

                extractionMessage = ` ${productsCreated} produtos criados automaticamente!`;
            } else if (!extraction.success) {
                logger.warn("[DocumentUpload] Product extraction failed", {
                    message: extraction.message,
                });
            }
        }

        return NextResponse.json(
            successResponse({
                id: trainingData.id,
                title: trainingData.title,
                type: trainingData.type,
                wordCount: parseResult.wordCount,
                pageCount: parseResult.pageCount,
                embeddingStatus: "pending",
                fileUrl: fileUrl || null,
                canSendFile: !!fileUrl,
                productsCreated,
            }, fileUrl
                ? `Documento importado! O arquivo pode ser enviado aos clientes.${extractionMessage}`
                : `Documento importado!${extractionMessage}`),
            { status: 201 }
        );
    } catch (error) {
        logger.error("[DocumentUpload] Error", { error });
        return NextResponse.json(handleApiError(error), { status: 500 });
    }
}
