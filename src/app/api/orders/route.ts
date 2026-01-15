/**
 * API: Orders / Sales
 * 
 * GET - Lista pedidos da empresa
 * POST - Cria novo pedido
 * PATCH - Atualiza status do pedido
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { createOrderSchema, updateOrderSchema, validateRequest } from "@/lib/validations";
import { successResponse, errorResponse, handleApiError } from "@/lib/api-response";
import { logger } from "@/lib/logger";

export async function GET(request: NextRequest) {
    try {
        const companyId = request.headers.get("x-company-id");

        if (!companyId) {
            return NextResponse.json(
                errorResponse("Empresa não identificada"),
                { status: 401 }
            );
        }

        const { searchParams } = new URL(request.url);
        const status = searchParams.get("status");
        const page = parseInt(searchParams.get("page") || "1");
        const limit = parseInt(searchParams.get("limit") || "20");

        // Tipagem correta com Prisma
        const where: Prisma.OrderWhereInput = { companyId };
        if (status && status !== "all") {
            where.status = status as Prisma.OrderWhereInput["status"];
        }

        const [orders, total, stats] = await Promise.all([
            prisma.order.findMany({
                where,
                include: {
                    conversation: {
                        select: {
                            id: true,
                            customerPhone: true,
                            customerName: true,
                        },
                    },
                },
                orderBy: { createdAt: "desc" },
                skip: (page - 1) * limit,
                take: limit,
            }),
            prisma.order.count({ where }),
            // Estatísticas por status
            prisma.order.groupBy({
                by: ["status"],
                where: { companyId },
                _count: true,
            }),
        ]);
        // Mantendo formato original: data.data = array de orders, data.stats, data.pagination
        return NextResponse.json({
            success: true,
            data: orders,
            stats: stats.reduce((acc, s) => {
                acc[s.status] = s._count;
                return acc;
            }, {} as Record<string, number>),
            pagination: {
                page,
                limit,
                total,
                pages: Math.ceil(total / limit),
            },
        });
    } catch (error) {
        logger.error("[API Orders] Error fetching orders:", { error, companyId: request.headers.get("x-company-id") || undefined });
        return NextResponse.json(handleApiError(error), { status: 500 });
    }
}

export async function POST(request: NextRequest) {
    try {
        const companyId = request.headers.get("x-company-id");

        if (!companyId) {
            return NextResponse.json(
                errorResponse("Empresa não identificada"),
                { status: 401 }
            );
        }

        const body = await request.json();

        // Validação com Zod
        const validation = validateRequest(createOrderSchema, body);
        if (!validation.success) {
            return validation.response;
        }

        const data = validation.data;
        const totalAmount = data.productPrice * data.quantity + (data.deliveryFee || 0);

        const order = await prisma.order.create({
            data: {
                companyId,
                conversationId: data.conversationId,
                customerPhone: data.customerPhone,
                customerName: data.customerName,
                productName: data.productName,
                productPrice: data.productPrice,
                quantity: data.quantity,
                totalAmount,
                pixKey: data.pixKey,
                pixKeyType: data.pixKeyType,
                deliveryType: data.deliveryType,
                deliveryAddress: data.deliveryAddress,
                deliveryFee: data.deliveryFee,
                status: "AWAITING_PAYMENT",
            },
        });

        logger.info("[API Orders] Order created:", { orderId: order.id, companyId });

        return NextResponse.json(
            successResponse(order, "Pedido criado com sucesso!"),
            { status: 201 }
        );
    } catch (error) {
        logger.error("[API Orders] Error creating order:", { error, companyId: request.headers.get("x-company-id") || undefined });
        return NextResponse.json(handleApiError(error), { status: 500 });
    }
}

export async function PATCH(request: NextRequest) {
    try {
        const companyId = request.headers.get("x-company-id");

        if (!companyId) {
            return NextResponse.json(
                errorResponse("Empresa não identificada"),
                { status: 401 }
            );
        }

        const body = await request.json();

        // Validação com Zod
        const validation = validateRequest(updateOrderSchema, body);
        if (!validation.success) {
            return validation.response;
        }

        const { id, status, paymentProof, notes } = validation.data;

        // Verificar se pedido pertence à empresa
        const order = await prisma.order.findFirst({
            where: { id, companyId },
            include: {
                conversation: {
                    select: {
                        id: true,
                        customerPhone: true,
                        session: { select: { sessionName: true } }
                    },
                },
                company: { select: { name: true } },
            },
        });

        if (!order) {
            return NextResponse.json(
                errorResponse("Pedido não encontrado"),
                { status: 404 }
            );
        }

        // Tipagem correta com Prisma
        const updateData: Prisma.OrderUpdateInput = {};

        if (status) {
            updateData.status = status as "AWAITING_PAYMENT" | "PROOF_SENT" | "VERIFIED" | "SHIPPED" | "DELIVERED" | "CANCELLED";
            // Atualizar timestamps baseado no status
            if (status === "VERIFIED") updateData.verifiedAt = new Date();
            if (status === "SHIPPED") updateData.shippedAt = new Date();
            if (status === "DELIVERED") updateData.deliveredAt = new Date();
        }
        if (paymentProof) updateData.paymentProof = paymentProof;
        if (notes) updateData.notes = notes;

        const updated = await prisma.order.update({
            where: { id },
            data: updateData,
        });

        // Enviar mensagem via WhatsApp quando status mudar
        if (status && order.conversation?.customerPhone && order.conversation?.session?.sessionName) {
            const sessionName = order.conversation.session.sessionName;
            const customerPhone = order.conversation.customerPhone;

            let message = "";

            switch (status) {
                case "VERIFIED":
                    message = `✅ *Pagamento confirmado!*

Seu pedido *#${order.id.slice(-6).toUpperCase()}* foi confirmado!

📦 *${order.productName}* - ${order.quantity}x

${order.deliveryType === "DELIVERY"
                            ? "🛵 Estamos preparando e logo sairá para *entrega*!"
                            : "🏪 Estamos preparando para sua *retirada*!"}

Obrigado pela compra! 🙏`;
                    break;

                case "SHIPPED":
                    message = `🚚 *Seu pedido saiu para entrega!*

Pedido *#${order.id.slice(-6).toUpperCase()}*

${order.deliveryAddress ? `📍 Endereço: ${order.deliveryAddress}` : ""}

Logo chegará até você! 🏃‍♂️`;
                    break;

                case "DELIVERED":
                    message = `✔️ *Pedido entregue!*

Seu pedido *#${order.id.slice(-6).toUpperCase()}* foi entregue com sucesso!

Esperamos que tenha gostado! 😊
Obrigado pela preferência! ❤️`;
                    break;
            }

            if (message) {
                try {
                    // Buscar URL do WPPConnect server
                    const wppServerUrl = process.env.WPPCONNECT_SERVER_URL || "http://localhost:21465";
                    const secretKey = process.env.WPPCONNECT_SECRET_KEY || "THISISMYSECURETOKEN";

                    // Enviar mensagem via WPPConnect
                    const fullPhone = customerPhone.includes("@c.us")
                        ? customerPhone
                        : `${customerPhone}@c.us`;

                    await fetch(`${wppServerUrl}/api/${sessionName}/send-message`, {
                        method: "POST",
                        headers: {
                            "Content-Type": "application/json",
                            "Authorization": `Bearer ${secretKey}`,
                        },
                        body: JSON.stringify({
                            phone: fullPhone,
                            message,
                            isGroup: false,
                        }),
                    });

                    logger.info("[API Orders] WhatsApp message sent:", { orderId: id, status });

                    // Salvar mensagem no histórico
                    await prisma.message.create({
                        data: {
                            conversationId: order.conversation.id,
                            type: "TEXT",
                            content: message,
                            sender: "AI",
                        },
                    });
                } catch (wppError) {
                    logger.error("[API Orders] Failed to send WhatsApp message:", { error: wppError, orderId: id });
                    // Não falhar a atualização por causa de erro de WhatsApp
                }
            }
        }

        return NextResponse.json(successResponse({
            order: updated,
            messageSent: !!status && ["VERIFIED", "SHIPPED", "DELIVERED"].includes(status),
        }));
    } catch (error) {
        logger.error("[API Orders] Error updating order:", { error, companyId: request.headers.get("x-company-id") || undefined });
        return NextResponse.json(handleApiError(error), { status: 500 });
    }
}
