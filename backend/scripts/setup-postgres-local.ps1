# PostgreSQL local (Windows) — crea la BD y prepara Django
# Requisito: PostgreSQL instalado y servicio en ejecución (puerto 5433 por defecto en este PC)
#
# Uso:
#   .\scripts\setup-postgres-local.ps1
#   .\scripts\setup-postgres-local.ps1 -Password "tu_clave_postgres"
#   .\scripts\setup-postgres-local.ps1 -Seed
#   .\scripts\setup-postgres-local.ps1 -Password "..." -ResetSeed

param(
    [string]$Password,
    [int]$Port = 5433,
    [string]$HostName = '127.0.0.1',
    [string]$User = 'postgres',
    [string]$Database = 'zinapp_db',
    [switch]$Seed,
    [switch]$ResetSeed
)

$ErrorActionPreference = 'Stop'
Set-Location $PSScriptRoot\..

# Variables de entorno del sistema pueden pisar .env (p. ej. USE_SQLITE=True)
Remove-Item Env:USE_SQLITE -ErrorAction SilentlyContinue
Remove-Item Env:DATABASE_URL -ErrorAction SilentlyContinue

$psql = 'C:\Program Files\PostgreSQL\18\bin\psql.exe'
$createdb = 'C:\Program Files\PostgreSQL\18\bin\createdb.exe'

if (-not (Test-Path $psql)) {
    $found = Get-ChildItem 'C:\Program Files\PostgreSQL\*\bin\psql.exe' -ErrorAction SilentlyContinue |
        Sort-Object { [int]($_.Directory.Parent.Name -replace '\D', '') } -Descending |
        Select-Object -First 1
    if ($found) {
        $psql = $found.FullName
        $createdb = Join-Path $found.DirectoryName 'createdb.exe'
    } else {
        Write-Host 'No se encontró psql.exe. Instala PostgreSQL o ajusta la ruta en el script.' -ForegroundColor Red
        exit 1
    }
}

if (-not $Password) {
    $secure = Read-Host "Contraseña del usuario PostgreSQL '$User'" -AsSecureString
    $ptr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
    try {
        $Password = [Runtime.InteropServices.Marshal]::PtrToStringAuto($ptr)
    } finally {
        [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($ptr)
    }
}

if (-not $Password) {
    Write-Host 'Contraseña vacía — cancelado.' -ForegroundColor Red
    exit 1
}

$env:PGPASSWORD = $Password

Write-Host "=== ZinApp - PostgreSQL local (${HostName}:${Port}) ===" -ForegroundColor Cyan

& $psql -U $User -h $HostName -p $Port -c 'SELECT 1;' 2>&1 | Out-Null
if ($LASTEXITCODE -ne 0) {
    Write-Host "No se pudo conectar a PostgreSQL en ${HostName}:${Port}." -ForegroundColor Red
    Write-Host 'Verifica que el servicio postgresql-x64-* esté Running y la contraseña sea correcta.' -ForegroundColor Yellow
    exit 1
}
Write-Host 'Conexión OK.' -ForegroundColor Green

$dbExists = (& $psql -U $User -h $HostName -p $Port -tAc "SELECT 1 FROM pg_database WHERE datname = '$Database';" 2>$null)
if (-not $dbExists -or $dbExists.Trim() -ne '1') {
    Write-Host "Creando base de datos '$Database'..." -ForegroundColor Cyan
    & $createdb -U $User -h $HostName -p $Port $Database
    if ($LASTEXITCODE -ne 0) {
        Write-Host 'No se pudo crear la base de datos.' -ForegroundColor Red
        exit 1
    }
} else {
    Write-Host "Base de datos '$Database' ya existe." -ForegroundColor Green
}

if (-not (Test-Path '.env')) {
    Copy-Item '.env.example' '.env'
    Write-Host '.env creado desde .env.example' -ForegroundColor Yellow
}

$content = Get-Content '.env' -Raw
$content = $content -replace '(?m)^USE_SQLITE=.*', 'USE_SQLITE=False'
$content = $content -replace '(?m)^DB_HOST=.*', "DB_HOST=$HostName"
$content = $content -replace '(?m)^DB_PORT=.*', "DB_PORT=$Port"
$content = $content -replace '(?m)^DB_NAME=.*', "DB_NAME=$Database"
$content = $content -replace '(?m)^DB_USER=.*', "DB_USER=$User"
$content = $content -replace '(?m)^DB_PASSWORD=.*', "DB_PASSWORD=$Password"
if ($content -notmatch '(?m)^DB_PASSWORD=') {
    $content += "`nDB_PASSWORD=$Password`n"
}
Set-Content '.env' -Value $content.TrimEnd() -NoNewline

Write-Host '.env actualizado (USE_SQLITE=False, PostgreSQL).' -ForegroundColor Green

python scripts/wait_for_db.py
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

python manage.py migrate --noinput
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

if ($Seed -or $ResetSeed) {
    $seedArgs = @('seed_data')
    if ($ResetSeed) { $seedArgs += '--reset' }
    python manage.py @seedArgs
}

python manage.py check
Write-Host ''
Write-Host 'Listo. Arranca la API:' -ForegroundColor Green
Write-Host '  python manage.py runserver 0.0.0.0:8000' -ForegroundColor Cyan
Write-Host ''
Write-Host 'Health: http://127.0.0.1:8000/api/health/  →  database: postgresql' -ForegroundColor Cyan
