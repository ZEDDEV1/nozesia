#!/bin/bash

# ============================================
# NozesIA - Script de Atualização
# ============================================

echo ""
echo "╔════════════════════════════════════════════╗"
echo "║      NozesIA - Atualizar Produção          ║"
echo "╚════════════════════════════════════════════╝"
echo ""

# Ir para pasta do projeto
cd ~/htdocs/nozesia.pro

echo "[1/5] Baixando atualizações do GitHub..."
git pull origin main

echo ""
echo "[2/5] Instalando dependências..."
npm install

echo ""
echo "[3/5] Gerando cliente Prisma..."
npx prisma generate

echo ""
echo "[4/5] Fazendo build..."
npm run build

echo ""
echo "[5/5] Reiniciando aplicação..."
pm2 restart all

echo ""
echo "════════════════════════════════════════════"
echo "✅ Atualização concluída!"
pm2 status
echo "════════════════════════════════════════════"
