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
$env:EXPO_PUBLIC_API_URL = 'https://zinapp.com.mx/api'
$env:EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID = '470068451846-ru6vr0359ueij7p53l3nquab05hhkaa2.apps.googleusercontent.com'
$env:EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID = '470068451846-1pi2jua9f1q547krpp4fobgoskfh80kd.apps.googleusercontent.com'
$env:EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID = '470068451846-lrh08ejsbr6i9j0vjibnshqvb5spe81e.apps.googleusercontent.com'

if (-not (Get-Command npx -ErrorAction SilentlyContinue)) {
    Write-Host 'Node.js/npx requerido.' -ForegroundColor Red
    exit 1
}

npx expo start --web
