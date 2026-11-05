@echo off
chcp 65001 >nul
title Burguer e Sabor - resetar dados
cd /d "%~dp0backend"
echo Isto APAGA todos os pedidos e cadastros e volta aos dados de exemplo.
choice /m "Continuar"
if errorlevel 2 exit /b 0
if not exist node_modules call npm install
call npm run db:reset
pause
