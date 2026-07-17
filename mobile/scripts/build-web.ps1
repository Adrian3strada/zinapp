# Build web + copiar a backend/static/webapp
# Uso:
#   .\scripts\build-web.ps1
#   .\scripts\build-web.ps1 -Deploy
#   .\scripts\build-web.ps1 -Domain zinapp.mx
#
# Dominio propio: copia .env.web.example -> .env.web y edita URLs

param(
    [switch]$Deploy,
    [string]$Domain = '',
    [string]$ApiUrl = '',
    [string]$WebBasePath = ''
)

$ErrorActionPreference = 'Stop'
Set-Location $PSScriptRoot\..

function Normalize-BasePath([string]$p) {
    if (-not $p) { return '/app' }
    $p = $p.Trim()
    if ($p -eq '/') { return '/' }
    if (-not $p.StartsWith('/')) { $p = "/$p" }
    return $p.TrimEnd('/')
}

function Load-DotEnvFile([string]$path) {
    if (-not (Test-Path $path)) { return @{} }
    $vars = @{}
    Get-Content $path | ForEach-Object {
        $line = $_.Trim()
        if (-not $line -or $line.StartsWith('#')) { return }
        $idx = $line.IndexOf('=')
        if ($idx -lt 1) { return }
        $key = $line.Substring(0, $idx).Trim()
        $val = $line.Substring($idx + 1).Trim().Trim('"').Trim("'")
        $vars[$key] = $val
    }
    return $vars
}

$envFile = Load-DotEnvFile (Join-Path $PWD '.env.web')
$publicUrl = if ($Domain) { "https://$($Domain.Trim().Replace('https://','').Replace('http://','').TrimEnd('/'))" } else { $envFile['WEB_PUBLIC_URL'] }
$resolvedApi = if ($ApiUrl) { $ApiUrl } else { $envFile['EXPO_PUBLIC_API_URL'] }
$resolvedBase = Normalize-BasePath ($(if ($WebBasePath) { $WebBasePath } else { $envFile['EXPO_PUBLIC_WEB_BASE_PATH'] }))

if (-not $resolvedApi) {
    $resolvedApi = 'https://zinapp.com.mx/api'
}
if (-not $publicUrl) {
    if ($resolvedBase -eq '/') {
        $hostPart = ([uri]$resolvedApi).GetLeftPart([System.UriPartial]::Authority)
        $publicUrl = $hostPart
    } else {
        $publicUrl = 'https://zinapp.com.mx'
    }
}

$assetPrefix = if ($resolvedBase -eq '/') { '' } else { $resolvedBase }

Write-Host 'ZinApp - build web (Expo export)' -ForegroundColor Cyan

$env:EXPO_PUBLIC_ENV = 'production'
$env:EXPO_PUBLIC_API_URL = $resolvedApi
$env:EXPO_PUBLIC_WEB_BASE_PATH = $resolvedBase

Write-Host "API:       $resolvedApi" -ForegroundColor Green
Write-Host "Base path: $resolvedBase" -ForegroundColor Green
Write-Host "Public URL: $publicUrl$resolvedBase/" -ForegroundColor Green
Write-Host ''

if (-not (Get-Command npx -ErrorAction SilentlyContinue)) {
    Write-Host 'Node.js/npx requerido.' -ForegroundColor Red
    exit 1
}

Write-Host 'Exportando sitio estatico...'
npx expo export --platform web --clear
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

$dist = Join-Path $PWD 'dist'
if (-not (Test-Path (Join-Path $dist 'index.html'))) {
    Write-Host 'No se genero dist/index.html' -ForegroundColor Red
    exit 1
}

$backendRoot = (Resolve-Path (Join-Path $PSScriptRoot '..\..\backend')).Path
$target = Join-Path $backendRoot 'static\webapp'
if (Test-Path $target) {
    Remove-Item $target -Recurse -Force
}
New-Item -ItemType Directory -Path $target -Force | Out-Null
Copy-Item -Path (Join-Path $dist '*') -Destination $target -Recurse -Force

$fontsDir = Join-Path $target 'fonts'
New-Item -ItemType Directory -Path $fontsDir -Force | Out-Null
$ioniconsCandidates = @(
    (Join-Path $target 'assets\node_modules\@expo\vector-icons\build\vendor\react-native-vector-icons\Fonts\Ionicons*.ttf'),
    (Join-Path $dist 'assets\node_modules\@expo\vector-icons\build\vendor\react-native-vector-icons\Fonts\Ionicons*.ttf')
)
foreach ($pattern in $ioniconsCandidates) {
    $found = Get-Item $pattern -ErrorAction SilentlyContinue | Select-Object -First 1
    if ($found) {
        Copy-Item $found.FullName (Join-Path $fontsDir 'ionicons.ttf') -Force
        Write-Host "Ionicons -> fonts/ionicons.ttf" -ForegroundColor Green
        break
    }
}

$navSrc = Join-Path $target 'assets\node_modules\@react-navigation\elements\lib\module\assets'
$navDst = Join-Path $target 'icons\nav'
if (Test-Path $navSrc) {
    New-Item -ItemType Directory -Path $navDst -Force | Out-Null
    Copy-Item (Join-Path $navSrc '*') $navDst -Force
    Write-Host "Nav icons -> icons/nav/" -ForegroundColor Green
}

$scope = if ($resolvedBase -eq '/') { '/' } else { "$resolvedBase/" }
$manifestPath = Join-Path $target 'manifest.webmanifest'
$manifest = @{
    name = 'ZinApp — Zinapécuaro'
    short_name = 'ZinApp'
    description = 'Comida a domicilio y servicios locales en Zinapécuaro, Michoacán.'
    start_url = $scope
    scope = $scope
    display = 'standalone'
    orientation = 'portrait'
    theme_color = '#1E5DB8'
    background_color = '#FFFFFF'
    lang = 'es-MX'
    icons = @(
        @{
            src = "${assetPrefix}/favicon.ico"
            sizes = '48x48'
            type = 'image/x-icon'
            purpose = 'any'
        }
    )
} | ConvertTo-Json -Depth 4
[System.IO.File]::WriteAllText($manifestPath, $manifest, [System.Text.UTF8Encoding]::new($false))

$indexPath = Join-Path $target 'index.html'
$html = Get-Content $indexPath -Raw -Encoding UTF8
$manifestHref = "${assetPrefix}/manifest.webmanifest"
$fontHref = "${assetPrefix}/fonts/ionicons.ttf"
$inject = @"
<meta charset="utf-8" />
<meta name="description" content="Comida a domicilio y servicios locales en Zinapécuaro." />
<meta name="apple-mobile-web-app-capable" content="yes" />
<meta name="apple-mobile-web-app-status-bar-style" content="default" />
<meta name="apple-mobile-web-app-title" content="ZinApp" />
<meta name="mobile-web-app-capable" content="yes" />
<link rel="manifest" href="$manifestHref" />
<link rel="preload" href="$fontHref" as="font" type="font/ttf" crossorigin="anonymous" />
<style id="zinapp-web-fonts">
  @font-face {
    font-family: ionicons;
    src: url('$fontHref') format('truetype');
    font-display: block;
  }
</style>
<style id="zinapp-web-polish">
  html, body { height: 100%; min-height: 100dvh; margin: 0; }
  body { overflow: hidden; -webkit-font-smoothing: antialiased; -webkit-tap-highlight-color: transparent; touch-action: manipulation; }
  #root { height: 100%; min-height: 100dvh; display: flex; flex: 1; flex-direction: column; width: 100%; min-height: 0; }
  #root > div { flex: 1; display: flex; flex-direction: column; min-height: 0; height: 100%; width: 100%; }
  input, textarea, select {
    font-size: 16px !important;
    outline: none !important;
    border: none !important;
    box-shadow: none !important;
    background: transparent !important;
    appearance: none;
    -webkit-appearance: none;
  }
  input:focus, input:focus-visible, textarea:focus, textarea:focus-visible, select:focus {
    outline: none !important;
    box-shadow: none !important;
  }
  input:-webkit-autofill,
  input:-webkit-autofill:hover,
  input:-webkit-autofill:focus {
    -webkit-box-shadow: 0 0 0 1000px transparent inset !important;
    box-shadow: 0 0 0 1000px transparent inset !important;
  }
  [role="button"], button, a { cursor: pointer; }
  [data-testid="bottom-tab-bar"], nav[aria-label*="tab" i] { z-index: 1000 !important; }
  @media (max-width: 767px) {
    html, body { background: linear-gradient(180deg, #dbeafe 0%, #eef2ff 100%); }
    #root { justify-content: center; align-items: center; }
    [data-testid="bottom-tab-bar"], nav[aria-label*="tab" i] {
      position: fixed !important;
      bottom: 0 !important;
      left: 50% !important;
      transform: translateX(-50%) !important;
      width: min(520px, 100vw) !important;
    }
  }
  @media (min-width: 768px) {
    html, body { background: #f8fafc; overflow: hidden; }
    #root { justify-content: stretch; align-items: stretch; }
    #root > div { max-width: none !important; width: 100% !important; }
  }
</style>
"@
$html = $html -replace '<meta name="description"[^>]*>\s*', ''
$html = $html -replace '<noscript>\s*You need to enable JavaScript[^<]*</noscript>', '<noscript>Activa JavaScript para usar ZinApp.</noscript>'
$html = $html -replace '</head>', "$inject</head>"
[System.IO.File]::WriteAllText($indexPath, $html, [System.Text.UTF8Encoding]::new($false))

$jsDir = Join-Path $target '_expo\static\js\web'
if (Test-Path $jsDir) {
    $exportPrefix = if ($resolvedBase -eq '/') { '' } else { $resolvedBase }
    $navOld = "$exportPrefix/assets/node_modules/@react-navigation/elements/lib/module/assets/"
    if ($navOld -eq '/assets/') { $navOld = '/assets/node_modules/@react-navigation/elements/lib/module/assets/' }
    if ($resolvedBase -ne '/') {
        $navOld = '/app/assets/node_modules/@react-navigation/elements/lib/module/assets/'
    }
    $navNew = "${assetPrefix}/icons/nav/"
    $ionNew = "${assetPrefix}/fonts/ionicons.ttf"
    $ionOldPattern = if ($resolvedBase -eq '/') {
        '/assets/node_modules/@expo/vector-icons/build/vendor/react-native-vector-icons/Fonts/Ionicons[^"]+\.ttf'
    } else {
        '/app/assets/node_modules/@expo/vector-icons/build/vendor/react-native-vector-icons/Fonts/Ionicons[^"]+\.ttf'
    }
    $patchedCount = 0
    Get-ChildItem (Join-Path $jsDir '*.js') | ForEach-Object {
        $content = [System.IO.File]::ReadAllText($_.FullName)
        $next = $content.Replace($navOld, $navNew)
        if ($resolvedBase -eq '/') {
            $next = $next.Replace('/assets/node_modules/@react-navigation/elements/lib/module/assets/', $navNew)
        }
        $next = [regex]::Replace($next, $ionOldPattern, $ionNew)
        if ($next -ne $content) {
            [System.IO.File]::WriteAllText($_.FullName, $next, [System.Text.UTF8Encoding]::new($false))
            $patchedCount++
        }
    }
    if ($patchedCount -gt 0) {
        Write-Host "Bundles JS parcheados ($patchedCount archivos)." -ForegroundColor Green
    }
}

Write-Host 'HTML y manifest PWA actualizados.' -ForegroundColor Green
Write-Host '[OK] Web copiada a backend/static/webapp/' -ForegroundColor Green
Write-Host ''
Write-Host "Comparte: $publicUrl$scope" -ForegroundColor Green
Write-Host ''

if ($Deploy) {
    Write-Host 'Desplegando backend en Railway...' -ForegroundColor Cyan
    Push-Location $backendRoot
    railway up --detach
    Pop-Location
    Write-Host "Espera ~2 min y abre $publicUrl$scope" -ForegroundColor Yellow
} else {
    if ($resolvedBase -eq '/app' -and -not (Test-Path (Join-Path $PWD '.env.web'))) {
        Write-Host 'Tip: dominio propio sin "api-production":' -ForegroundColor Yellow
        Write-Host '  copy .env.web.example .env.web' -ForegroundColor Gray
        Write-Host '  backend\scripts\setup-railway-domain.ps1 -Domain zinapp.mx' -ForegroundColor Gray
    }
    Write-Host 'Para publicar:' -ForegroundColor Yellow
    Write-Host '  cd backend && railway up --detach' -ForegroundColor Gray
}
