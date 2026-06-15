# Subir API a Railway (HTTPS incluido, sin VPS propio)
# Uso: .\scripts\deploy-railway.ps1

$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot\..

function Ensure-Railway {
    if (-not (Get-Command railway -ErrorAction SilentlyContinue)) {
        Write-Host "Instalando Railway CLI..." -ForegroundColor Cyan
        npm install -g @railway/cli
    }
}

Ensure-Railway

$whoami = railway whoami 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Host "Inicia sesion en Railway (se abrira el navegador)..." -ForegroundColor Yellow
    railway login
}

if (-not (Test-Path ".railway")) {
    Write-Host "Creando proyecto zinapp-api..." -ForegroundColor Cyan
    railway init --name zinapp-api
}

Write-Host "PostgreSQL (ignora error si ya existe)..." -ForegroundColor Cyan
railway add --database postgres 2>&1 | Out-Null

$secretKey = python -c "from django.core.management.utils import get_random_secret_key; print(get_random_secret_key())"
Write-Host "Variables de entorno..." -ForegroundColor Cyan
railway variables --set "DEBUG=False"
railway variables --set "USE_SQLITE=False"
railway variables --set "SECRET_KEY=$secretKey"
railway variables --set "ALLOWED_HOSTS=.railway.app"
railway variables --set "SERVE_MEDIA=True"

Write-Host "Desplegando (3-5 min)..." -ForegroundColor Cyan
railway up --detach

Write-Host ""
Write-Host "Dominio publico:" -ForegroundColor Cyan
railway domain

Write-Host ""
Write-Host "=== SIGUIENTE PASO ===" -ForegroundColor Green
Write-Host "1. Copia la URL (ej. https://zinapp-api-production.up.railway.app)"
Write-Host "2. En mobile/eas.json cambia EXPO_PUBLIC_API_URL a: https://TU-URL/api"
Write-Host "3. cd ..\mobile"
Write-Host "4. eas build --profile preview --platform android"
