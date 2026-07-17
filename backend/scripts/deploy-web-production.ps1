# Despliega app web + API en Railway (todo en uno)
# Uso: .\scripts\deploy-web-production.ps1

$ErrorActionPreference = 'Stop'

Write-Host '=== ZinApp - deploy web + API ===' -ForegroundColor Cyan
Write-Host ''

& (Join-Path $PSScriptRoot '..\..\mobile\scripts\build-web.ps1')
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

$backendRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
Push-Location $backendRoot

Write-Host ''
Write-Host 'Desplegando en Railway...' -ForegroundColor Cyan
railway up --detach
if ($LASTEXITCODE -ne 0) {
    Pop-Location
    exit $LASTEXITCODE
}

Pop-Location

Write-Host ''
Write-Host 'Esperando deploy (~90s)...' -ForegroundColor Yellow
Start-Sleep -Seconds 90

$urls = @(
    @{ Name = 'App web'; Url = 'https://zinapp.com.mx/app/' },
    @{ Name = 'Privacidad'; Url = 'https://zinapp.com.mx/privacidad/' },
    @{ Name = 'API health'; Url = 'https://zinapp.com.mx/api/health/' }
)

foreach ($item in $urls) {
    try {
        $r = Invoke-WebRequest -Uri $item.Url -UseBasicParsing -TimeoutSec 30
        Write-Host "[OK] $($item.Name): $($r.StatusCode)" -ForegroundColor Green
    } catch {
        Write-Host "[??] $($item.Name): $($_.Exception.Message)" -ForegroundColor Yellow
    }
}

Write-Host ''
Write-Host 'Comparte con usuarios:' -ForegroundColor Green
Write-Host '  https://zinapp.com.mx/app/' -ForegroundColor White
Write-Host ''
Write-Host 'Demo: cliente1 / test1234' -ForegroundColor Gray
