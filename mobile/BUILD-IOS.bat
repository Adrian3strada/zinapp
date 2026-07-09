@echo off
title ZinApp - Build iOS App Store
cd /d "%~dp0"
set PATH=C:\Program Files\nodejs;%APPDATA%\npm;C:\Program Files\Git\cmd;%PATH%
set EXPO_PUBLIC_ENV=production
set EAS_BUILD_NO_EXPO_GO_WARNING=true

echo.
echo === ZinApp - Build iOS para App Store ===
echo.
echo Cuando EAS pregunte:
echo   Apple ID: adrianestradachavez123@gmail.com
echo   Generar certificados: Si
echo   Codigo 2FA: el de tu iPhone
echo.
pause

call eas whoami
if errorlevel 1 (
    echo Iniciando login Expo...
    call eas login --browser
)

echo.
echo Iniciando build...
call eas build --profile production --platform ios

echo.
if errorlevel 1 (
    echo BUILD FALLO - revisa el mensaje arriba
) else (
    echo BUILD ENVIADO
    echo Sigue en: https://expo.dev/accounts/g2adriaans-team/projects/zinapp/builds
    echo.
    set /p SUBMIT="Subir a App Store Connect cuando termine? (s/N): "
    if /i "%SUBMIT%"=="s" call eas submit --profile production --platform ios --latest
)

echo.
pause
