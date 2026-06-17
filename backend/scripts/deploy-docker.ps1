# Despliegue local / staging con Docker Compose (SQLite)
# Uso: .\scripts\deploy-docker.ps1
# Producción (PostgreSQL + HTTPS): .\scripts\deploy-production.ps1 -WithHttps

$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot\..

if (-not (Test-Path ".env")) {
    if (Test-Path ".env.docker.example") {
        & "$PSScriptRoot\setup-env.ps1"
    } elseif (Test-Path ".env.example") {
        Copy-Item ".env.example" ".env"
        Write-Host "Se creó .env desde .env.example — edítalo antes de producción real." -ForegroundColor Yellow
    }
}

Write-Host "Construyendo imagen..."
docker compose build

Write-Host "Migraciones..."
docker compose run --rm api python scripts/wait_for_db.py
docker compose run --rm api python manage.py migrate --noinput

Write-Host "Collectstatic..."
docker compose run --rm api python manage.py collectstatic --noinput

Write-Host "Verificando API..."
docker compose run --rm api python manage.py check

Write-Host "Tests rápidos..."
docker compose run --rm api python manage.py test orders restaurants --verbosity=1

if ($env:SEED_DATA -eq "true") {
    Write-Host "Datos de prueba..."
    docker compose run --rm api python manage.py seed_data
} else {
    Write-Host "Omitiendo seed_data (usa `$env:SEED_DATA='true' para cargar datos de prueba)" -ForegroundColor Cyan
}

Write-Host "Levantando API en puerto 8000..."
docker compose up -d

Write-Host "Listo: http://localhost:8000/api/"
