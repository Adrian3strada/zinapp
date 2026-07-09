@echo off
title ZinApp - Subir a App Store Connect
cd /d "%~dp0"
set PATH=C:\Program Files\nodejs;%APPDATA%\npm;C:\Program Files\Git\cmd;%PATH%

echo.
echo === Subir build iOS a App Store Connect (TestFlight) ===
echo.
echo Si pide Apple ID: adrianestradachavez123@gmail.com
echo Si pide contrasena: usa contrasena de app de Apple (appleid.apple.com)
echo.

call eas submit --profile production --platform ios --latest

echo.
if errorlevel 1 (
    echo SUBMIT FALLO - revisa el mensaje arriba
) else (
    echo SUBMIT EXITOSO
    echo Revisa TestFlight en: https://appstoreconnect.apple.com
)

echo.
pause
