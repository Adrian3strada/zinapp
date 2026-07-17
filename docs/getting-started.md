# Configuración local

## Backend

Se requiere Python 3.12. Desde `backend/`, crea un entorno virtual, instala
`requirements.txt`, copia `.env.example` como `.env`, ejecuta migraciones y
arranca Django. `USE_SQLITE=True` es la ruta más rápida para desarrollo.

Para PostgreSQL local usa Docker Compose y las instrucciones de
`backend/scripts/setup-postgres-local.ps1`. Los scripts PowerShell son la
interfaz operativa soportada en Windows; en otros sistemas ejecuta los comandos
Django y Docker equivalentes.

## Mobile

Se requiere Node 20. Desde `mobile/`, usa `npm ci` y `npx expo start --go`.
La URL de API se resuelve desde `EXPO_PUBLIC_API_URL`; para un dispositivo
físico usa la IP LAN del equipo, no `localhost`.

`npm run build:web:deploy` compila la SPA y la copia de forma intencional a
`backend/static/webapp/`, que es el único output web versionado porque el
backend lo sirve en producción. `mobile/dist*` y `mobile/backend/` son outputs
locales y no deben incluirse en commits.

## Entornos

| Entorno | Base de datos | Uso |
|---|---|---|
| Local | SQLite | Desarrollo rápido |
| Local Docker | PostgreSQL | Pruebas de integración |
| Railway/VPS | PostgreSQL | Producción |

Nunca copies archivos `.env`, llaves de firma, certificados o credenciales de
tiendas al repositorio. Consulta `backend/.env.production.example` para el
inventario de producción.
