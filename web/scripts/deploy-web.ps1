# Railway: landing Next.js (Caddy + Next) como origen público de zinapp.com.mx
# Uso: .\scripts\deploy-web.ps1
# El root directory del servicio en Railway debe ser `web/`.

param(
    [string]$DjangoOrigin = 'http://zinapp-api.railway.internal:8000',
    [string]$SiteUrl = 'https://zinapp.com.mx'
)

$ErrorActionPreference = 'Stop'
Set-Location $PSScriptRoot\..

$serviceName = 'zinapp-web'

function Ensure-Railway {
    if (-not (Get-Command railway -ErrorAction SilentlyContinue)) {
        Write-Host 'Instalando Railway CLI...' -ForegroundColor Cyan
        npm install -g @railway/cli
    }
}

Ensure-Railway

$whoami = railway whoami 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Host 'Inicia sesion en Railway...' -ForegroundColor Yellow
    railway login
}

railway variable set "DJANGO_ORIGIN=$DjangoOrigin" --service $serviceName
railway variable set "SITE_URL=$SiteUrl" --service $serviceName
railway variable set NODE_ENV=production --service $serviceName

Write-Host 'Desplegando landing Next.js...' -ForegroundColor Cyan
railway up --detach --service $serviceName

Write-Host ''
Write-Host 'Tras el deploy:' -ForegroundColor Yellow
Write-Host '1. En Railway, apunta zinapp.com.mx y www al servicio zinapp-web.'
Write-Host '2. Deja zinapp-api en red privada (o railway.app solo para health interno).'
Write-Host '3. Django sigue sirviendo /api /app /panel /pos /media /static /ws via Caddy.'
Write-Host "Health landing: $SiteUrl/"
Write-Host "Health API:     $SiteUrl/api/health/"
