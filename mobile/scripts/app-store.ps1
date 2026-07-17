# App Store — guía paso a paso para ZinApp (iOS)
# Ejecuta cada fase en orden. Varios pasos son en la web de Apple.
#
# Uso:
#   .\scripts\app-store.ps1 -Phase check
#   .\scripts\app-store.ps1 -Phase build
#   .\scripts\app-store.ps1 -Phase submit
#   .\scripts\app-store.ps1 -Phase all

param(
    [ValidateSet('check', 'build', 'submit', 'all')]
    [string]$Phase = 'check'
)

$ErrorActionPreference = 'Stop'
Set-Location $PSScriptRoot\..

$BundleId = 'com.zinapp.delivery'
$AppleId = 'adrianestradachavez123@gmail.com'
$PrivacyUrl = 'https://zinapp.com.mx/privacidad/'
$SupportEmail = 'adrianestradachavez123@gmail.com'
$ExpoBuildsUrl = 'https://expo.dev/accounts/g2adriaans-team/projects/zinapp/builds'

function Write-Step([string]$Num, [string]$Text) {
    Write-Host ''
    Write-Host "[$Num] $Text" -ForegroundColor Cyan
}

function Ensure-Eas {
    if (-not (Get-Command eas -ErrorAction SilentlyContinue)) {
        Write-Host 'Instalando eas-cli...' -ForegroundColor Yellow
        npm install -g eas-cli
    }

    $who = cmd /c "eas whoami 2>nul"
    if ($LASTEXITCODE -ne 0) {
        Write-Host 'Inicia sesion en Expo: eas login' -ForegroundColor Red
        exit 1
    }
    Write-Host "[OK] EAS: $who" -ForegroundColor Green
}

function Test-Prerequisites {
    Write-Host '=== ZinApp — App Store (iOS) ===' -ForegroundColor Green
    Write-Host "Bundle ID: $BundleId"
    Write-Host "Apple ID:  $AppleId"
    Write-Host "Privacidad: $PrivacyUrl"
    Write-Host ''

    $issues = @()

    try {
        $r = Invoke-WebRequest -Uri $PrivacyUrl -UseBasicParsing -TimeoutSec 20
        if ($r.StatusCode -eq 200) {
            Write-Host '[OK] Pagina de privacidad en Railway' -ForegroundColor Green
        }
    } catch {
        Write-Host '[PENDIENTE] Pagina de privacidad no disponible' -ForegroundColor Yellow
        $issues += 'Deploy backend (privacidad)'
    }

    try {
        $h = Invoke-WebRequest -Uri 'https://zinapp.com.mx/api/health/' -UseBasicParsing -TimeoutSec 20
        Write-Host "[OK] API Railway ($($h.StatusCode))" -ForegroundColor Green
    } catch {
        Write-Host '[ERROR] API Railway no responde' -ForegroundColor Red
        $issues += 'API Railway'
    }

    Ensure-Eas

    $appJson = Get-Content 'app.json' -Raw | ConvertFrom-Json
    Write-Host "[OK] Version app: $($appJson.expo.version)" -ForegroundColor Green
    if ($appJson.expo.ios.buildNumber) {
        Write-Host "[OK] iOS buildNumber: $($appJson.expo.ios.buildNumber)" -ForegroundColor Green
    } else {
        Write-Host '[AVISO] ios.buildNumber no definido — EAS lo incrementara en production' -ForegroundColor Yellow
    }

    Write-Step 'A' 'Apple Developer Program (una vez, ~$99 USD/año)'
    Write-Host @"
  1. https://developer.apple.com/programs/enroll/
  2. Usa el Apple ID: $AppleId
  3. Espera la activacion (puede tardar horas o 1-2 dias)
"@ -ForegroundColor Gray

    Write-Step 'B' 'Identificador de app (Bundle ID)'
    Write-Host @"
  1. https://developer.apple.com/account/resources/identifiers/list
  2. Registrar App ID → Explicit → $BundleId
  3. Capabilities: Push Notifications (recomendado)
  4. Si usas ubicacion en segundo plano (repartidores), Apple puede pedir justificacion en revision
"@ -ForegroundColor Gray

    Write-Step 'C' 'App Store Connect — crear la app'
    Write-Host @"
  1. https://appstoreconnect.apple.com/apps
  2. + → New App
  3. Plataforma: iOS
  4. Name: ZinApp
  5. Primary language: Spanish (Mexico)
  6. Bundle ID: $BundleId
  7. SKU: zinapp-delivery (cualquier identificador interno unico)
  8. User Access: Full Access
  9. Copia el Apple ID numerico de la app (App Information → Apple ID, ej. 1234567890)
     y agregalo en eas.json → submit.production.ios.ascAppId
"@ -ForegroundColor Gray

    Write-Step 'D' 'App Store Connect API Key (recomendado para submit automatico)'
    Write-Host @"
  1. App Store Connect → Users and Access → Integrations → App Store Connect API
  2. + → Name: EAS ZinApp → Access: App Manager
  3. Descarga AuthKey_XXXXXX.p8 (solo una vez)
  4. Guarda como mobile/AuthKey_EAS.p8 (ya esta en .gitignore)
  5. Anota Key ID e Issuer ID
  6. En eas.json → submit.production.ios agrega:
       ""ascApiKeyPath"": ""./AuthKey_EAS.p8"",
       ""ascApiKeyId"": ""TU_KEY_ID"",
       ""ascApiKeyIssuerId"": ""TU_ISSUER_ID""
  Alternativa: eas submit pedira Apple ID + app-specific password la primera vez.
"@ -ForegroundColor Gray

    Write-Step 'E' 'Ficha de la tienda (textos en docs/publicacion-tiendas.md)'
    Write-Host @"
  - Privacy Policy URL: $PrivacyUrl
  - Support URL o email: $SupportEmail
  - Categoria: Food & Drink
  - Capturas iPhone 6.7"" (1290x2796) y 6.5"" (1284x2778), min. 3
  - App Privacy: ubicacion, fotos, contacto, identificadores
  - Notas para el revisor: cuenta demo o registro libre desde la app
"@ -ForegroundColor Gray

    $easJson = Get-Content 'eas.json' -Raw | ConvertFrom-Json
    $iosSubmit = $easJson.submit.production.ios
    if ($iosSubmit.ascAppId) {
        Write-Host "[OK] ascAppId configurado en eas.json" -ForegroundColor Green
    } else {
        Write-Host '[PENDIENTE] ascAppId en eas.json (Apple ID numerico de App Store Connect)' -ForegroundColor Yellow
        $issues += 'ascAppId en eas.json'
    }

    if ($issues.Count -gt 0) {
        Write-Host ''
        Write-Host 'Pendientes antes de submit automatico:' -ForegroundColor Yellow
        $issues | ForEach-Object { Write-Host "  - $_" }
    } else {
        Write-Host ''
        Write-Host 'Prerequisitos listos para build y submit.' -ForegroundColor Green
    }

    return $issues
}

function Invoke-ProductionBuild {
    Write-Step 'F' 'Build production iOS (EAS)'
    $env:EXPO_PUBLIC_ENV = 'production'
    $extra = node -e "const c=require('./app.config.js'); console.log(c().extra.apiUrl)" 2>&1
    if ($LASTEXITCODE -ne 0) {
        Write-Host $extra -ForegroundColor Red
        exit 1
    }
    Write-Host "API: $extra" -ForegroundColor Green

    Write-Host ''
    Write-Host 'Iniciando eas build production ios...' -ForegroundColor Cyan
    Write-Host 'La primera vez EAS creara certificados y provisioning profile en Apple.' -ForegroundColor Yellow
    Write-Host 'Necesitas Apple Developer activo y acceso al Apple ID del equipo.' -ForegroundColor Yellow
    Write-Host ''
    Write-Host "Sigue el progreso en: $ExpoBuildsUrl" -ForegroundColor Gray
    Write-Host ''

    $env:EAS_BUILD_NO_EXPO_GO_WARNING = 'true'
    if ($env:EAS_NO_VCS -ne '1' -and -not (Get-Command git -ErrorAction SilentlyContinue)) {
        $env:EAS_NO_VCS = '1'
        Write-Host 'Git no encontrado — usando EAS_NO_VCS=1' -ForegroundColor Yellow
    }

    # Primera vez iOS: EAS debe pedir credenciales Apple (2FA). No usar --non-interactive.
    $credCheck = eas credentials --platform ios 2>&1 | Out-String
    $hasIosCreds = $credCheck -match 'Distribution Certificate' -and $credCheck -notmatch 'None assigned'
    if ($hasIosCreds) {
        Write-Host 'Credenciales iOS encontradas — build no interactivo.' -ForegroundColor Green
        eas build --profile production --platform ios --non-interactive
    } else {
        Write-Host ''
        Write-Host 'PRIMERA VEZ iOS: EAS pedira tu Apple ID y codigo 2FA.' -ForegroundColor Yellow
        Write-Host 'Responde las preguntas en esta terminal (generar certificados: Si).' -ForegroundColor Yellow
        Write-Host ''
        eas build --profile production --platform ios
    }
}

function Invoke-AppStoreSubmit {
    Write-Step 'G' 'Submit a App Store Connect (TestFlight)'

    $easJson = Get-Content 'eas.json' -Raw | ConvertFrom-Json
    if (-not $easJson.submit.production.ios.ascAppId) {
        Write-Host ''
        Write-Host 'ascAppId no configurado en eas.json.' -ForegroundColor Yellow
        Write-Host 'Opciones:' -ForegroundColor Yellow
        Write-Host '  1. Agrega ascAppId y vuelve a ejecutar: .\scripts\app-store.ps1 -Phase submit'
        Write-Host '  2. Submit interactivo (EAS pedira datos): eas submit --platform ios --latest'
        Write-Host '  3. Manual: descarga el .ipa desde expo.dev → Transporter (Mac) o App Store Connect'
        Write-Host ''
        $answer = Read-Host 'Continuar con eas submit --latest? (s/N)'
        if ($answer -notmatch '^[sSyY]') { exit 0 }
    }

    eas submit --profile production --platform ios --latest --non-interactive
    if ($LASTEXITCODE -ne 0) {
        Write-Host ''
        Write-Host 'Submit fallo. Prueba modo interactivo:' -ForegroundColor Yellow
        Write-Host '  eas submit --platform ios --latest'
        exit $LASTEXITCODE
    }

    Write-Step 'H' 'Despues del submit — TestFlight y revision'
    Write-Host @"
  1. App Store Connect → TestFlight → espera procesamiento (~5-30 min)
  2. Agrega testers internos (tu Apple ID) y prueba la build
  3. Completa la ficha: capturas, descripcion, App Privacy, clasificacion
  4. App Store → + Version → selecciona la build → Submit for Review
  5. Revision Apple: suele tardar 24-48 h (a veces mas)
"@ -ForegroundColor Gray
}

switch ($Phase) {
    'check'  { Test-Prerequisites | Out-Null }
    'build'  {
        Ensure-Eas
        Invoke-ProductionBuild
    }
    'submit' {
        Ensure-Eas
        Invoke-AppStoreSubmit
    }
    'all'    {
        Test-Prerequisites | Out-Null
        Invoke-ProductionBuild
        Invoke-AppStoreSubmit
    }
}

Write-Host ''
Write-Host 'Docs: mobile/docs/publicacion-tiendas.md' -ForegroundColor Gray
Write-Host "Builds: $ExpoBuildsUrl" -ForegroundColor Gray
