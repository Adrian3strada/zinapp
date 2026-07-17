# Google Play — guía paso a paso para ZinApp
# Ejecuta cada fase en orden. Algunos pasos son en la web de Google.

param(
    [ValidateSet('check', 'build', 'submit', 'all')]
    [string]$Phase = 'check'
)

$ErrorActionPreference = 'Stop'
Set-Location $PSScriptRoot\..

$Package = 'com.zinapp.delivery'
$PrivacyUrl = 'https://zinapp.com.mx/privacidad/'
$SupportEmail = 'adrianestradachavez123@gmail.com'

function Write-Step([string]$Num, [string]$Text) {
    Write-Host ''
    Write-Host "[$Num] $Text" -ForegroundColor Cyan
}

function Test-Prerequisites {
    Write-Host '=== ZinApp — Google Play ===' -ForegroundColor Green
    Write-Host "Package: $Package"
    Write-Host "Privacidad: $PrivacyUrl"
    Write-Host ''

    $issues = @()

    try {
        $r = Invoke-WebRequest -Uri $PrivacyUrl -UseBasicParsing -TimeoutSec 20
        if ($r.StatusCode -eq 200) {
            Write-Host '[OK] Pagina de privacidad en Railway' -ForegroundColor Green
        }
    } catch {
        Write-Host '[PENDIENTE] Pagina de privacidad no disponible (404)' -ForegroundColor Yellow
        Write-Host '  Despliega backend: cd backend && railway up --detach' -ForegroundColor Gray
        $issues += 'Deploy backend (privacidad)'
    }

    try {
        $h = Invoke-WebRequest -Uri 'https://zinapp.com.mx/api/health/' -UseBasicParsing -TimeoutSec 20
        Write-Host "[OK] API Railway ($($h.StatusCode))" -ForegroundColor Green
    } catch {
        Write-Host '[ERROR] API Railway no responde' -ForegroundColor Red
        $issues += 'API Railway'
    }

    if (Get-Command eas -ErrorAction SilentlyContinue) {
        $who = cmd /c "eas whoami 2>nul"
        if ($LASTEXITCODE -eq 0) { Write-Host "[OK] EAS: $who" -ForegroundColor Green }
        else { $issues += 'eas login' }
    } else {
        $issues += 'npm install -g eas-cli'
    }

    if (Test-Path 'google-play-key.json') {
        Write-Host '[OK] google-play-key.json encontrado' -ForegroundColor Green
    } else {
        Write-Host '[PENDIENTE] google-play-key.json (cuenta de servicio Google Play)' -ForegroundColor Yellow
        $issues += 'google-play-key.json'
    }

    Write-Step 'A' 'Play Console — crear la app (una vez)'
    Write-Host @"
  1. https://play.google.com/console — paga registro `$25 si es primera vez
  2. Crear app → ZinApp
  3. Package name: $Package (debe coincidir exacto)
  4. Tipo: App / Gratis
"@ -ForegroundColor Gray

    Write-Step 'B' 'Cuenta de servicio (para eas submit)'
    Write-Host @"
  1. Play Console → Setup → API access → Link Google Cloud project
  2. Create service account → Grant access en Play Console
  3. Rol: Release manager (o Admin para prueba)
  4. Descarga JSON → guarda como mobile/google-play-key.json
  5. Plantilla: google-play-key.json.example
"@ -ForegroundColor Gray

    Write-Step 'C' 'Store listing (copiar textos de docs/publicacion-tiendas.md)'
    Write-Host @"
  - Titulo: ZinApp
  - Descripcion corta y larga
  - Icono 512x512 (exporta desde assets/icon.png)
  - Capturas: min. 2 (1080x1920)
  - Privacy policy: $PrivacyUrl
  - Email: $SupportEmail
  - Data safety + Content rating (IARC)
"@ -ForegroundColor Gray

    if ($issues.Count -gt 0) {
        Write-Host ''
        Write-Host 'Pendientes antes de submit automatico:' -ForegroundColor Yellow
        $issues | ForEach-Object { Write-Host "  - $_" }
    }

    return $issues
}

function Invoke-ProductionBuild {
    Write-Step 'D' 'Build production AAB (Google Play)'
    $env:EXPO_PUBLIC_ENV = 'production'
    $extra = node -e "const c=require('./app.config.js'); console.log(c().extra.apiUrl)" 2>&1
    Write-Host "API: $extra" -ForegroundColor Green

    Write-Host ''
    Write-Host 'Iniciando eas build production android...' -ForegroundColor Cyan
    Write-Host 'Si falla por cuota gratis de Expo, opciones:' -ForegroundColor Yellow
    Write-Host '  - Upgrade: https://expo.dev/accounts/g2adriaans-team/settings/billing'
    Write-Host '  - O esperar reset (1 jul 2026)'
    Write-Host '  - O build local: eas build --local --platform android --profile production'
    Write-Host ''

    $env:EAS_BUILD_NO_EXPO_GO_WARNING = 'true'
    eas build --profile production --platform android --non-interactive
}

function Invoke-PlaySubmit {
    if (-not (Test-Path 'google-play-key.json')) {
        Write-Host 'Falta google-play-key.json — no se puede hacer submit automatico.' -ForegroundColor Red
        Write-Host ''
        Write-Host 'Alternativa manual:' -ForegroundColor Yellow
        Write-Host '  1. Descarga el AAB desde expo.dev tras el build'
        Write-Host '  2. Play Console → Release → Internal testing → Create release → Upload AAB'
        exit 1
    }

    Write-Step 'E' 'Submit a Play Store (track internal)'
    eas submit --profile production --platform android --track internal --non-interactive
}

switch ($Phase) {
    'check'  { Test-Prerequisites | Out-Null }
    'build'  { Invoke-ProductionBuild }
    'submit' { Invoke-PlaySubmit }
    'all'    {
        Test-Prerequisites | Out-Null
        Invoke-ProductionBuild
        Invoke-PlaySubmit
    }
}

Write-Host ''
Write-Host 'Docs: mobile/docs/publicacion-tiendas.md' -ForegroundColor Gray
