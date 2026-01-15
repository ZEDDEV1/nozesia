#!/bin/bash
set -e

# ============================================
# Deploy Script - LumusAI Production
# ============================================
# Automatiza o processo de deploy para produção
#
# Uso:
#   chmod +x deploy.sh
#   ./deploy.sh
# ============================================

# Cores para output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Variáveis
PROJECT_DIR="/home/lumusai/htdocs/lumusai.com.br"
BRANCH="main"

echo -e "${BLUE}"
echo "╔════════════════════════════════════════════╗"
echo "║      🚀 Deploy LumusAI - Produção          ║"
echo "╚════════════════════════════════════════════╝"
echo -e "${NC}"

# Verificar se está no diretório correto
if [ ! -d "$PROJECT_DIR" ]; then
    echo -e "${RED}❌ Erro: Diretório $PROJECT_DIR não encontrado${NC}"
    exit 1
fi

cd $PROJECT_DIR

# ============================================
# 1. Backup do banco de dados
# ============================================
echo -e "${YELLOW}📦 1/10 - Criando backup do banco de dados...${NC}"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="$PROJECT_DIR/backups"
mkdir -p $BACKUP_DIR

# Executar backup (ajustar credenciais conforme seu .env)
pg_dump -U lumusai_user lumusai_db | gzip > $BACKUP_DIR/backup_$TIMESTAMP.sql.gz
echo -e "${GREEN}✅ Backup criado: backup_$TIMESTAMP.sql.gz${NC}"

# ============================================
# 2. Atualizar código do repositório
# ============================================
echo -e "${YELLOW}📥 2/10 - Atualizando código do git...${NC}"
git fetch origin
git checkout $BRANCH
git pull origin $BRANCH
echo -e "${GREEN}✅ Código atualizado${NC}"

# ============================================
# 3. Instalar/Atualizar dependências
# ============================================
echo -e "${YELLOW}📦 3/10 - Instalando dependências do Node.js...${NC}"
npm ci --production=false
echo -e "${GREEN}✅ Dependências instaladas${NC}"

# ============================================
# 4. Gerar Prisma Client
# ============================================
echo -e "${YELLOW}🔧 4/10 - Gerando Prisma Client...${NC}"
npx prisma generate
echo -e "${GREEN}✅ Prisma Client gerado${NC}"

# ============================================
# 5. Executar migrations do banco
# ============================================
echo -e "${YELLOW}🗄️  5/10 - Executando migrations do banco...${NC}"
npx prisma migrate deploy
echo -e "${GREEN}✅ Migrations aplicadas${NC}"

# ============================================
# 6. Build da aplicação Next.js
# ============================================
echo -e "${YELLOW}🏗️  6/10 - Building aplicação Next.js...${NC}"
npm run build
echo -e "${GREEN}✅ Build concluído${NC}"

# ============================================
# 7. Instalar dependências do WPPConnect
# ============================================
echo -e "${YELLOW}📦 7/10 - Instalando dependências do WPPConnect...${NC}"
cd wppconnect-server
npm ci --production
cd ..
echo -e "${GREEN}✅ WPPConnect configurado${NC}"

# ============================================
# 8. Limpar cache do Next.js (opcional)
# ============================================
echo -e "${YELLOW}🧹 8/10 - Limpando cache...${NC}"
rm -rf .next/cache
echo -e "${GREEN}✅ Cache limpo${NC}"

# ============================================
# 9. Reiniciar serviços PM2
# ============================================
echo -e "${YELLOW}🔄 9/10 - Reiniciando serviços PM2...${NC}"
pm2 restart ecosystem.config.js --update-env
echo -e "${GREEN}✅ Serviços reiniciados${NC}"

# ============================================
# 10. Salvar configuração PM2
# ============================================
echo -e "${YELLOW}💾 10/10 - Salvando configuração PM2...${NC}"
pm2 save
echo -e "${GREEN}✅ Configuração salva${NC}"

# ============================================
# Verificação final
# ============================================
echo ""
echo -e "${BLUE}═══════════════════════════════════════════${NC}"
echo -e "${GREEN}✅ Deploy concluído com sucesso!${NC}"
echo -e "${BLUE}═══════════════════════════════════════════${NC}"
echo ""
echo -e "${YELLOW}📊 Status dos serviços:${NC}"
pm2 status
echo ""
echo -e "${YELLOW}📝 Para ver os logs em tempo real:${NC}"
echo "   pm2 logs"
echo ""
echo -e "${YELLOW}🔍 Para verificar um serviço específico:${NC}"
echo "   pm2 logs lumusai-app"
echo "   pm2 logs lumusai-worker"
echo "   pm2 logs lumusai-wpp"
echo ""
echo -e "${GREEN}🎉 Deploy finalizado! Acesse: https://lumusai.com.br${NC}"
echo ""
