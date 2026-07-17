# Aplicación móvil ZinApp

Cliente Expo SDK 54 para Android, iOS y web. El código vive en `src/`, con
navegación y pantallas organizadas por rol.

## Desarrollo

```powershell
npm ci
npx expo start --go --clear
npx tsc --noEmit
```

Configura `EXPO_PUBLIC_API_URL` para apuntar a la API. En Expo Go físico usa la
IP LAN del backend; en producción usa HTTPS.

## Builds

- `npm run build:preview`: APK interno mediante EAS.
- `npm run build:production`: AAB para Google Play mediante EAS.
- `npm run build:web:deploy`: compila web y copia el resultado al backend.

Las credenciales de Google Play, Apple y firma Android se provisionan mediante
los secretos o credenciales administradas por EAS, no en archivos versionados.
El workflow de GitHub genera solo un APK de depuración como artefacto de CI, no
una distribución de producción.
