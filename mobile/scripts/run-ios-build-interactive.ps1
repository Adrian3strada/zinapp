# Abre build iOS interactivo (Apple ID + 2FA). Ejecutar con doble clic o desde PowerShell.
$ErrorActionPreference = 'Stop'
Set-Location $PSScriptRoot\..

$env:Path = "C:\Program Files\nodejs;$env:APPDATA\npm;C:\Program Files\Git\cmd;" + $env:Path
$env:EXPO_PUBLIC_ENV = 'production'
$env:EAS_BUILD_NO_EXPO_GO_WARNING = 'true'

Write-Host ''
Write-Host '=== ZinApp — Build iOS para App Store ===' -ForegroundColor Cyan
Write-Host ''
Write-Host 'Cuando EAS pregunte:' -ForegroundColor Yellow
Write-Host '  - Apple ID: adrianestradachavez123@gmail.com'
Write-Host '  - Generar certificados nuevos: Si / Yes'
Write-Host '  - Codigo 2FA: el que llegue a tu iPhone/Mac'
Write-Host ''

eas whoami
if ($LASTEXITCODE -ne 0) {
    Write-Host 'Iniciando login Expo...' -ForegroundColor Yellow
    eas login --browser
}

Write-Host ''
Write-Host 'Iniciando build (15-25 min en la nube)...' -ForegroundColor Green
eas build --profile production --platform ios

Write-Host ''
if ($LASTEXITCODE -eq 0) {
    Write-Host 'Build enviado. Sigue en: https://expo.dev/accounts/g2adriaans-team/projects/zinapp/builds' -ForegroundColor Green
    Write-Host ''
    $submit = Read-Host 'Cuando termine el build, subir a App Store Connect? (s/N)'
    if ($submit -match '^[sSyY]') {
        eas submit --profile production --platform ios --latest
    }
} else {
    Write-Host 'Build fallo. Revisa el mensaje arriba.' -ForegroundColor Red
}

Read-Host 'Pulsa Enter para cerrar'
