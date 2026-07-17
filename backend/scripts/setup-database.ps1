# Prepara la base de datos: migraciones + estado
# Uso:
#   .\scripts\setup-database.ps1 -Target local
#   .\scripts\setup-database.ps1 -Target docker
#   .\scripts\setup-database.ps1 -Target docker -Postgres
#   .\scripts\setup-database.ps1 -Target railway -Seed
#
# Nota Railway: las migraciones corren en cada deploy (docker-entrypoint.sh).
# `railway run` desde Windows no conecta al Postgres interno; usa redeploy o Railway shell.

param(
    [ValidateSet('local', 'docker', 'railway')]
    [string]$Target = 'local',
    [switch]$Postgres,
    [switch]$Seed,
    [switch]$ResetSeed
)

$ErrorActionPreference = 'Stop'
Set-Location $PSScriptRoot\..

function Invoke-LocalDb {
    if (-not (Test-Path '.env')) {
        Write-Host 'Ejecuta primero: .\scripts\setup-env.ps1' -ForegroundColor Yellow
        exit 1
    }
    python scripts/wait_for_db.py
    python manage.py migrate --noinput
    python manage.py showmigrations --list | Select-String '\[ \]' | ForEach-Object {
        Write-Host "Pendiente: $_" -ForegroundColor Yellow
    }
    if ($Seed -or $ResetSeed) {
        $seedArgs = @('seed_data')
        if ($ResetSeed) { $seedArgs += '--reset' }
        python manage.py @seedArgs
    }
}

function Invoke-DockerDb {
    $compose = @('compose')
    if ($Postgres) {
        $compose += @('-f', 'docker-compose.yml', '-f', 'docker-compose.postgres.yml')
    }
    docker @compose run --rm api python scripts/wait_for_db.py
    docker @compose run --rm api python manage.py migrate --noinput
    if ($Seed -or $ResetSeed) {
        $cmd = 'python manage.py seed_data'
        if ($ResetSeed) { $cmd += ' --reset' }
        docker @compose run --rm api sh -c $cmd
    }
    Write-Host 'Base de datos Docker lista.' -ForegroundColor Green
}

function Invoke-RailwayDb {
    if (-not (Get-Command railway -ErrorAction SilentlyContinue)) {
        Write-Host 'Instala Railway CLI: npm install -g @railway/cli' -ForegroundColor Red
        exit 1
    }

    Write-Host 'Railway: las migraciones se aplican al desplegar (entrypoint).' -ForegroundColor Cyan

    if ($Seed -or $ResetSeed) {
        Write-Host 'Activando SEED_DATA para el proximo deploy...' -ForegroundColor Cyan
        railway variable set SEED_DATA=true --service zinapp-api
        if ($ResetSeed) {
            Write-Host 'Nota: --ResetSeed requiere shell en el contenedor (Railway dashboard > Shell).' -ForegroundColor Yellow
        }
    }

    Write-Host 'Desplegando...' -ForegroundColor Cyan
    railway up --detach

    if ($Seed -or $ResetSeed) {
        Write-Host 'Tras verificar datos, desactiva seed:' -ForegroundColor Yellow
        Write-Host '  railway variable set SEED_DATA=false --service zinapp-api' -ForegroundColor Yellow
    }

    Write-Host 'Verifica: curl https://zinapp.com.mx/api/health/' -ForegroundColor Green
}

Write-Host "=== ZinApp setup-database ($Target) ===" -ForegroundColor Cyan

switch ($Target) {
    'local' { Invoke-LocalDb }
    'docker' { Invoke-DockerDb }
    'railway' { Invoke-RailwayDb }
}

if ($Target -eq 'local') {
    python manage.py check 2>$null
    if ($LASTEXITCODE -eq 0) {
        Write-Host 'Django check OK.' -ForegroundColor Green
    }
}
