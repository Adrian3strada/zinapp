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

| Dato | Uso | ¿Se comparte? |
|------|-----|----------------|
| Nombre, email, teléfono | Cuenta y pedidos | Solo restaurante/repartidor del pedido |
| Ubicación precisa | Delivery y mapas | Sí, para completar el servicio |
| Fotos | Comprobantes opcionales | No vendidas; uso del servicio |
| Identificadores (cuenta) | Autenticación | No vendidos |
| Historial de pedidos | Operación del servicio | No vendido |

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

## Acceso para revisores (si la app requiere login)

En Play Console → App content → App access, indica:

> Cuenta de prueba: crear usuario desde la app con registro, o contactar a adrianestradachavez123@gmail.com para credenciales de demo.

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
