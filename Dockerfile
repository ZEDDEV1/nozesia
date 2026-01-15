# ============================================
# Dockerfile - LumusAI Production
# ============================================
# Multi-stage build para imagem otimizada
#
# USO:
#   docker build -t lumusai .
#   docker run -p 3000:3000 --env-file .env lumusai
# ============================================

# ============================================
# Stage 1: Dependencies
# ============================================
FROM node:20-alpine AS deps
WORKDIR /app

# Instalar dependências do sistema necessárias para Prisma
RUN apk add --no-cache libc6-compat openssl

# Copiar apenas arquivos de dependências
COPY package.json package-lock.json ./
COPY prisma ./prisma/

# Instalar dependências
RUN npm ci

# ============================================
# Stage 2: Builder
# ============================================
FROM node:20-alpine AS builder
WORKDIR /app

# Instalar dependências do sistema
RUN apk add --no-cache libc6-compat openssl

# Copiar dependências do stage anterior
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Gerar Prisma Client
RUN npx prisma generate

# Build da aplicação
# Standalone output para imagem menor
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production

RUN npm run build

# ============================================
# Stage 3: Runner (Produção)
# ============================================
FROM node:20-alpine AS runner
WORKDIR /app

# Instalar dependências do sistema
RUN apk add --no-cache libc6-compat openssl

# Criar usuário não-root para segurança
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Configurar ambiente
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# Copiar arquivos necessários do builder
COPY --from=builder /app/public ./public
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/package.json ./package.json

# Copiar standalone build
# Next.js standalone mode cria tudo em .next/standalone
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

# Copiar node_modules para prisma funcionar
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma

# Usar usuário não-root
USER nextjs

# Expor porta
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:3000/api/health || exit 1

# Comando de inicialização
CMD ["node", "server.js"]
