@echo off
title Deploiement 2L MOTORS LOMBARDO sur Fly.io
echo ======================================================
echo    Deploiement de 2L MOTORS LOMBARDO sur Fly.io
echo ======================================================
echo.

set PATH=%PATH%;C:\Users\mario\.fly\bin

echo [1/3] Connexion a votre compte Fly.io...
echo Une page web va s'ouvrir. Cliquez sur "Continue with GitHub" pour valider.
call C:\Users\mario\.fly\bin\flyctl.exe auth login
echo.

echo [2/3] Verification de l'application...
call C:\Users\mario\.fly\bin\flyctl.exe launch --copy-config --yes --no-deploy
echo.

echo [3/3] Creation du stockage persistant SQLite et Deploiement...
call C:\Users\mario\.fly\bin\flyctl.exe deploy
echo.

echo ======================================================
echo    Deploiement termine !
echo ======================================================
pause

