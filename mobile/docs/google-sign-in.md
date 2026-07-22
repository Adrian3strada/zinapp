# Google Sign-In (clientes)

## 1. Google Cloud Console

### Web (obligatorio para `/app`)

1. [Google Cloud Console](https://console.cloud.google.com/) → APIs y servicios → Credenciales.
2. **Crear credenciales** → ID de cliente OAuth → tipo **Aplicación web**.
3. Orígenes JavaScript:
   - `https://zinapp.com.mx`
   - `http://localhost:8081`
4. URI de redirección:
   - `https://zinapp.com.mx/app`
   - `https://zinapp.com.mx/app/`
   - `http://localhost:8081`
5. Copia el Client ID web (`….apps.googleusercontent.com`).

En web: Login → Google → vuelve a `/app#id_token=…` → JWT ZinApp.

### iOS (obligatorio para TestFlight / App Store)

Sin esto verás **Error 400: invalid_request** (“doesn't comply with Google's OAuth 2.0 policy”).

1. Credenciales → **Crear** → ID de cliente OAuth → tipo **iOS**.
2. Nombre: `ZinApp iOS`
3. Bundle ID: `com.zinapp.delivery` (exacto)
4. Copia el **Client ID iOS**.

Client ID iOS actual:
`470068451846-1pi2jua9f1q547krpp4fobgoskfh80kd.apps.googleusercontent.com`

En `app.json`, el `scheme` incluye el reversed client ID
(`com.googleusercontent.apps.470068451846-1pi2jua9f1q547krpp4fobgoskfh80kd`) para el redirect nativo.

### Android (obligatorio para APK / Play)

1. Tipo **Android**.
2. Package: `com.zinapp.delivery`
3. SHA-1 del keystore de EAS (credenciales Android en expo.dev).
4. Copia el Client ID Android.

La app mantiene `scheme: zinapp` en `app.json` (deep links generales). El login Google nativo usa el scheme del Client ID iOS/Android (`com.googleusercontent.apps.…`), no el Client ID web.

## 2. Railway (API)

```
GOOGLE_OAUTH_CLIENT_IDS=<WEB_CLIENT_ID>,<IOS_CLIENT_ID>,<ANDROID_CLIENT_ID>
```

Separados por coma. Deben coincidir con el `aud` del `id_token`.

## 3. App / EAS

En `eas.json` (preview/production) o secrets EAS:

```
EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID=<WEB_CLIENT_ID>
EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID=<IOS_CLIENT_ID>
EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID=<ANDROID_CLIENT_ID>
```

Sin Client ID web el botón no se muestra en web.  
Sin Client ID iOS/Android el botón **no se muestra** en esa plataforma nativa (evita el Error 400).

Luego rebuild nativo y, para web:

```powershell
cd mobile
npm run build:web
cd ..\backend
railway up --detach
```

## Flujo

Login/Registro (cliente) → Google → `id_token` → `POST /api/auth/google/` → JWT ZinApp.
