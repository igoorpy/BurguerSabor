@echo off
chcp 65001 >nul
title Burguer e Sabor - preparar projeto
cd /d "%~dp0"
echo ==============================================
echo   Preparando o projeto Flutter (so na primeira vez)
echo ==============================================
where flutter >nul 2>nul
if errorlevel 1 (
  echo.
  echo Flutter nao encontrado. Instale o Flutter SDK e coloque a pasta flutter\bin no PATH.
  echo Passo a passo no arquivo README.md desta pasta.
  pause
  exit /b 1
)
echo.
echo 1/3 Gerando os arquivos do Android...
call flutter create --platforms=android --org com.burguersabor --project-name burguer_sabor_app .
if errorlevel 1 goto erro
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\ajustar-nome.ps1"
echo.
echo 2/3 Baixando as bibliotecas (sqflite, path, crypto)...
call flutter pub get
if errorlevel 1 goto erro
echo.
echo 3/3 Aparelhos conectados:
call flutter devices
echo.
echo Pronto! Agora use "Rodar no celular.bat" (ou abra a pasta no Android Studio).
pause
exit /b 0
:erro
echo.
echo Algo deu errado. Leia a mensagem acima.
pause
exit /b 1
