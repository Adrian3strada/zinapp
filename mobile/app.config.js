const fs = require('fs');
const path = require('path');
const { withAndroidManifest } = require('@expo/config-plugins');

const appJson = require('./app.json');

const DEFAULT_API = appJson.expo.extra?.apiUrl;
const apiUrl = process.env.EXPO_PUBLIC_API_URL || DEFAULT_API;
const environment = process.env.EXPO_PUBLIC_ENV || 'development';

const googleServicesPath = path.join(__dirname, 'google-services.json');
const hasGoogleServices = fs.existsSync(googleServicesPath);

if (
  (environment === 'production' || environment === 'preview') &&
  (!apiUrl || /^https?:\/\/(192\.168\.|10\.|localhost|127\.)/.test(apiUrl))
) {
  throw new Error(
    `EXPO_PUBLIC_API_URL debe ser HTTPS público en ${environment}. ` +
      'Edita eas.json o define la variable antes del build.',
  );
}

// Push Android (FCM): sin google-services.json el APK no registra token FCM
// y Expo acepta el envío pero el dispositivo no recibe la notificación.
if ((environment === 'production' || environment === 'preview') && !hasGoogleServices) {
  throw new Error(
    `[PUSH] Falta mobile/google-services.json (requerido para notificaciones Android). ` +
      'Descárgalo en Firebase Console para el package com.zinapp.delivery, ' +
      'colócalo en mobile/google-services.json y sube la clave FCM V1 a EAS. ' +
      'Guía: mobile/docs/android-push-fcm.md',
  );
}
if (!hasGoogleServices) {
  console.warn(
    '[PUSH] Sin google-services.json — push remoto Android no funcionará hasta configurarlo. ' +
      'Ver mobile/docs/android-push-fcm.md',
  );
}

const webBasePath = process.env.EXPO_PUBLIC_WEB_BASE_PATH || '/';

const ANDROID_QUERIES = [
  { scheme: 'geo' },
  { scheme: 'google.navigation' },
  { scheme: 'comgooglemaps' },
  { scheme: 'waze' },
  { scheme: 'whatsapp' },
  { scheme: 'https', host: 'wa.me' },
  { scheme: 'https', host: 'api.whatsapp.com' },
  { package: 'com.google.android.apps.maps' },
  { package: 'com.waze' },
  { package: 'com.whatsapp' },
  { package: 'com.whatsapp.w4b' },
];

function androidQueryNode(query) {
  if (query.scheme) {
    const dataAttrs = { 'android:scheme': query.scheme };
    if (query.host) dataAttrs['android:host'] = query.host;
    return {
      intent: [{
        action: [{ $: { 'android:name': 'android.intent.action.VIEW' } }],
        data: [{ $: dataAttrs }],
      }],
    };
  }
  return { package: [{ $: { 'android:name': query.package } }] };
}

function withAndroidMapQueries(config) {
  return withAndroidManifest(config, (configWithManifest) => {
    const manifest = configWithManifest.modResults.manifest;
    const existing = manifest.queries ?? [];
    manifest.queries = [...existing, ...ANDROID_QUERIES.map(androidQueryNode)];
    return configWithManifest;
  });
}

/** @type {(context: { config: import('expo/config').ExpoConfig }) => import('expo/config').ExpoConfig} */
module.exports = ({ config }) => withAndroidMapQueries({
  ...config,
  ...appJson.expo,
  android: {
    ...appJson.expo.android,
    ...(hasGoogleServices ? { googleServicesFile: './google-services.json' } : {}),
  },
  experiments: {
    ...(config.experiments ?? {}),
    baseUrl: webBasePath,
  },
  extra: {
    ...appJson.expo.extra,
    apiUrl,
    environment,
    googleWebClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID || '',
    googleIosClientId: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID || '',
    googleAndroidClientId: process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID || '',
    hasGoogleServices,
  },
});
