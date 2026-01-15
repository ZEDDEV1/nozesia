@echo off
chcp 65001 >nul
title NozesIA - Enviar Atualizações

echo.
echo ╔════════════════════════════════════════════╗
echo ║      NozesIA - Enviar Atualizações         ║
echo ╚════════════════════════════════════════════╝
echo.

cd /d "C:\Users\Saymon\Desktop\PROJETOS\nozesia"

echo [1/4] Verificando alterações...
git status --short
echo.

set /p MSG="Digite a mensagem do commit (ou Enter para 'Update'): "
if "%MSG%"=="" set MSG=Update

echo.
echo [2/4] Adicionando arquivos...
git add .

echo.
echo [3/4] Fazendo commit: %MSG%
git commit -m "%MSG%"

echo.
echo [4/4] Enviando para GitHub...
git push origin main

echo.
echo ════════════════════════════════════════════
echo ✅ Atualizações enviadas com sucesso!
echo.
echo Agora conecte na VPS e execute:
echo   su - nozesia
echo   cd htdocs/nozesia.pro
echo   ./atualizar.sh
echo ════════════════════════════════════════════
echo.

pause
