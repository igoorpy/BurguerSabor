@echo off
chcp 65001 >nul
title Burguer e Sabor
cd /d "%~dp0backend"

echo ==============================================
echo   Burguer e Sabor - iniciando o sistema
echo ==============================================

where node >nul 2>nul
if errorlevel 1 (
  echo.
  echo Node.js nao encontrado. Instale a versao LTS em https://nodejs.org e rode este arquivo de novo.
  pause
  exit /b 1
)

if not exist node_modules (
  echo.
  echo Instalando as dependencias. Isso acontece so na primeira vez e pode levar alguns minutos...
  call npm install
  if errorlevel 1 goto erro
)

echo.
echo Preparando o banco de dados...
call node scripts\preparar.js
if errorlevel 1 goto erro

echo.
echo Compilando a API...
call npm run build
if errorlevel 1 (
  if not exist dist\main.js goto erro
  echo Aviso: a compilacao mostrou avisos acima, mas o sistema vai ligar mesmo assim.
)

echo.
echo Pronto! O site vai abrir no navegador em instantes.
echo   Site:    http://localhost:3000
echo   Swagger: http://localhost:3000/api-docs
echo Para desligar o sistema, feche esta janela.
echo.
start "" /min cmd /c "timeout /t 5 /nobreak >nul && start http://localhost:3000"
node dist\main.js
echo.
echo O sistema foi desligado.
pause
exit /b 0

:erro
echo.
echo Algo deu errado. Leia a mensagem acima; o README explica as solucoes mais comuns.
pause
exit /b 1
