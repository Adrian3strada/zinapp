# Backend ZinApp

API Django 5, panel de operaciones y servidor de la SPA web.

## Comandos principales

```powershell
pip install -r requirements.txt
copy .env.example .env
python manage.py migrate
python manage.py runserver 0.0.0.0:8000
python manage.py test accounts accounts.test_security restaurants orders.tests.MercadoPagoWebhookTests
```

Apps principales: `accounts` (identidad), `restaurants` (catálogo),
`orders` (pedidos/pagos/envíos), `local_services` y `dashboard`.

Los scripts en `scripts/` cubren desarrollo, PostgreSQL, Docker, Railway,
Render y VPS. Revisa sus parámetros antes de ejecutarlos: `SEED_DATA` requiere
además `ALLOW_DEMO_SEED=true` y nunca debe habilitarse en producción.

La API vive bajo `/api/`; el panel bajo `/panel/`; `/app/` sirve el build
generado desde `mobile/`. La configuración de producción y los controles
requeridos están en `../docs/security.md`.
