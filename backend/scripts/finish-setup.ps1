# Verifica que produccion quedo lista y muestra pasos pendientes (solo los que requieren accion manual).
# Uso: .\scripts\finish-setup.ps1

$ErrorActionPreference = 'Stop'
Set-Location $PSScriptRoot\..

$apiUrl = 'https://zinapp.com.mx/api'
$ok = $true

Write-Host '=== ZinApp - verificacion final ===' -ForegroundColor Cyan
Write-Host ''

Write-Host '1. Health + PostgreSQL' -ForegroundColor Yellow
try {
    $health = Invoke-RestMethod -Uri "$apiUrl/health/" -TimeoutSec 30
    if ($health.ok -and $health.database -eq 'postgresql') {
        Write-Host "   OK  $($health | ConvertTo-Json -Compress)" -ForegroundColor Green
    } else {
        Write-Host "   FALLO  $($health | ConvertTo-Json -Compress)" -ForegroundColor Red
        $ok = $false
    }
} catch {
    Write-Host "   FALLO  $($_.Exception.Message)" -ForegroundColor Red
    $ok = $false
}

Write-Host ''
Write-Host '2. Login demo (cliente1)' -ForegroundColor Yellow
try {
    $body = @{ username = 'cliente1'; password = 'test1234' } | ConvertTo-Json
    $login = Invoke-RestMethod -Uri "$apiUrl/auth/login/" -Method Post -Body $body -ContentType 'application/json' -TimeoutSec 30
    if ($login.access) {
        Write-Host "   OK  usuario: $($login.user.username)" -ForegroundColor Green
    } else {
        Write-Host '   FALLO  sin token' -ForegroundColor Red
        $ok = $false
    }
} catch {
    Write-Host "   FALLO  $($_.Exception.Message)" -ForegroundColor Red
    $ok = $false
}

Write-Host ''
Write-Host '3. Variables Railway (zinapp-api)' -ForegroundColor Yellow
if (Get-Command railway -ErrorAction SilentlyContinue) {
    $vars = railway variable list --service zinapp-api --json | ConvertFrom-Json
    $checks = @{
        'USE_SQLITE=False' = ($vars.USE_SQLITE -eq 'False')
        'DATABASE_URL' = [bool]$vars.DATABASE_URL
        'CRON_SECRET' = [bool]$vars.CRON_SECRET
        'SEED_DATA=false' = ($vars.SEED_DATA -eq 'false')
    }
    foreach ($name in $checks.Keys) {
        if ($checks[$name]) {
            Write-Host "   OK  $name" -ForegroundColor Green
        } else {
            Write-Host "   FALLO  $name" -ForegroundColor Red
            $ok = $false
        }
    }
} else {
    Write-Host '   Omitido (Railway CLI no instalado)' -ForegroundColor Yellow
}

Write-Host ''
if ($ok) {
    Write-Host '=== BACKEND LISTO EN RAILWAY ===' -ForegroundColor Green
} else {
    Write-Host '=== HAY PENDIENTES EN RAILWAY ===' -ForegroundColor Red
}

Write-Host ''
Write-Host '--- Solo tu puedes completar esto ---' -ForegroundColor Cyan
Write-Host ''
Write-Host 'A) GitHub Actions (recordatorios / notificaciones programadas)'
Write-Host '   1. Sube el repo a GitHub (incluye .github/workflows/)'
Write-Host '   2. En GitHub: Settings > Secrets > Actions > New secret'
Write-Host '      Nombre:  RAILWAY_CRON_TOKEN'
Write-Host '      Valor:   copia CRON_SECRET desde Railway'
Write-Host '            (Railway > zinapp-api > Variables > CRON_SECRET)'
Write-Host ''
Write-Host 'B) Opcional: Google Maps en el APK'
Write-Host '   expo.dev > Secrets > GOOGLE_MAPS_API_KEY'
Write-Host ''
Write-Host 'C) Al lanzar al publico (cuando tengas tus datos reales)'
Write-Host '   - Railway: SUPPORT_WHATSAPP=<tu WhatsApp>'
Write-Host '   - Railway: DEMO_ACCOUNTS_ENABLED=false'
Write-Host '   - mobile/app.json transferInfo + CLABE en perfiles restaurante'
Write-Host ''
