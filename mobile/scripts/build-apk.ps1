# Generar APK de prueba con EAS Build
# Uso: .\scripts\build-apk.ps1

$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot\..

Write-Host "ZinApp — build APK (perfil preview)" -ForegroundColor Cyan
Write-Host ""
Write-Host "Requisitos previos (solo la primera vez):" -ForegroundColor Yellow
Write-Host "  1. npm install -g eas-cli"
Write-Host "  2. eas login"
Write-Host "  3. eas init   (añade projectId en app.json → extra.eas.projectId)"
Write-Host "  4. Edita app.json → extra.apiUrl con la URL pública del backend"
Write-Host ""

if (-not (Get-Command eas -ErrorAction SilentlyContinue)) {
    Write-Host "Instala EAS CLI: npm install -g eas-cli" -ForegroundColor Red
    exit 1
}

Write-Host "Iniciando build Android APK..."
eas build -p android --profile preview --non-interactive

Write-Host ""
Write-Host "Cuando termine, descarga el APK desde el enlace que muestra EAS." -ForegroundColor Green
