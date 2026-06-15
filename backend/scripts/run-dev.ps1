# Backend para desarrollo — accesible desde el celular en la red local
# Uso: .\scripts\run-dev.ps1

$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot\..

Write-Host "ZinApp API en http://0.0.0.0:8000 (accesible desde tu celular)" -ForegroundColor Cyan
Write-Host "Panel: http://localhost:8000/panel/" -ForegroundColor Cyan
Write-Host ""

python manage.py runserver 0.0.0.0:8000
