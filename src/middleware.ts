/**
 * Next.js Middleware - Auth Protection + Security Headers + Rate Limiting
 * 
 * Protege rotas automaticamente sem precisar verificar auth em cada API.
 * 
 * RECURSOS:
 * 1. Autenticação JWT
 * 2. Rate Limiting por IP/User
 * 3. Security Headers (CSP, X-Frame-Options, etc)
 * 
 * Rotas protegidas:
 * - /dashboard/* - Requer autenticação (qualquer role)
 * - /admin/* - Requer SUPER_ADMIN
 * - /api/* - Exceto /api/auth/*, /api/webhooks/*
 */

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { jwtVerify } from 'jose';
import { checkRateLimitSync } from '@/lib/rate-limit';

const COOKIE_NAME = 'auth-token';

// Rotas públicas que não precisam de autenticação
const PUBLIC_PATHS = [
    '/',
    '/login',
    '/register',
    '/2fa',                    // 2FA verification during login
    '/auth/verify-email',
    '/auth/reset-password',
    '/auth/forgot-password',   // Forgot password page
    '/termos',
    '/privacidade',
];

// Rotas de API públicas
const PUBLIC_API_PATHS = [
    '/api/auth/login',
    '/api/auth/register',
    '/api/auth/forgot-password',
    '/api/auth/reset-password',
    '/api/auth/verify-email',
    '/api/auth/resend-verification',
    '/api/auth/2fa/verify',    // 2FA verification during login
    '/api/webhooks',           // Mercado Pago webhooks
    '/api/whatsapp/webhook',   // WhatsApp incoming messages
    '/api/health',             // Health check
    '/api/plans',              // Planos são públicos para exibir na landing
];

// Rotas que requerem SUPER_ADMIN
const ADMIN_PATHS = [
    '/admin',
    '/api/admin',
];

interface JWTPayload {
    userId: string;
    email: string;
    role: 'SUPER_ADMIN' | 'COMPANY_ADMIN' | 'COMPANY_USER';
    companyId: string | null;
}

/**
 * Verifica e decodifica o token JWT
 */
async function verifyToken(token: string): Promise<JWTPayload | null> {
    try {
        const secret = new TextEncoder().encode(
            process.env.JWT_SECRET || process.env.NEXTAUTH_SECRET
        );

        const { payload } = await jwtVerify(token, secret);
        return payload as unknown as JWTPayload;
    } catch {
        return null;
    }
}

/**
 * Verifica se o path é público
 */
function isPublicPath(pathname: string): boolean {
    // Check exact matches
    if (PUBLIC_PATHS.includes(pathname)) return true;

    // Check API paths
    for (const path of PUBLIC_API_PATHS) {
        if (pathname.startsWith(path)) return true;
    }

    // Static files and Next.js internals
    if (
        pathname.startsWith('/_next') ||
        pathname.startsWith('/favicon') ||
        pathname.includes('.') // Files with extensions
    ) {
        return true;
    }

    return false;
}

/**
 * Verifica se o path requer SUPER_ADMIN
 */
function requiresAdminRole(pathname: string): boolean {
    return ADMIN_PATHS.some(path => pathname.startsWith(path));
}

// Rotas que devem redirecionar usuários autenticados para dashboard
const AUTH_REDIRECT_PATHS = [
    '/',
    '/login',
    '/register',
];

// ============================================
// SECURITY HEADERS
// ============================================

/**
 * Content Security Policy - Previne XSS e injeção de código
 */
const CSP_DIRECTIVES = [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' 'unsafe-eval'",  // Next.js precisa de unsafe-eval em dev
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "img-src 'self' data: blob: https: http:",  // Permite imagens de qualquer HTTPS
    "font-src 'self' https://fonts.gstatic.com",
    "connect-src 'self' https://api.openai.com wss: ws:",  // WebSocket para Socket.io
    "frame-ancestors 'none'",  // Previne clickjacking
    "base-uri 'self'",
    "form-action 'self'",
].join('; ');

/**
 * Aplica headers de segurança à resposta
 */
function applySecurityHeaders(response: NextResponse): NextResponse {
    // CSP - Content Security Policy
    response.headers.set('Content-Security-Policy', CSP_DIRECTIVES);

    // Previne clickjacking
    response.headers.set('X-Frame-Options', 'DENY');

    // Previne MIME type sniffing
    response.headers.set('X-Content-Type-Options', 'nosniff');

    // Habilita XSS filter do navegador
    response.headers.set('X-XSS-Protection', '1; mode=block');

    // Força HTTPS (em produção)
    if (process.env.NODE_ENV === 'production') {
        response.headers.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
    }

    // Controla referrer
    response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');

    // Permissions Policy (desabilita features não usadas)
    response.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');

    return response;
}

// ============================================
// RATE LIMITING
// ============================================
// Usa o módulo rate-limit.ts que suporta Redis (distribuído)
// com fallback automático para memória se Redis não estiver disponível.
// Ver: src/lib/rate-limit.ts

// Configurações específicas do middleware (mais permissivas para suportar muitos clientes)
const MIDDLEWARE_RATE_LIMITS = {
    api: { windowMs: 60000, maxRequests: 500 },       // 500 req/min para APIs
    auth: { windowMs: 60000, maxRequests: 10 },       // 10 req/min para auth (brute force)
};

/**
 * Helper para rate limiting no middleware
 * Usa a implementação centralizada de rate-limit.ts
 */
function checkMiddlewareRateLimit(ip: string, type: 'api' | 'auth'): { allowed: boolean; remaining: number } {
    const config = MIDDLEWARE_RATE_LIMITS[type];
    const result = checkRateLimitSync(`middleware:${type}:ip:${ip}`, config);
    return { allowed: result.allowed, remaining: result.remaining };
}

export async function middleware(request: NextRequest) {
    const { pathname } = request.nextUrl;
    const token = request.cookies.get(COOKIE_NAME)?.value;

    // Extrair IP do cliente
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
        || request.headers.get('x-real-ip')
        || 'unknown';

    // Rate Limiting para rotas de auth (proteção contra brute force)
    if (pathname.startsWith('/api/auth/')) {
        const rateLimit = checkMiddlewareRateLimit(ip, 'auth');
        if (!rateLimit.allowed) {
            const response = NextResponse.json(
                { success: false, error: 'Muitas tenta­tivas. Aguarde 1 minuto.' },
                { status: 429 }
            );
            response.headers.set('Retry-After', '60');
            response.headers.set('X-RateLimit-Remaining', '0');
            return applySecurityHeaders(response);
        }
    }

    // Rate Limiting para outras APIs
    if (pathname.startsWith('/api/') && !pathname.startsWith('/api/auth/')) {
        const rateLimit = checkMiddlewareRateLimit(ip, 'api');
        if (!rateLimit.allowed) {
            const response = NextResponse.json(
                { success: false, error: 'Limite de requisições excedido. Aguarde 1 minuto.' },
                { status: 429 }
            );
            response.headers.set('Retry-After', '60');
            response.headers.set('X-RateLimit-Remaining', '0');
            return applySecurityHeaders(response);
        }
    }

    // Se é uma rota de auth/landing e usuário está autenticado, redireciona para dashboard
    if (AUTH_REDIRECT_PATHS.includes(pathname) && token) {
        const payload = await verifyToken(token);
        if (payload) {
            // Redireciona para admin se for SUPER_ADMIN, senão para dashboard
            const redirectUrl = payload.role === 'SUPER_ADMIN' ? '/admin' : '/dashboard';
            return NextResponse.redirect(new URL(redirectUrl, request.url));
        }
    }

    // Permitir rotas públicas (para usuários não autenticados)
    if (isPublicPath(pathname)) {
        const response = NextResponse.next();
        return applySecurityHeaders(response);
    }

    // Sem token = redireciona para login
    if (!token) {
        // Para APIs, retorna 401
        if (pathname.startsWith('/api/')) {
            return NextResponse.json(
                { success: false, error: 'Não autorizado' },
                { status: 401 }
            );
        }

        // Para páginas, redireciona para login
        const loginUrl = new URL('/login', request.url);
        loginUrl.searchParams.set('callbackUrl', pathname);
        return NextResponse.redirect(loginUrl);
    }

    // Verificar token
    const payload = await verifyToken(token);

    if (!payload) {
        // Token inválido/expirado
        if (pathname.startsWith('/api/')) {
            return NextResponse.json(
                { success: false, error: 'Token inválido ou expirado' },
                { status: 401 }
            );
        }

        // Limpar cookie e redirecionar
        const response = NextResponse.redirect(new URL('/login', request.url));
        response.cookies.delete(COOKIE_NAME);
        return response;
    }

    // Verificar acesso admin
    if (requiresAdminRole(pathname)) {
        if (payload.role !== 'SUPER_ADMIN') {
            // Para APIs, retorna 403
            if (pathname.startsWith('/api/')) {
                return NextResponse.json(
                    { success: false, error: 'Acesso negado. Requer privilégios de administrador.' },
                    { status: 403 }
                );
            }

            // Para páginas, redireciona para dashboard
            return NextResponse.redirect(new URL('/dashboard', request.url));
        }
    }

    // Adicionar headers com info do usuário para uso nas APIs
    const requestHeaders = new Headers(request.headers);
    requestHeaders.set('x-user-id', payload.userId);
    requestHeaders.set('x-user-email', payload.email);
    requestHeaders.set('x-user-role', payload.role);
    if (payload.companyId) {
        requestHeaders.set('x-company-id', payload.companyId);
    }

    const response = NextResponse.next({
        request: {
            headers: requestHeaders,
        },
    });

    // Aplicar headers de segurança em todas as respostas
    return applySecurityHeaders(response);
}

// Definir em quais rotas o middleware deve rodar
export const config = {
    matcher: [
        /*
         * Match all request paths except:
         * - _next/static (static files)
         * - _next/image (image optimization files)
         * - favicon.ico (favicon file)
         * - public files (public folder)
         */
        '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)',
    ],
};
