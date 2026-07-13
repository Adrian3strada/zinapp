# ZinApp — textos para App Store y Google Play

Copia y pega en Play Console y App Store Connect.

---

## URLs obligatorias

| Campo | Valor |
|-------|-------|
| Política de privacidad | https://zinapp-api-production.up.railway.app/privacidad/ |
| Email de soporte | adrianestradachavez123@gmail.com |
| Package (Android) | com.zinapp.delivery |
| Bundle ID (iOS) | com.zinapp.delivery |

---

## Nombre de la app

**ZinApp**

---

## Descripción corta (Google Play, máx. 80 caracteres)

Pedidos a domicilio en Zinapécuaro. Comida local, seguimiento en vivo.

---

## Descripción larga (ambas tiendas)

ZinApp es la app de delivery local para Zinapécuaro, Michoacán.

Pide comida de restaurantes de tu ciudad o trabaja como repartidor. Sigue tu pedido en tiempo real, paga en efectivo o por transferencia y recibe notificaciones en cada paso.

**Para clientes**
- Explora restaurantes y menús
- Arma tu carrito y pide a domicilio
- Propinas, cupones y pedidos programados
- Sigue el estado de tu pedido en vivo

**Para restaurantes**
- Recibe y gestiona pedidos
- Actualiza el estado: preparando, listo, entregado

**Para repartidores**
- Acepta entregas disponibles
- Navega con mapas y marca entregas completadas

ZinApp está pensada para la comunidad de Zinapécuaro. Descarga la app y pide en minutos.

---

## Palabras clave (App Store, separadas por coma)

delivery,comida,zinapécuaro,pedidos,restaurantes,repartidor,michoacán

---

## Categoría

**Food & Drink** (Comida y bebida)

---

## Clasificación de edad sugerida

**4+ / Para todos** — sin contenido violento ni adulto. Compras dentro de la app (pedidos).

---

## App Privacy / Data safety — qué declarar

| Dato | Uso | ¿Se comparte? | ¿Tracking (Apple)? |
|------|-----|----------------|--------------------|
| Nombre, email, teléfono | Cuenta y pedidos | Solo restaurante/repartidor del pedido | **No** |
| Ubicación precisa | Delivery y mapas | Sí, para completar el servicio | **No** |
| Fotos | Comprobantes opcionales | No vendidas; uso del servicio | **No** |
| Identificadores (cuenta) | Autenticación | No vendidos | **No** |
| Historial de pedidos | Operación del servicio | No vendido | **No** |

**Importante App Store (Guideline 5.1.2):** ZinApp **no hace tracking** publicitario ni comparte datos con data brokers. En App Store Connect → Privacidad de la app, la pregunta *«¿Usas datos para hacer seguimiento?»* debe ser **No**. No marques “Used to Track You”.

**Permisos del dispositivo:** ubicación, cámara/fotos, notificaciones.

---

## Capturas recomendadas (toma en el APK o TestFlight)

1. Pantalla de inicio / login
2. Listado de restaurantes
3. Carrito o detalle de pedido
4. Mapa / seguimiento de entrega
5. Pantalla de repartidor o restaurante (opcional)

**Tamaños Google Play:** teléfono 1080×1920 px (mín. 2 capturas).

**Tamaños App Store:** iPhone 6.7" (1290×2796) y 6.5" (1284×2778).

---

## Acceso para revisores (App Store / Play)

Cuentas dedicadas en producción (no bloqueadas por `DEMO_ACCOUNTS_ENABLED`).  
Crear/actualizar: `python manage.py seed_app_review` en el backend.

| Rol | Usuario | Contraseña |
|-----|---------|------------|
| Cliente | `apple_review_cliente` | `ReviewZinApp2026!` |
| Restaurante | `apple_review_rest` | `ReviewZinApp2026!` |
| Repartidor | `apple_review_driver` | `ReviewZinApp2026!` |

### App Store Connect → App Review Information

**Username:** `apple_review_cliente`  
**Password:** `ReviewZinApp2026!`

**Notes (pegar en inglés):**

```
ZinApp is a local delivery app for Zinapécuaro, Mexico. Login is required.

Demo accounts (password for all: ReviewZinApp2026!):

1) Customer: apple_review_cliente
   — Browse restaurants (including "ZinApp Review Kitchen"), place an order, track delivery.

2) Restaurant: apple_review_rest
   — Accept and manage incoming orders. Restaurant is pre-activated.

3) Driver: apple_review_driver
   — View available deliveries and complete them.

How to switch roles: log out from Profile, then sign in with another account.
Location: allow location if prompted. Customer profile already has a Zinapécuaro address.

Account deletion (5.1.1): Profile → scroll to "Eliminar cuenta" → enter password → confirm.
Tracking (5.1.2): ZinApp does not track users for advertising. App Privacy should answer No to tracking; no ATT dialog is shown because we do not track.

Support: adrianestradachavez123@gmail.com
```

### Reply si Apple pregunta por tracking

```
ZinApp does not track users. We do not link data with third-party data for advertising or share data with data brokers. App Privacy Information has been / will be updated so that tracking is marked as No. Location and contact data are used only to provide the delivery service.
```

### Google Play → App access

> Username: apple_review_cliente / Password: ReviewZinApp2026!  
> Also: apple_review_rest and apple_review_driver (same password) for restaurant and driver modes.

---

## App web (alternativa a Play Store)

Publicada en la misma URL de Railway, sin tiendas:

| | |
|--|--|
| **URL produccion** | https://zinapp-api-production.up.railway.app/app/ |
| **Desarrollo local** | `cd mobile && npm run web` |

```powershell
cd mobile
npm run build:web          # genera dist + copia a backend/static/webapp
cd ..\backend
railway up --detach        # publica /app/ y /privacidad/
```

O en un paso: `npm run build:web:deploy`

---

## Notas internas

- Backend: https://zinapp-api-production.up.railway.app/api
- Builds: `.\scripts\publish-stores.ps1 -Step build -Platform all`
- Submit: `.\scripts\publish-stores.ps1 -Step submit -Platform android` (requiere `google-play-key.json`)
