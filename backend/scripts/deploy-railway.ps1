# Railway: PostgreSQL + API + migraciones
# Uso: .\scripts\deploy-railway.ps1
#      .\scripts\deploy-railway.ps1 -Seed

param(
    [switch]$Seed
)

$ErrorActionPreference = 'Stop'
Set-Location $PSScriptRoot\..

$serviceName = 'zinapp-api'

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

Write-Host 'PostgreSQL (ignora error si ya existe)...' -ForegroundColor Cyan
railway add --database postgres 2>&1 | Out-Null

$vars = @{}
try {
    $vars = railway variable list --service $serviceName --json | ConvertFrom-Json
} catch {
    $vars = @{}
}

if (-not $vars.SECRET_KEY) {
    $secretKey = python -c 'from django.core.management.utils import get_random_secret_key; print(get_random_secret_key())'
    railway variable set "SECRET_KEY=$secretKey" --service $serviceName
}

if (-not $vars.CRON_SECRET) {
    $cronSecret = -join ((48..57) + (65..90) + (97..122) | Get-Random -Count 48 | ForEach-Object { [char]$_ })
    railway variable set "CRON_SECRET=$cronSecret" --service $serviceName
    Write-Host "CRON_SECRET generado. Copialo en Railway > Variables para GitHub Actions." -ForegroundColor Yellow
}

Write-Host 'Variables de entorno (Postgres, sin SQLite)...' -ForegroundColor Cyan
railway variable set DEBUG=False --service $serviceName
railway variable set USE_SQLITE=False --service $serviceName
railway variable set ALLOWED_HOSTS=.railway.app --service $serviceName
railway variable set SERVE_MEDIA=True --service $serviceName
railway variable set DEMO_ACCOUNTS_ENABLED=False --service $serviceName
railway variable set SEED_DATA=false --service $serviceName
railway variable set RESET_APP_DATA=false --service $serviceName
railway variable set MEDIA_ROOT=/app/media --service $serviceName

if ($Seed) {
    railway variable set SEED_DATA=true --service $serviceName
    Write-Host 'SEED_DATA=true solo para esta corrida. Vuelve a false tras verificar.' -ForegroundColor Yellow
}

if (-not $vars.DATABASE_URL) {
    Write-Host 'Vinculando DATABASE_URL desde Postgres...' -ForegroundColor Cyan
    railway variable set 'DATABASE_URL=${{Postgres.DATABASE_URL}}' --service $serviceName
}

Write-Host 'Volumen persistente para fotos (/app/media)...' -ForegroundColor Cyan
try {
    $volumes = railway volume list --json 2>$null | ConvertFrom-Json
    $hasMediaVolume = $false
    if ($volumes) {
        foreach ($vol in @($volumes)) {
            $mount = if ($vol.mountPath) { $vol.mountPath } else { $vol.mount_path }
            if ($mount -eq '/app/media') { $hasMediaVolume = $true }
        }
    }
    if (-not $hasMediaVolume) {
        Write-Host 'Creando volumen /app/media...' -ForegroundColor Cyan
        railway volume add --mount-path /app/media 2>&1 | Out-Null
        if ($LASTEXITCODE -eq 0) {
            Write-Host '[OK] Volumen /app/media creado.' -ForegroundColor Green
        } else {
            Write-Host 'Crea el volumen manualmente: Railway > zinapp-api > Volumes > Add > /app/media' -ForegroundColor Yellow
        }
    } else {
        Write-Host '[OK] Volumen /app/media ya existe.' -ForegroundColor Green
    }
} catch {
    Write-Host 'Verifica en Railway que exista un volumen montado en /app/media para las fotos.' -ForegroundColor Yellow
}

Write-Host 'Desplegando API (migrate corre en el entrypoint)...' -ForegroundColor Cyan
railway up --detach

Write-Host ''
Write-Host 'Esperando deploy (~2 min)...' -ForegroundColor Cyan
Start-Sleep -Seconds 120

Write-Host ''
Write-Host 'Dominio publico:' -ForegroundColor Cyan
railway domain

Write-Host ''
Write-Host '=== BASE DE DATOS LISTA (PostgreSQL en Railway) ===' -ForegroundColor Green
Write-Host 'Verificar: .\scripts\finish-setup.ps1'
Write-Host 'Health:    https://zinapp.com.mx/api/health/'
Write-Host ''
Write-Host 'GitHub: copia CRON_SECRET de Railway a secret RAILWAY_CRON_TOKEN' -ForegroundColor Yellow

if ($Seed) {
    Write-Host ''
    Write-Host 'Tras confirmar datos demo:' -ForegroundColor Yellow
    Write-Host "  railway variable set SEED_DATA=false --service $serviceName" -ForegroundColor Yellow
}
