# Verifica el estado de la config FCM / push Android para ZinApp.
$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

Write-Host "=== ZinApp Android Push / FCM setup ===" -ForegroundColor Cyan
Write-Host "Package: com.zinapp.delivery"
Write-Host ""

$gs = Join-Path $root "google-services.json"
$fcm = Join-Path $root "fcm-service-account.json"

if (Test-Path $gs) {
  Write-Host "[OK] google-services.json encontrado" -ForegroundColor Green
  try {
    $json = Get-Content $gs -Raw | ConvertFrom-Json
    $pkg = $json.client.client_info.android_client_info.package_name
    if ($pkg -and ($pkg -notcontains "com.zinapp.delivery") -and ($pkg -ne "com.zinapp.delivery")) {
      $joined = @($pkg) -join ", "
      if ($joined -notmatch "com\.zinapp\.delivery") {
        Write-Host "[WARN] package en google-services.json: $joined (esperado com.zinapp.delivery)" -ForegroundColor Yellow
      } else {
        Write-Host "[OK] package com.zinapp.delivery presente" -ForegroundColor Green
      }
    } else {
      Write-Host "[OK] package com.zinapp.delivery (o lista compatible)" -ForegroundColor Green
    }
  } catch {
    Write-Host "[WARN] No se pudo parsear google-services.json" -ForegroundColor Yellow
  }
} else {
  Write-Host "[FALTA] mobile/google-services.json" -ForegroundColor Red
  Write-Host "  1) Firebase Console → Add Android app → package com.zinapp.delivery"
  Write-Host "  2) Descarga google-services.json → pegalo en mobile/"
  Write-Host "  Docs: mobile/docs/android-push-fcm.md"
}

if (Test-Path $fcm) {
  Write-Host "[OK] fcm-service-account.json local (listo para subir a EAS)" -ForegroundColor Green
} else {
  Write-Host "[INFO] fcm-service-account.json no esta en disco (opcional local)" -ForegroundColor Yellow
  Write-Host "  Genera la private key en Firebase Service accounts y subela a EAS FCM V1."
}

Write-Host ""
Write-Host "Siguiente:" -ForegroundColor Cyan
Write-Host "  npx eas-cli credentials -p android   # subir FCM V1 si falta"
Write-Host "  npx eas-cli build -p android --profile preview"
Write-Host "  Dashboard: https://expo.dev/accounts/g2adriaans-team/projects/zinapp/credentials"
Write-Host ""
Write-Host "Abriendo Firebase Console y EAS credentials..." -ForegroundColor Cyan
Start-Process "https://console.firebase.google.com/"
Start-Process "https://expo.dev/accounts/g2adriaans-team/projects/zinapp/credentials"
