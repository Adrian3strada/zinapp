# Inicia Expo en modo Expo Go (compatible con iPhone + app Expo Go de App Store).
# Uso: .\scripts\start-expo-go.ps1
#      .\scripts\start-expo-go.ps1 -Tunnel

param(
    [switch]$Tunnel,
    [switch]$Clear
)

$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot\..

$env:REACT_NATIVE_PACKAGER_HOSTNAME = "192.168.1.27"

$args = @("expo", "start", "--go")
if ($Clear) { $args += "--clear" }
if ($Tunnel) { $args += "--tunnel" }

Write-Host ""
Write-Host "Modo: Expo Go (no development build)" -ForegroundColor Cyan
Write-Host "IP bundler: $($env:REACT_NATIVE_PACKAGER_HOSTNAME)" -ForegroundColor Cyan
Write-Host "En iPhone: abre Expo Go -> Scan QR code" -ForegroundColor Yellow
Write-Host ""

& npx @args
