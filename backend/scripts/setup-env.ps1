# Crea .env listo para Docker con claves generadas
# Uso: .\scripts\setup-env.ps1
#      .\scripts\setup-env.ps1 -Production

param(
    [switch]$Production
)

$ErrorActionPreference = "Stop"
$Root = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
Set-Location $Root

$template = if ($Production) { ".env.production.example" } else { ".env.docker.example" }
$target = ".env"
$templatePath = Join-Path $Root $template
$targetPath = Join-Path $Root $target

if (-not (Test-Path $templatePath)) {
    Write-Host "No se encontró $templatePath" -ForegroundColor Red
    exit 1
}

if (Test-Path $targetPath) {
    Write-Host ".env ya existe — no se sobrescribe." -ForegroundColor Yellow
    Write-Host "Borra .env o edítalo manualmente si necesitas regenerar claves." -ForegroundColor Yellow
    exit 0
}

Copy-Item -Path $templatePath -Destination $targetPath -Force
if (-not (Test-Path $targetPath)) {
    Write-Host "No se pudo crear $targetPath" -ForegroundColor Red
    exit 1
}

function New-SecretKey {
    python -c 'from django.core.management.utils import get_random_secret_key; print(get_random_secret_key())'
}

function New-RandomToken {
    -join ((48..57) + (65..90) + (97..122) | Get-Random -Count 48 | ForEach-Object { [char]$_ })
}

try {
    $secret = New-SecretKey
    $cron = New-RandomToken
} catch {
    Write-Host "Python no disponible — edita SECRET_KEY y CRON_SECRET en .env manualmente." -ForegroundColor Yellow
    Write-Host "Se creó .env desde $template" -ForegroundColor Green
    exit 0
}

$content = Get-Content $targetPath -Raw
$content = $content -replace "(?m)^SECRET_KEY=.*", "SECRET_KEY=$secret"
if ($content -match "(?m)^CRON_SECRET=\s*$") {
    $content = $content -replace "(?m)^CRON_SECRET=.*", "CRON_SECRET=$cron"
}

if ($Production) {
    if ($content -match "(?m)^DB_PASSWORD=\s*$") {
        $dbPass = New-RandomToken
        $content = $content -replace "(?m)^DB_PASSWORD=.*", "DB_PASSWORD=$dbPass"
        Write-Host "DB_PASSWORD generado automáticamente." -ForegroundColor Cyan
    }
}

Set-Content -Path $targetPath -Value $content -NoNewline

Write-Host "Listo: $target creado desde $template" -ForegroundColor Green
Write-Host "SECRET_KEY y CRON_SECRET generados." -ForegroundColor Green
if ($Production) {
    Write-Host "Revisa ALLOWED_HOSTS, API_DOMAIN y Mercado Pago antes de desplegar." -ForegroundColor Yellow
} else {
    Write-Host "Levanta la API: docker compose up -d --build" -ForegroundColor Cyan
}
