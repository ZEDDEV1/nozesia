#!/bin/bash
set -e

# ============================================
# Setup Inicial do Servidor - LumusAI
# ============================================
# Este script deve ser executado UMA VEZ no servidor
# após fazer o clone do repositório pela primeira vez
#
# Uso:
#   chmod +x setup-production.sh
#   ./setup-production.sh
# ============================================

# Cores
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}"
echo "╔════════════════════════════════════════════╗"
echo "║    🔧 Setup Inicial - LumusAI Production   ║"
echo "╚════════════════════════════════════════════╝"
echo -e "${NC}"

# Verificar se é root
if [ "$EUID" -eq 0 ]; then 
    echo -e "${RED}❌ Não execute este script como root!${NC}"
    exit 1
fi

PROJECT_DIR=$(pwd)
echo -e "${YELLOW}📁 Diretório do projeto: $PROJECT_DIR${NC}"

# ============================================
# 1. Verificar dependências do sistema
# ============================================
echo -e "${YELLOW}📋 1/12 - Verificando dependências do sistema...${NC}"

# Node.js
if ! command -v node &> /dev/null; then
    echo -e "${RED}❌ Node.js não encontrado. Instale Node.js 20+${NC}"
    exit 1
fi
echo -e "${GREEN}✅ Node.js $(node --version)${NC}"

# npm
if ! command -v npm &> /dev/null; then
    echo -e "${RED}❌ npm não encontrado${NC}"
    exit 1
fi
echo -e "${GREEN}✅ npm $(npm --version)${NC}"

# PostgreSQL
if ! command -v psql &> /dev/null; then
    echo -e "${YELLOW}⚠️  PostgreSQL client não encontrado (pode estar ok se o banco for externo)${NC}"
else
    echo -e "${GREEN}✅ PostgreSQL disponível${NC}"
fi

# Redis
if ! command -v redis-cli &> /dev/null; then
    echo -e "${RED}❌ Redis não encontrado. Instale com: sudo apt install redis-server${NC}"
    exit 1
fi
echo -e "${GREEN}✅ Redis disponível${NC}"

# PM2
if ! command -v pm2 &> /dev/null; then
    echo -e "${YELLOW}⚠️  PM2 não encontrado. Instalando globalmente...${NC}"
    sudo npm install -g pm2
fi
echo -e "${GREEN}✅ PM2 $(pm2 --version)${NC}"

# ============================================
# 2. Verificar arquivo .env
# ============================================
echo -e "${YELLOW}🔐 2/12 - Verificando arquivo .env...${NC}"

if [ ! -f ".env" ]; then
    if [ -f ".env.production" ]; then
        echo -e "${YELLOW}⚠️  Copiando .env.production para .env${NC}"
        cp .env.production .env
    else
        echo -e "${RED}❌ Arquivo .env não encontrado. Crie um baseado em .env.example${NC}"
        exit 1
    fi
fi
echo -e "${GREEN}✅ Arquivo .env encontrado${NC}"

# ============================================
# 3. Criar diretórios necessários
# ============================================
echo -e "${YELLOW}📁 3/12 - Criando diretórios necessários...${NC}"

mkdir -p logs
mkdir -p backups
mkdir -p wppconnect-server/tokens
mkdir -p public/uploads

echo -e "${GREEN}✅ Diretórios criados${NC}"

# ============================================
# 4. Instalar dependências do projeto
# ============================================
echo -e "${YELLOW}📦 4/12 - Instalando dependências do Node.js...${NC}"
npm ci
echo -e "${GREEN}✅ Dependências instaladas${NC}"

# ============================================
# 5. Gerar Prisma Client
# ============================================
echo -e "${YELLOW}🔧 5/12 - Gerando Prisma Client...${NC}"
npx prisma generate
echo -e "${GREEN}✅ Prisma Client gerado${NC}"

# ============================================
# 6. Executar migrations do banco
# ============================================
echo -e "${YELLOW}🗄️  6/12 - Aplicando migrations do banco...${NC}"
echo -e "${YELLOW}⚠️  Certifique-se de que o PostgreSQL está configurado corretamente no .env${NC}"
read -p "Continuar com migrations? (s/n) " -n 1 -r
echo
if [[ $REPLY =~ ^[Ss]$ ]]; then
    npx prisma migrate deploy
    echo -e "${GREEN}✅ Migrations aplicadas${NC}"
else
    echo -e "${YELLOW}⏭️  Migrations puladas (lembre-se de executar depois)${NC}"
fi

# ============================================
# 7. (OPCIONAL) Seed do banco
# ============================================
echo -e "${YELLOW}🌱 7/12 - Executar seed do banco (criar planos padrão)?${NC}"
read -p "Executar seed? (s/n) " -n 1 -r
echo
if [[ $REPLY =~ ^[Ss]$ ]]; then
    npx prisma db seed
    echo -e "${GREEN}✅ Seed executado${NC}"
else
    echo -e "${YELLOW}⏭️  Seed pulado${NC}"
fi

# ============================================
# 8. Build da aplicação
# ============================================
echo -e "${YELLOW}🏗️  8/12 - Building aplicação Next.js...${NC}"
npm run build
echo -e "${GREEN}✅ Build concluído${NC}"

# ============================================
# 9. Instalar dependências do WPPConnect
# ============================================
echo -e "${YELLOW}📦 9/12 - Configurando WPPConnect Server...${NC}"
cd wppconnect-server
npm ci --production
cd ..
echo -e "${GREEN}✅ WPPConnect configurado${NC}"

# ============================================
# 10. Iniciar aplicação com PM2
# ============================================
echo -e "${YELLOW}🚀 10/12 - Iniciando aplicação com PM2...${NC}"
pm2 delete all 2>/dev/null || true  # Limpar processos antigos
pm2 start ecosystem.config.js
echo -e "${GREEN}✅ Aplicação iniciada${NC}"

# ============================================
# 11. Salvar configuração PM2
# ============================================
echo -e "${YELLOW}💾 11/12 - Salvando configuração PM2...${NC}"
pm2 save
echo -e "${GREEN}✅ Configuração salva${NC}"

# ============================================
# 12. Configurar PM2 para iniciar no boot
# ============================================
echo -e "${YELLOW}🔄 12/12 - Configurando PM2 para iniciar no boot...${NC}"
echo -e "${YELLOW}Execute o comando abaixo (será exibido pelo PM2):${NC}"
pm2 startup

# ============================================
# Finalização
# ============================================
echo ""
echo -e "${BLUE}═══════════════════════════════════════════${NC}"
echo -e "${GREEN}✅ Setup inicial concluído!${NC}"
echo -e "${BLUE}═══════════════════════════════════════════${NC}"
echo ""
echo -e "${YELLOW}📊 Status dos serviços:${NC}"
pm2 status
echo ""
echo -e "${YELLOW}📝 Próximos passos:${NC}"
echo ""
echo "1. ${BLUE}Execute o comando sugerido pelo PM2 acima (pm2 startup)${NC}"
echo ""
echo "2. ${BLUE}Configure o Nginx no CloudPanel:${NC}"
echo "   - Adicionar proxy para localhost:3000"
echo "   - Configurar SSL/HTTPS"
echo "   - Adicionar suporte WebSocket"
echo ""
echo "3. ${BLUE}Verificar variáveis de ambiente:${NC}"
echo "   nano .env"
echo ""
echo "4. ${BLUE}Trocar credenciais de produção:${NC}"
echo "   - NEXTAUTH_SECRET (gerar com: openssl rand -base64 32)"
echo "   - MERCADOPAGO (trocar TEST por PROD)"
echo "   - DATABASE_URL (senha strong)"
echo "   - GOOGLE_REDIRECT_URI (atualizar no Google Console)"
echo ""
echo "5. ${BLUE}Testar a aplicação:${NC}"
echo "   curl http://localhost:3000/api/health"
echo ""
echo -e "${GREEN}🎉 LumusAI pronto para produção!${NC}"
echo ""
