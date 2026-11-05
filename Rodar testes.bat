@echo off
chcp 65001 >nul
title Burguer e Sabor - testes automatizados
cd /d "%~dp0backend"
if not exist node_modules (
  echo Instalando as dependencias, so na primeira vez...
  call npm install > ..\resultado-instalacao.txt 2>&1
  type ..\resultado-instalacao.txt
)
call node scripts\preparar.js
if errorlevel 1 goto fim
echo.
echo Rodando os testes. O resultado tambem fica salvo em resultado-testes.txt
echo.
call npm test > ..\resultado-testes.txt 2>&1
type ..\resultado-testes.txt
:fim
pause
