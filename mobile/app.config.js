const appJson = require('./app.json');

const DEFAULT_API = appJson.expo.extra?.apiUrl;
const apiUrl = process.env.EXPO_PUBLIC_API_URL || DEFAULT_API;
const environment = process.env.EXPO_PUBLIC_ENV || 'development';
const googleMapsApiKey = process.env.GOOGLE_MAPS_API_KEY || '';

if (
  (environment === 'production' || environment === 'preview') &&
  (!apiUrl || /^https?:\/\/(192\.168\.|10\.|localhost|127\.)/.test(apiUrl))
) {
  throw new Error(
    `EXPO_PUBLIC_API_URL debe ser HTTPS público en ${environment}. ` +
      'Edita eas.json o define la variable antes del build.',
  );
}

const webBasePath = process.env.EXPO_PUBLIC_WEB_BASE_PATH || '/';

/** @type {import('expo/config').ExpoConfig} */
module.exports = () => ({
  ...appJson.expo,
  experiments: {
    baseUrl: webBasePath,
  },
  android: {
    ...appJson.expo.android,
    config: {
      ...(appJson.expo.android?.config ?? {}),
      googleMaps: {
        apiKey: googleMapsApiKey,
      },
    },
  },
  ios: {
    ...appJson.expo.ios,
    config: {
      ...(appJson.expo.ios?.config ?? {}),
      googleMapsApiKey: googleMapsApiKey,
    },
  },
  extra: {
    ...appJson.expo.extra,
    apiUrl,
    environment,
    googleMapsApiKey,
  },
});
