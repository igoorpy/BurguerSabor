@echo off
chcp 65001 >nul
title Diagnostico do banco
echo Verificando o PostgreSQL deste computador...
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0backend\scripts\diagnostico.ps1"
echo.
echo Pode fechar esta janela.
pause
