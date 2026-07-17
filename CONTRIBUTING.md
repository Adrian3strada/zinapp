# Contribuir a ZinApp

## Antes de abrir un pull request

1. Parte de una rama actualizada desde `master`.
2. No incluyas `.env`, claves de firma, artefactos locales, credenciales ni
   datos reales de clientes, repartidores o restaurantes.
3. Añade una migración para cada cambio de modelo y ejecuta
   `python manage.py makemigrations --check --dry-run`.
4. Ejecuta la suite backend y `npx tsc --noEmit` descritos en
   [docs/testing.md](docs/testing.md).

## Pull requests

Describe el propósito, impacto de seguridad, migraciones, variables nuevas y
pasos de prueba. Incluye capturas para cambios visuales y señala si se generó
el build web en `backend/static/webapp/`.

No publiques cambios directamente a `master`. Los propietarios del repositorio
deben configurar revisión obligatoria y checks de CI como protección de rama.

## Estilo y dependencias

Mantén los cambios acotados, conserva TypeScript estricto y sigue los patrones
Django existentes. Explica toda dependencia nueva y actualiza documentación,
ejemplos de entorno y CI cuando afecte el flujo de desarrollo.
