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

- **Cliente** — Restaurantes, carrito, pedidos, envíos, seguimiento en vivo.
- **Restaurante** — Aceptar/rechazar pedidos, menú, categoría del local.
- **Repartidor** — Disponibilidad, GPS, entregas de comida y envíos.
- **Administrador** — Panel Django Admin + dashboard móvil.

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

### Docker (local / SQLite)

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

## Tests

```bash
cd backend
python manage.py test accounts orders restaurants
```

## Licencia

Proyecto privado — ZinApp © 2026
