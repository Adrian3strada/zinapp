# Build EAS (preview APK o production AAB)
# Uso:
#   .\scripts\eas-build.ps1 -Profile preview
#   .\scripts\eas-build.ps1 -Profile production -ApiUrl https://api.zinapp.mx/api

param(
    [ValidateSet('preview', 'production')]
    [string]$Profile = 'preview',
    [string]$ApiUrl = '',
    [ValidateSet('android', 'ios', 'all')]
    [string]$Platform = 'android'
)

$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot\..

if ($ApiUrl) {
    $env:EXPO_PUBLIC_API_URL = $ApiUrl
}

if (-not (Get-Command eas -ErrorAction SilentlyContinue)) {
    Write-Host "Instalando eas-cli..." -ForegroundColor Cyan
    npm install -g eas-cli
}

$whoami = eas whoami 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Host "Inicia sesión en Expo: eas login" -ForegroundColor Yellow
    exit 1
}

Write-Host "Cuenta Expo: $whoami" -ForegroundColor Green

if (-not (Test-Path "app.json")) {
    Write-Host "Ejecuta desde mobile/" -ForegroundColor Red
    exit 1
}

$appConfig = node -e "const c=require('./app.config.js'); console.log(JSON.stringify(c().extra))" 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Host $appConfig -ForegroundColor Red
    exit 1
}
$extra = $appConfig | ConvertFrom-Json
Write-Host "API en build: $($extra.apiUrl)" -ForegroundColor Green

Write-Host "Perfil: $Profile | Plataforma: $Platform" -ForegroundColor Cyan

if (-not (Select-String -Path "app.json" -Pattern "projectId" -Quiet)) {
    Write-Host "Primera vez: eas init (vincula el proyecto a Expo)" -ForegroundColor Yellow
    eas init --non-interactive 2>&1 | Out-Host
}

eas build --profile $Profile --platform $Platform --non-interactive
