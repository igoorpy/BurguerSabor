@echo off
chcp 65001 >nul
title Burguer e Sabor - rodar no celular
cd /d "%~dp0"
if not exist android (
  echo Rode primeiro o "Preparar projeto.bat".
  pause
  exit /b 1
)
echo ==============================================
echo   Instalando o app no celular conectado pelo USB
echo ==============================================
echo.
echo Celular precisa estar com a Depuracao USB ligada e o cabo conectado.
echo A PRIMEIRA vez demora (pode passar de 10 minutos). Depois fica rapido.
echo.
call flutter devices
echo.
echo Durante a execucao: r = atualizar o app com as mudancas do codigo, q = sair.
echo.
call flutter run
pause
