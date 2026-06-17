# Despliegue producción: PostgreSQL + API (+ Caddy HTTPS)
# Uso:
#   .\scripts\deploy-production.ps1
#   .\scripts\deploy-production.ps1 -WithHttps
#   .\scripts\deploy-production.ps1 -SkipTests

param(
    [switch]$WithHttps,
    [switch]$SkipTests
)

$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot\..

$composeArgs = @("-f", "docker-compose.prod.yml")
if ($WithHttps) {
    $composeArgs += @("--profile", "https")
}

if (-not (Test-Path ".env")) {
    if (Test-Path ".env.production.example") {
        Write-Host "Ejecuta: .\scripts\setup-env.ps1 -Production" -ForegroundColor Yellow
        Copy-Item ".env.production.example" ".env"
        Write-Host "Se creó .env desde .env.production.example — edítalo antes de continuar." -ForegroundColor Yellow
        exit 1
    }
    Write-Host "Falta .env. Copia .env.production.example o usa setup-env.ps1 -Production." -ForegroundColor Red
    exit 1
}

$envContent = Get-Content ".env" -Raw
if ($envContent -match "SECRET_KEY=\s*$" -or $envContent -match "SECRET_KEY=cambia-esto") {
    Write-Host "SECRET_KEY vacío o de ejemplo en .env — genera uno seguro antes de producción." -ForegroundColor Red
    exit 1
}
if ($envContent -match "DB_PASSWORD=\s*$") {
    Write-Host "DB_PASSWORD vacío en .env." -ForegroundColor Red
    exit 1
}

Write-Host "Construyendo imagen..." -ForegroundColor Cyan
docker compose @composeArgs build

Write-Host "Migraciones..." -ForegroundColor Cyan
docker compose @composeArgs run --rm api python scripts/wait_for_db.py
docker compose @composeArgs run --rm api python manage.py migrate --noinput

Write-Host "Collectstatic..." -ForegroundColor Cyan
docker compose @composeArgs run --rm api python manage.py collectstatic --noinput

Write-Host "Verificando API..." -ForegroundColor Cyan
docker compose @composeArgs run --rm api python manage.py check --deploy

if (-not $SkipTests) {
    Write-Host "Tests..." -ForegroundColor Cyan
    docker compose @composeArgs run --rm api python manage.py test accounts orders restaurants --verbosity=1
}

Write-Host "Levantando servicios..." -ForegroundColor Cyan
docker compose @composeArgs up -d

if ($WithHttps) {
    $domain = (Get-Content ".env" | Where-Object { $_ -match "^API_DOMAIN=" }) -replace "^API_DOMAIN=", ""
    if (-not $domain) { $domain = "tu-dominio" }
    Write-Host "Listo con HTTPS: https://$domain/api/" -ForegroundColor Green
} else {
    Write-Host "Listo (sin Caddy). Expone la API con un proxy o:" -ForegroundColor Green
    Write-Host "  docker compose -f docker-compose.prod.yml --profile https up -d" -ForegroundColor Cyan
}
