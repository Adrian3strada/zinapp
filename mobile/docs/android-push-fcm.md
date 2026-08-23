# Android push — Firebase / FCM (ZinApp)

Sin esto, Expo puede aceptar el envio (ticket ok) pero el telefono Android no recibe la notificacion.

Package: `com.zinapp.delivery`
EAS project: `56ddb1bb-632f-4087-9a80-e839403c24fc`
Owner: `g2adriaans-team`

## Checklist (en este orden)

### 1. Firebase + google-services.json

1. Abre https://console.firebase.google.com/ y crea/usa un proyecto.
2. Anade app Android con package **com.zinapp.delivery**.
3. Descarga **google-services.json**.
4. Colocalo en `mobile/google-services.json`.
5. `app.config.js` lo enlaza como `android.googleServicesFile`.
6. Builds preview/production fallan si falta el archivo.

Puedes versionar `google-services.json` (IDs publicos).

### 2. Clave FCM V1 en EAS

1. Firebase → Project settings → Service accounts → Generate new private key.
2. Guardala como `mobile/fcm-service-account.json` (esta en .gitignore).
3. Subela a EAS:

```powershell
cd mobile
npx eas-cli credentials -p android
```

Elige profile (production y preview) → Google Service Account → FCM V1 → upload.

Dashboard: https://expo.dev/accounts/g2adriaans-team/projects/zinapp/credentials

### 3. Rebuild Android

```powershell
cd mobile
npx eas-cli build -p android --profile preview
```

Instala el APK/AAB nuevo (el build viejo no trae FCM).

### 4. Verificar

1. Login restaurante owner en Android → filtro `PUSH`.
2. Backend: Token saved / Token found YES / Ticket ID / Receipt status=ok.
3. Manual:

```powershell
cd backend
python manage.py check_push_receipts <TICKET_ID> --user-id <OWNER_USER_ID>
```

## Script

```powershell
cd mobile
.\scripts\setup-android-push.ps1
```
