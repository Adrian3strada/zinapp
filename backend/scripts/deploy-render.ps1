# Subir API a Render.com (HTTPS gratis)
# 1. Crea cuenta en https://render.com (GitHub)
# 2. Sube el repo a GitHub o usa "Blueprint" con render.yaml
# 3. O conecta manualmente: New > Blueprint > repo backend

Write-Host "Render requiere el codigo en GitHub." -ForegroundColor Yellow
Write-Host ""
Write-Host "Pasos rapidos:" -ForegroundColor Cyan
Write-Host "1. git init en c:\dev\zinapp"
Write-Host "2. Sube a GitHub (repo privado)"
Write-Host "3. render.com > New > Blueprint"
Write-Host "4. Selecciona el repo y render.yaml despliega API + Postgres"
Write-Host "5. Copia la URL (https://zinapp-api.onrender.com) a mobile/eas.json"
Write-Host ""
Write-Host "Archivo listo: backend/render.yaml" -ForegroundColor Green
