@echo off
chcp 65001 >nul
color 0A
echo ========================================================
echo      🚀 SISTEMA DE ATUALIZAÇÃO LUMUS AI
echo ========================================================
echo.
echo Este script vai enviar suas alteracoes para o GitHub.
echo.

:CONFIRM
set /p msg="📝 Descreva o que você mudou (Ex: corrigi cor do botao): "
if "%msg%"=="" goto CONFIRM

echo.
echo [1/3] 🔍 Preparando arquivos...
git add .

echo.
echo [2/3] 💾 Salvando alterações...
git commit -m "%msg%"

echo.
echo [3/3] ☁️  Enviando para a nuvem...
git push origin main

echo.
echo ========================================================
echo ✅ SUCESSO! Código enviado para o GitHub.
echo ========================================================
echo.
echo AGORA O ÚLTIMO PASSO:
echo 1. Abra o terminal da sua VPS (SSH)
echo 2. Digite: ./deploy.sh
echo.
pause
