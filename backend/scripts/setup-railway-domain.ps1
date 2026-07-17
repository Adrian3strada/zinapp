# Configura el dominio propio en Railway en lugar del host temporal.
# Uso:
#   .\scripts\setup-railway-domain.ps1 -Domain zinapp.mx
#   .\scripts\setup-railway-domain.ps1 -Domain app.zinapp.mx -ApiDomain api.zinapp.mx

param(
    [Parameter(Mandatory = $true)]
    [string]$Domain,

    [string]$ApiDomain = '',
    [string]$Service = 'zinapp-api'
)

$ErrorActionPreference = 'Stop'
Set-Location $PSScriptRoot\..

if (-not (Get-Command railway -ErrorAction SilentlyContinue)) {
    Write-Host 'Instala Railway CLI: npm install -g @railway/cli' -ForegroundColor Red
    exit 1
}

$webHost = $Domain.Trim().TrimEnd('/').Replace('https://', '').Replace('http://', '')
$apiHost = if ($ApiDomain) {
    $ApiDomain.Trim().Replace('https://', '').Replace('http://', '')
} else {
    $webHost
}

$allowed = "$webHost,.railway.app"
if ($apiHost -ne $webHost) { $allowed = "$webHost,$apiHost,.railway.app" }

$origins = "https://$webHost"
if ($apiHost -ne $webHost) { $origins += ",https://$apiHost" }

Write-Host "=== Dominio ZinApp ===" -ForegroundColor Cyan
Write-Host "Web:  https://$webHost/" -ForegroundColor Green
Write-Host "API:  https://$apiHost/api/" -ForegroundColor Green
Write-Host ''

Write-Host '1) En Railway Dashboard -> tu servicio -> Settings -> Networking -> Custom Domain' -ForegroundColor Yellow
Write-Host "   Añade: $webHost" -ForegroundColor White
if ($apiHost -ne $webHost) {
    Write-Host "   (opcional API separada) Añade: $apiHost" -ForegroundColor White
}
Write-Host '2) En tu proveedor DNS (GoDaddy, Cloudflare, etc.) crea el registro CNAME que Railway indique.' -ForegroundColor Yellow
Write-Host ''

Write-Host '3) Variables en Railway...' -ForegroundColor Cyan
railway variable set "ALLOWED_HOSTS=$allowed" --service $Service
railway variable set "CSRF_TRUSTED_ORIGINS=$origins" --service $Service
railway variable set "CORS_ALLOWED_ORIGINS=$origins" --service $Service

Write-Host ''
Write-Host '4) En mobile, copia y edita el dominio:' -ForegroundColor Cyan
Write-Host '   copy .env.web.example .env.web' -ForegroundColor Gray
Write-Host "   WEB_PUBLIC_URL=https://$webHost" -ForegroundColor Gray
Write-Host "   EXPO_PUBLIC_API_URL=https://$apiHost/api" -ForegroundColor Gray
Write-Host '   EXPO_PUBLIC_WEB_BASE_PATH=/' -ForegroundColor Gray
Write-Host ''
Write-Host '5) Rebuild y deploy:' -ForegroundColor Cyan
Write-Host '   cd ..\mobile' -ForegroundColor Gray
Write-Host '   npm run build:web' -ForegroundColor Gray
Write-Host '   cd ..\backend' -ForegroundColor Gray
Write-Host '   railway up --detach' -ForegroundColor Gray
Write-Host ''
Write-Host "Listo. Comparte: https://$webHost/" -ForegroundColor Green
