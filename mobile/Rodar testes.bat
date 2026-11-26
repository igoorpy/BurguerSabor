@echo off
chcp 65001 >nul
title Burguer e Sabor - testes
cd /d "%~dp0"
call flutter test > resultado-testes.txt 2>&1
type resultado-testes.txt
echo.
echo Resultado salvo em resultado-testes.txt
pause
