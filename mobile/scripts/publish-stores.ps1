# Publicar ZinApp en App Store y Google Play
# Uso:
#   .\scripts\publish-stores.ps1 -Step build -Platform android
#   .\scripts\publish-stores.ps1 -Step build -Platform ios
#   .\scripts\publish-stores.ps1 -Step build -Platform all
#   .\scripts\publish-stores.ps1 -Step submit -Platform android
#   .\scripts\publish-stores.ps1 -Step submit -Platform ios
#   .\scripts\publish-stores.ps1 -Step all -Platform all
#
# Antes del primer submit Android:
#   1. Play Console → API access → cuenta de servicio
#   2. Copia google-play-key.json.example → google-play-key.json
#
# Antes del primer submit iOS:
#   1. Apple Developer Program activo ($99/año)
#   2. App creada en App Store Connect (com.zinapp.delivery)

param(
    [ValidateSet('build', 'submit', 'all')]
    [string]$Step = 'all',

    [ValidateSet('android', 'ios', 'all')]
    [string]$Platform = 'all',

    [ValidateSet('internal', 'alpha', 'beta', 'production')]
    [string]$PlayTrack = 'internal'
)

$ErrorActionPreference = 'Stop'
Set-Location $PSScriptRoot\..

$PrivacyUrl = 'https://zinapp.com.mx/privacidad/'
$SupportEmail = 'adrianestradachavez123@gmail.com'
$PackageId = 'com.zinapp.delivery'

function Write-Header([string]$Text) {
    Write-Host ''
    Write-Host $Text -ForegroundColor Cyan
    Write-Host ('=' * $Text.Length) -ForegroundColor DarkCyan
}

function Ensure-Eas {
    if (-not (Get-Command eas -ErrorAction SilentlyContinue)) {
        Write-Host 'Instalando eas-cli...' -ForegroundColor Yellow
        npm install -g eas-cli
    }

    $whoami = eas whoami 2>&1
    if ($LASTEXITCODE -ne 0) {
        Write-Host 'Inicia sesion: eas login' -ForegroundColor Red
        exit 1
    }
    Write-Host "Expo: $whoami" -ForegroundColor Green
}

function Test-ProductionConfig {
    $extraJson = node -e "process.env.EXPO_PUBLIC_ENV='production'; const c=require('./app.config.js'); console.log(JSON.stringify(c().extra));" 2>&1
    if ($LASTEXITCODE -ne 0) {
        Write-Host $extraJson -ForegroundColor Red
        exit 1
    }
    $extra = $extraJson | ConvertFrom-Json
    Write-Host "API produccion: $($extra.apiUrl)" -ForegroundColor Green
    Write-Host "Privacidad:     $($extra.privacyPolicyUrl)" -ForegroundColor Green
}

function Invoke-Build {
    param([string]$TargetPlatform)
    Write-Header "Build production — $TargetPlatform"
    eas build --profile production --platform $TargetPlatform --non-interactive
    if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
}

function Test-AndroidSubmitReady {
    if (-not (Test-Path 'google-play-key.json')) {
        Write-Host ''
        Write-Host 'Falta mobile/google-play-key.json para submit Android.' -ForegroundColor Red
        Write-Host 'Pasos:' -ForegroundColor Yellow
        Write-Host '  1. Google Play Console → Setup → API access'
        Write-Host '  2. Crea cuenta de servicio y descarga el JSON'
        Write-Host '  3. Guardalo como mobile/google-play-key.json'
        Write-Host '  (Plantilla: google-play-key.json.example)'
        exit 1
    }
}

function Invoke-Submit {
    param([string]$TargetPlatform)

    if ($TargetPlatform -eq 'android') {
        Test-AndroidSubmitReady
    }

    if ($TargetPlatform -eq 'ios') {
        Write-Host ''
        Write-Host 'iOS submit requiere Apple Developer activo y app en App Store Connect.' -ForegroundColor Yellow
    }

    Write-Header "Submit production — $TargetPlatform"
    if ($TargetPlatform -eq 'android') {
        eas submit --profile production --platform android --track $PlayTrack --non-interactive
    } else {
        eas submit --profile production --platform $TargetPlatform --non-interactive
    }
    if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
}

function Show-StoreChecklist {
    Write-Header 'Checklist manual en las tiendas'
    Write-Host @"
URL privacidad (copiar en Play Console y App Store Connect):
  $PrivacyUrl

Email soporte:
  $SupportEmail

Package / Bundle ID:
  $PackageId

Google Play Console — pendiente manual:
  [ ] Crear app ZinApp ($PackageId)
  [ ] Store listing: titulo, descripcion, capturas, icono 512x512
  [ ] Data safety: ubicacion, fotos, cuenta, pedidos
  [ ] Content rating (IARC)
  [ ] Internal testing → luego Production

App Store Connect — pendiente manual:
  [ ] Crear app iOS ($PackageId)
  [ ] Privacy Policy URL: $PrivacyUrl
  [ ] App Privacy: ubicacion, fotos, contacto, identificadores
  [ ] Capturas iPhone 6.7\" y 6.5\"
  [ ] TestFlight interno → luego Add for Review

Textos sugeridos: mobile/docs/publicacion-tiendas.md
"@ -ForegroundColor Gray
}

Write-Header 'ZinApp — publicacion en tiendas'
Ensure-Eas
Test-ProductionConfig

$platforms = @()
if ($Platform -eq 'all') { $platforms = @('android', 'ios') } else { $platforms = @($Platform) }

foreach ($p in $platforms) {
    if ($Step -eq 'build' -or $Step -eq 'all') {
        Invoke-Build -TargetPlatform $p
    }
    if ($Step -eq 'submit' -or $Step -eq 'all') {
        Invoke-Submit -TargetPlatform $p
    }
}

Show-StoreChecklist
Write-Host ''
Write-Host 'Listo. Revisa builds en https://expo.dev/accounts/g2adriaans-team/projects/zinapp/builds' -ForegroundColor Green
