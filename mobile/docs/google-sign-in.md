# Google Sign-In (clientes)

## 1. Google Cloud Console

1. Abre [Google Cloud Console](https://console.cloud.google.com/) → APIs y servicios → Pantalla de consentimiento OAuth.
2. Tipo **Externo** (o Interno si es Workspace).
3. Credenciales → **Crear credenciales** → ID de cliente de OAuth → tipo **Aplicación web**.
4. Orígenes JavaScript autorizados:
   - `https://zinapp.com.mx`
   - `http://localhost:8081` (dev Expo web)
5. URI de redirección autorizados:
   - `https://zinapp.com.mx/app`
   - `https://auth.expo.io/@g2adriaans-team/zinapp` (si usas Expo Go / proxy)
   - El que muestre Expo en consola al probar (`makeRedirectUri`)
6. Copia el **Client ID** (`….apps.googleusercontent.com`).

Para apps nativas: crea también client IDs iOS/Android con el bundle `com.zinapp.delivery`.

## 2. Railway (API)

```
GOOGLE_OAUTH_CLIENT_IDS=<WEB_CLIENT_ID>
```

Si tienes varios (Web + Android + iOS), sepáralos por coma. Deben coincidir con el `aud` del `id_token`.

## 3. App / web export

En `mobile/.env` o secrets EAS / `.env.web`:

```
EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID=<WEB_CLIENT_ID>
# Opcional nativo:
EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID=
EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID=
```

Luego:

```powershell
cd mobile
npm run build:web
cd ..\backend
railway up --detach
```

Sin `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID` el botón no se muestra.
Sin `GOOGLE_OAUTH_CLIENT_IDS` en Railway el endpoint responde 503.

## Flujo

Login/Registro (cliente) → Google → `id_token` → `POST /api/auth/google/` → JWT ZinApp.
