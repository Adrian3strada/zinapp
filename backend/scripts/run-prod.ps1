# Arranque local en modo producción (sin Docker)
# Uso: .\scripts\run-prod.ps1

$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot\..

if (-not (Test-Path ".env")) {
    Write-Host "Crea .env desde .env.example primero." -ForegroundColor Yellow
    exit 1
}

$env:DEBUG = "False"
$env:SERVE_MEDIA = "True"

Write-Host "Migraciones..."
python manage.py migrate --noinput

Write-Host "Archivos estáticos..."
python manage.py collectstatic --noinput

Write-Host "Gunicorn en http://0.0.0.0:8000"
gunicorn config.wsgi:application --bind 0.0.0.0:8000 --workers 2 --timeout 120
