import { z } from "zod";

export const loginSchema = z.object({
    email: z.string().email("Email inválido"),
    password: z.string().min(6, "Senha deve ter no mínimo 6 caracteres"),
});

export const registerSchema = z.object({
    name: z.string().min(2, "Nome deve ter no mínimo 2 caracteres"),
    email: z.string().email("Email inválido"),
    password: z.string().min(6, "Senha deve ter no mínimo 6 caracteres"),
    companyName: z.string().min(2, "Nome da empresa deve ter no mínimo 2 caracteres"),
    companyNiche: z.string().min(3, "Informe o nicho/segmento da empresa"),
    companyDescription: z.string().optional(),
    phone: z.string().optional(),
});

export const agentSchema = z.object({
    name: z.string().min(2, "Nome deve ter no mínimo 2 caracteres"),
    description: z.string().optional(),
    personality: z.string().min(10, "Personalidade deve ter no mínimo 10 caracteres"),
    tone: z.string().optional(),
    canSell: z.boolean().default(false),
    canNegotiate: z.boolean().default(false),
    canSchedule: z.boolean().default(false),
    transferToHuman: z.boolean().default(true),
    // Voice Synthesis (TTS)
    voiceEnabled: z.boolean().default(false),
    voiceId: z.enum(["alloy", "echo", "fable", "onyx", "nova", "shimmer"]).default("nova"),
    workingHours: z
        .object({
            start: z.string(),
            end: z.string(),
            days: z.array(z.number()),
        })
        .optional(),
    isActive: z.boolean().default(true),
    isDefault: z.boolean().default(false),
});

export const trainingDataSchema = z.object({
    type: z.enum(["QA", "DOCUMENT", "PRODUCT", "FAQ", "SCRIPT", "POLICY"]),
    title: z.string().min(2, "Título deve ter no mínimo 2 caracteres"),
    content: z.string().min(10, "Conteúdo deve ter no mínimo 10 caracteres"),
    metadata: z.record(z.string(), z.any()).optional(),
});

export const companySchema = z.object({
    name: z.string().min(2, "Nome deve ter no mínimo 2 caracteres"),
    document: z.string().optional(),
    email: z.string().email("Email inválido"),
    phone: z.string().optional(),
    niche: z.string().optional(),
    description: z.string().optional(),
    timezone: z.string().default("America/Sao_Paulo"),
});

// Schema para admin atualizar empresa (todos campos opcionais)
export const adminUpdateCompanySchema = z.object({
    name: z.string().min(2, "Nome deve ter no mínimo 2 caracteres").optional(),
    email: z.string().email("Email inválido").optional(),
    phone: z.string().optional(),
    document: z.string().optional(),
    status: z.enum(["PENDING", "ACTIVE", "SUSPENDED", "CANCELLED"]).optional(),
    planId: z.string().optional(),
    timezone: z.string().optional(),
    monthlyTokenLimit: z.number().int().min(0).optional(),
    extraAgents: z.number().int().min(0).optional(),
    extraWhatsApps: z.number().int().min(0).optional(),
});

export const planSchema = z.object({
    name: z.string().min(2, "Nome deve ter no mínimo 2 caracteres"),
    type: z.enum(["TRIAL", "BASIC", "PRO", "ENTERPRISE"]),
    price: z.number().min(0, "Preço deve ser positivo"),
    maxWhatsAppNumbers: z.number().min(1),
    maxAgents: z.number().min(1),
    maxMessagesMonth: z.number().min(-1),
    maxTokensMonth: z.number().min(-1),
    features: z.array(z.string()).default([]),
    allowAudio: z.boolean().default(false),
    allowVoice: z.boolean().default(false),
    allowHumanTransfer: z.boolean().default(false),
    allowApiAccess: z.boolean().default(false),
    allowWhiteLabel: z.boolean().default(false),
    isActive: z.boolean().default(true),
});

export const userProfileSchema = z.object({
    name: z.string().min(2, "Nome deve ter no mínimo 2 caracteres"),
    email: z.string().email("Email inválido"),
    avatar: z.string().optional(),
});

export const passwordChangeSchema = z.object({
    currentPassword: z.string().min(6, "Senha atual é obrigatória"),
    newPassword: z.string().min(6, "Nova senha deve ter no mínimo 6 caracteres"),
});

export const teamInviteSchema = z.object({
    name: z.string().min(2, "Nome deve ter no mínimo 2 caracteres"),
    email: z.string().email("Email inválido"),
    role: z.enum(["COMPANY_ADMIN", "COMPANY_USER"]).default("COMPANY_USER"),
});

export type LoginInput = z.infer<typeof loginSchema>;
export type RegisterInput = z.infer<typeof registerSchema>;
export type AgentInput = z.infer<typeof agentSchema>;
export type TrainingDataInput = z.infer<typeof trainingDataSchema>;
export type CompanyInput = z.infer<typeof companySchema>;
export type PlanInput = z.infer<typeof planSchema>;
export type UserProfileInput = z.infer<typeof userProfileSchema>;
export type PasswordChangeInput = z.infer<typeof passwordChangeSchema>;
export type TeamInviteInput = z.infer<typeof teamInviteSchema>;

// ============================================
// SCHEMAS ADICIONAIS
// ============================================

export const sendMessageSchema = z.object({
    content: z.string().min(1, "Mensagem não pode estar vazia"),
    type: z.enum(["TEXT", "IMAGE", "AUDIO", "VIDEO", "DOCUMENT"]).default("TEXT"),
});

export const updateConversationSchema = z.object({
    status: z.enum(["OPEN", "AI_HANDLING", "HUMAN_HANDLING", "CLOSED"]).optional(),
    agentId: z.string().nullable().optional(),
});

export const forgotPasswordSchema = z.object({
    email: z.string().email("Email inválido"),
});

export const resetPasswordSchema = z.object({
    token: z.string().min(1, "Token é obrigatório"),
    password: z.string().min(6, "Senha deve ter no mínimo 6 caracteres"),
    confirmPassword: z.string().min(1, "Confirme a senha"),
}).refine((data) => data.password === data.confirmPassword, {
    message: "As senhas não coincidem",
    path: ["confirmPassword"],
});

export const createSessionSchema = z.object({
    sessionName: z.string().min(2, "Nome da sessão deve ter no mínimo 2 caracteres"),
    phoneNumber: z.string().optional(),
});

// ============================================
// ORDERS SCHEMAS
// ============================================

export const createOrderSchema = z.object({
    conversationId: z.string().min(1, "ID da conversa é obrigatório"),
    customerPhone: z.string().min(10, "Telefone do cliente é obrigatório"),
    customerName: z.string().optional(),
    productName: z.string().min(1, "Nome do produto é obrigatório"),
    productPrice: z.number().positive("Preço deve ser um valor positivo"),
    quantity: z.number().int().positive().default(1),
    pixKey: z.string().min(1, "Chave PIX é obrigatória"),
    pixKeyType: z.enum(["CPF", "CNPJ", "EMAIL", "TELEFONE", "ALEATORIA"]).optional(),
    deliveryType: z.enum(["DELIVERY", "PICKUP"]).optional(),
    deliveryAddress: z.string().optional(),
    deliveryFee: z.number().min(0).optional(),
});

export const updateOrderSchema = z.object({
    id: z.string().min(1, "ID do pedido é obrigatório"),
    status: z.enum([
        "AWAITING_PAYMENT",
        "PROOF_SENT",
        "VERIFIED",
        "SHIPPED",
        "DELIVERED",
        "CANCELLED"
    ]).optional(),
    paymentProof: z.string().optional(),
    notes: z.string().optional(),
});

// ============================================
// HELPER DE VALIDAÇÃO
// ============================================

import { NextResponse } from "next/server";
import { errorResponse } from "./api-response";

/**
 * Valida dados com schema Zod e retorna erro formatado se inválido
 * 
 * USO:
 * const validation = validateRequest(loginSchema, body);
 * if (!validation.success) return validation.response;
 * const { email, password } = validation.data;
 */
export function validateRequest<T>(
    schema: z.ZodSchema<T>,
    data: unknown
): { success: true; data: T } | { success: false; response: NextResponse } {
    const result = schema.safeParse(data);

    if (!result.success) {
        const firstError = result.error.issues[0];
        return {
            success: false,
            response: NextResponse.json(
                errorResponse(firstError.message),
                { status: 400 }
            ),
        };
    }

    return { success: true, data: result.data };
}

// Tipos adicionais
export type SendMessageInput = z.infer<typeof sendMessageSchema>;
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;

