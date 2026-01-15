"use server";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { logger } from "@/lib/logger";

interface RouteParams {
    params: Promise<{ id: string }>;
}

/**
 * GET /api/orders/[id]/print
 * Returns HTML optimized for thermal printers (kitchen/counter)
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
    try {
        const user = await getCurrentUser();
        if (!user || !user.companyId) {
            return new NextResponse("Não autorizado", { status: 401 });
        }

        const { id } = await params;

        const order = await prisma.order.findFirst({
            where: {
                id,
                companyId: user.companyId,
            },
            include: {
                company: {
                    select: { name: true, phone: true },
                },
            },
        });

        if (!order) {
            return new NextResponse("Pedido não encontrado", { status: 404 });
        }

        // Format date
        const orderDate = new Date(order.createdAt).toLocaleString("pt-BR", {
            day: "2-digit",
            month: "2-digit",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit",
        });

        // Format currency
        const formatCurrency = (value: number) =>
            value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

        // Calculate total with delivery
        const subtotal = order.totalAmount;
        const deliveryFee = order.deliveryFee || 0;
        const total = subtotal + deliveryFee;

        // Status labels
        const statusLabels: Record<string, string> = {
            AWAITING_PAYMENT: "⏳ AGUARDANDO PAGAMENTO",
            PROOF_SENT: "📸 COMPROVANTE ENVIADO",
            VERIFIED: "✅ PAGO - PREPARAR!",
            SHIPPED: "🚚 SAIU PARA ENTREGA",
            DELIVERED: "✔️ ENTREGUE",
            CANCELLED: "❌ CANCELADO",
        };

        // Delivery type
        const deliveryInfo = order.deliveryType === "DELIVERY"
            ? `🛵 ENTREGA`
            : order.deliveryType === "PICKUP"
                ? `🏪 RETIRADA`
                : "";

        // Generate HTML for thermal printer (58mm or 80mm width)
        const html = `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Pedido #${order.id.slice(-6).toUpperCase()}</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }

        @page {
            size: 80mm auto;
            margin: 0;
        }

        body {
            font-family: 'Courier New', monospace;
            font-size: 12px;
            width: 80mm;
            padding: 5mm;
            background: white;
            color: black;
        }

        .header {
            text-align: center;
            border-bottom: 2px dashed #000;
            padding-bottom: 10px;
            margin-bottom: 10px;
        }

        .company-name {
            font-size: 18px;
            font-weight: bold;
            margin-bottom: 5px;
        }

        .order-number {
            font-size: 24px;
            font-weight: bold;
            background: #000;
            color: #fff;
            padding: 8px;
            margin: 10px 0;
        }

        .status {
            font-size: 14px;
            font-weight: bold;
            padding: 5px;
            margin: 5px 0;
        }

        .status.verified {
            background: #000;
            color: #fff;
        }

        .section {
            margin: 10px 0;
            padding: 10px 0;
            border-bottom: 1px dashed #000;
        }

        .section-title {
            font-weight: bold;
            font-size: 14px;
            margin-bottom: 5px;
        }

        .item {
            display: flex;
            justify-content: space-between;
            margin: 5px 0;
        }

        .item-name {
            font-weight: bold;
            font-size: 16px;
        }

        .item-qty {
            font-size: 20px;
            font-weight: bold;
        }

        .item-price {
            font-size: 14px;
        }

        .delivery-type {
            font-size: 20px;
            font-weight: bold;
            text-align: center;
            padding: 10px;
            margin: 10px 0;
            border: 2px solid #000;
        }

        .address {
            font-size: 14px;
            line-height: 1.4;
        }

        .total {
            font-size: 18px;
            font-weight: bold;
            text-align: right;
        }

        .notes {
            background: #f0f0f0;
            padding: 10px;
            margin: 10px 0;
            font-size: 14px;
        }

        .footer {
            text-align: center;
            font-size: 10px;
            margin-top: 15px;
            border-top: 2px dashed #000;
            padding-top: 10px;
        }

        .customer-phone {
            font-size: 14px;
            font-weight: bold;
        }

        @media print {
            body {
                width: 80mm;
            }
            .no-print {
                display: none;
            }
        }

        .print-btn {
            display: block;
            width: 100%;
            padding: 15px;
            font-size: 18px;
            font-weight: bold;
            background: #22c55e;
            color: white;
            border: none;
            cursor: pointer;
            margin-bottom: 20px;
        }

        .print-btn:hover {
            background: #16a34a;
        }
    </style>
</head>
<body>
    <button class="print-btn no-print" onclick="window.print()">
        🖨️ IMPRIMIR PEDIDO
    </button>

    <div class="header">
        <div class="company-name">${order.company.name}</div>
        <div>${orderDate}</div>
        <div class="order-number">#${order.id.slice(-6).toUpperCase()}</div>
        <div class="status ${order.status === "VERIFIED" ? "verified" : ""}">
            ${statusLabels[order.status] || order.status}
        </div>
    </div>

    <div class="delivery-type">
        ${deliveryInfo}
    </div>

    <div class="section">
        <div class="section-title">👤 CLIENTE</div>
        <div>${order.customerName || "Não informado"}</div>
        <div class="customer-phone">📱 ${order.customerPhone}</div>
    </div>

    ${order.deliveryType === "DELIVERY" && order.deliveryAddress ? `
    <div class="section">
        <div class="section-title">📍 ENDEREÇO</div>
        <div class="address">
            ${order.deliveryAddress}<br>
            ${order.deliveryCity ? `<strong>Bairro:</strong> ${order.deliveryCity}` : ""}
            ${order.deliveryState ? ` - ${order.deliveryState}` : ""}
            ${order.deliveryCep ? `<br><strong>CEP:</strong> ${order.deliveryCep}` : ""}
        </div>
    </div>
    ` : ""}

    <div class="section">
        <div class="section-title">🛒 ITENS</div>
        <div class="item">
            <div>
                <span class="item-qty">${order.quantity}x</span>
                <span class="item-name">${order.productName}</span>
            </div>
            <div class="item-price">${formatCurrency(order.productPrice)}</div>
        </div>
    </div>

    <div class="section">
        <div class="item">
            <div>Subtotal</div>
            <div>${formatCurrency(subtotal)}</div>
        </div>
        ${deliveryFee > 0 ? `
        <div class="item">
            <div>Taxa de entrega</div>
            <div>${formatCurrency(deliveryFee)}</div>
        </div>
        ` : ""}
        <div class="item total">
            <div>TOTAL</div>
            <div>${formatCurrency(total)}</div>
        </div>
    </div>

    ${order.customerNotes ? `
    <div class="notes">
        <div class="section-title">📝 OBSERVAÇÕES</div>
        ${order.customerNotes}
    </div>
    ` : ""}

    <div class="footer">
        <div>Pedido gerado automaticamente</div>
        <div>${new Date().toLocaleString("pt-BR")}</div>
    </div>

    <script>
        // Auto-focus window for printing
        window.onload = function() {
            // Uncomment to auto-print:
            // window.print();
        };
    </script>
</body>
</html>
        `.trim();

        return new NextResponse(html, {
            headers: {
                "Content-Type": "text/html; charset=utf-8",
            },
        });
    } catch (error) {
        logger.error("[Print Order] Error", { error, route: "/api/orders/[id]/print" });
        return new NextResponse("Erro ao gerar impressão", { status: 500 });
    }
}
