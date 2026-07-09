# ZinApp — Delivery local para Zinapécuaro

App móvil tipo Didi Food / Uber Eats enfocada en Zinapécuaro, Michoacán.

## Stack

| Capa | Tecnología |
|------|------------|
| Mobile | React Native + Expo SDK 54 |
| Backend | Django + Django REST Framework |
| Base de datos | PostgreSQL (prod) / SQLite (dev) |
| Auth | JWT (SimpleJWT) |
| Pagos | Efectivo, transferencia, Mercado Pago (opcional) |
| Mapas | OpenStreetMap + rutas OSRM |
| Push | Expo Notifications |

## Roles

- **Cliente** — Restaurantes, carrito, pedidos, seguimiento en vivo, ofertas y reseñas.
- **Restaurante** — Aceptar/rechazar pedidos, menú, categoría del local.
- **Repartidor** — Disponibilidad, GPS y entregas de comida.
- **Administrador** — Panel web en `/panel/` (operaciones + gestión de datos).

## URLs de producción

| Servicio | URL |
|----------|-----|
| App web | `/app/` |
| Panel admin | `/panel/login/` |
| Gestión CRUD | `/panel/gestion/` |
| API | `/api/` |

## Funcionalidades principales

- Rutas por calles con ETA
- Push «repartidor cerca»
- Envíos con flujo `picked_up` → en camino → entregado
- Cupones, reseñas, ganancias repartidor
- WhatsApp (comprobantes y contacto)
- Cobertura geográfica Zinapécuaro

## Backend

```bash
conda activate zinapp
cd backend
pip install -r requirements.txt
copy .env.example .env
python manage.py migrate
python manage.py runserver 0.0.0.0:8000
```

### PostgreSQL (recomendado para uso real)

**Railway** (producción actual):

```powershell
cd backend
.\scripts\deploy-railway.ps1
```

Crea Postgres, desactiva SQLite y cuentas demo. Usa `-Seed` solo en entornos de prueba.

```powershell
cd mobile
npm run build:web:deploy
```

**Docker local con Postgres:**

```powershell
cd backend
.\scripts\setup-env.ps1
# Edita .env: USE_SQLITE=False, DB_HOST=db, DB_PORT=5432
docker compose -f docker-compose.yml -f docker-compose.postgres.yml up -d --build
.\scripts\setup-database.ps1 -Target docker -Postgres -Seed
```

**Solo migraciones:**

```powershell
.\scripts\setup-database.ps1 -Target railway
.\scripts\setup-database.ps1 -Target local
```

Health check incluye base de datos: `GET /api/health/` → `{"ok": true, "database": "postgresql"}`

### Docker (local / SQLite rápido)

```powershell
cd backend
.\scripts\deploy-docker.ps1
```

### Producción (VPS: PostgreSQL + HTTPS)

1. Apunta un DNS `A` a tu servidor (ej. `api.zinapp.mx`).
2. En el servidor:

```powershell
cd backend
copy .env.production.example .env
# Edita SECRET_KEY, DB_PASSWORD, ALLOWED_HOSTS, API_DOMAIN, MERCADOPAGO_*
.\scripts\deploy-production.ps1 -WithHttps
```

3. Verifica: `https://api.tu-dominio.com/api/`

Puertos **80** y **443** deben estar abiertos. Caddy obtiene el certificado Let's Encrypt automáticamente.

Sin HTTPS (solo prueba interna): `.\scripts\deploy-production.ps1` (sin `-WithHttps`).

### Variables opcionales (.env)

```env
MERCADOPAGO_ACCESS_TOKEN=APP_USR-...
MERCADOPAGO_BACK_URL=https://tu-dominio.com/pago/ok
MERCADOPAGO_WEBHOOK_URL=https://tu-dominio.com/api/payments/mercadopago/webhook/
```

## Mobile

```bash
cd mobile
npm install
npx expo start --go --clear
```

### API URL por entorno

En `app.json` o con variable de entorno al build:

```bash
set EXPO_PUBLIC_API_URL=https://api.tudominio.com/api
npx expo start
```

### Build producción (EAS)

1. Cambia `EXPO_PUBLIC_API_URL` en `mobile/eas.json` a tu dominio HTTPS real.
2. Instala CLI e inicia sesión:

```bash
npm install -g eas-cli
eas login
```

3. Primera vez (vincular proyecto Expo):

```bash
cd mobile
eas init
```

4. Build APK de prueba o AAB para Play Store:

```powershell
cd mobile
.\scripts\eas-build.ps1 -Profile preview
.\scripts\eas-build.ps1 -Profile production -ApiUrl https://api.tu-dominio.com/api
```

O con npm: `npm run build:preview` / `npm run build:production`.

Perfiles en `mobile/eas.json`: `development`, `preview` (APK), `production` (AAB).

## Endpoints nuevos útiles

| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/api/orders/active/` | Pedidos activos del cliente (liviano) |
| GET | `/api/shipments/active/` | Envíos activos del cliente |
| GET | `/api/orders/driver-earnings/` | Ganancias repartidor (7 días) |
| GET | `/api/coverage/bounds/` | Zona de cobertura |
| POST | `/api/payments/mercadopago/webhook/` | Webhook Mercado Pago |

## Seguridad (producción)

En Railway / VPS configura al menos:

```env
DEBUG=False
SECRET_KEY=<50+ caracteres aleatorios>
DEMO_ACCOUNTS_ENABLED=false
CRON_SECRET=<token largo para cron interno>
CORS_ALLOWED_ORIGINS=https://tu-dominio.com
```

Medidas activas en el backend:

- JWT: access **30 min**, refresh 7 días con rotación
- Rate limiting: login, registro, reset de contraseña y refresh token
- Headers HTTPS (HSTS, cookies seguras, `X-Frame-Options: DENY`)
- Validación de `SECRET_KEY` inseguro si `DEBUG=False`
- Permisos por rol en cada endpoint sensible

Generar `SECRET_KEY`:

```bash
python -c "from django.core.management.utils import get_random_secret_key; print(get_random_secret_key())"
```

## Tests

```bash
cd backend
python manage.py test accounts accounts.test_security orders restaurants
```

## Licencia

Proyecto privado — ZinApp © 2026
