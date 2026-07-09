# Abre ZinApp web al tamano iPhone 6.7" para capturas de App Store (1290x2796)
# Uso: .\scripts\capture-appstore-screenshots.ps1

$ErrorActionPreference = 'Stop'
$url = 'https://zinapp-api-production.up.railway.app/app/'

Write-Host ''
Write-Host '=== Capturas App Store — ZinApp ===' -ForegroundColor Cyan
Write-Host ''
Write-Host 'Tamano requerido: 1290 x 2796 px (iPhone 6.7")' -ForegroundColor Yellow
Write-Host ''
Write-Host 'Pasos en Chrome o Edge:' -ForegroundColor Green
Write-Host '  1. Se abrira la app web'
Write-Host '  2. F12 -> icono movil (Ctrl+Shift+M)'
Write-Host '  3. Dispositivo: iPhone 14 Pro Max'
Write-Host '  4. Zoom: 100%'
Write-Host '  5. Captura cada pantalla:'
Write-Host '       - Inicio / login'
Write-Host '       - Lista de restaurantes'
Write-Host '       - Menu o carrito'
Write-Host '       - Mis pedidos (si puedes)'
Write-Host '  6. Guarda PNG y subelas en App Store Connect'
Write-Host ''
Write-Host 'Alternativa: instala TestFlight en iPhone y captura pantalla (boton lateral + volumen).'
Write-Host ''

$edge = "${env:ProgramFiles(x86)}\Microsoft\Edge\Application\msedge.exe"
$chrome = "${env:ProgramFiles}\Google\Chrome\Application\chrome.exe"
if (Test-Path $chrome) { Start-Process $chrome $url }
elseif (Test-Path $edge) { Start-Process $edge $url }
else { Start-Process $url }

Write-Host "Abierto: $url" -ForegroundColor Gray
