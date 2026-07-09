const appJson = require('./app.json');

const DEFAULT_API = appJson.expo.extra?.apiUrl;
const apiUrl = process.env.EXPO_PUBLIC_API_URL || DEFAULT_API;
const environment = process.env.EXPO_PUBLIC_ENV || 'development';

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
  extra: {
    ...appJson.expo.extra,
    apiUrl,
    environment,
  },
});
