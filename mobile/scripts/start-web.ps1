# Servidor de desarrollo WEB (navegador). No uses "npm start" para la web.
# Uso: .\scripts\start-web.ps1

$ErrorActionPreference = 'Stop'
Set-Location $PSScriptRoot\..

Write-Host ''
Write-Host 'ZinApp - modo WEB (navegador)' -ForegroundColor Cyan
Write-Host '  URL:  http://localhost:8081' -ForegroundColor Green
Write-Host '  (Si ves JSON en el navegador, este script no estaba corriendo.)' -ForegroundColor Gray
Write-Host ''

$env:EXPO_PUBLIC_WEB_BASE_PATH = '/'

if (-not (Get-Command npx -ErrorAction SilentlyContinue)) {
    Write-Host 'Node.js/npx requerido.' -ForegroundColor Red
    exit 1
}

npx expo start --web
