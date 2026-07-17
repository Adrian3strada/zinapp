import Constants from 'expo-constants';

const extra = Constants.expoConfig?.extra as {
  apiUrl?: string;
  environment?: string;
} | undefined;

/** API pública canónica (APK / preview / producción). */
export const PRODUCTION_API_URL = 'https://zinapp.com.mx/api';

/** En release (APK/AAB) siempre usar Railway, nunca IP local. */
function resolveApiUrl(): string {
  const configured = extra?.apiUrl?.trim();
  const isLocal =
    !configured ||
    /^https?:\/\/(192\.168\.|10\.|localhost|127\.)/.test(configured);

  if (!__DEV__) {
    return isLocal ? PRODUCTION_API_URL : configured!;
  }

  const environment = extra?.environment ?? 'development';
  if (environment === 'preview' || environment === 'production') {
    return isLocal ? PRODUCTION_API_URL : configured!;
  }

  // Expo Go / dev: override con EXPO_PUBLIC_API_URL; si no, app.json (Railway) o producción
  const devOverride = process.env.EXPO_PUBLIC_API_URL?.trim();
  if (devOverride) return devOverride;
  if (configured && isLocal) return configured;

  return configured || PRODUCTION_API_URL;
}

export const API_URL = resolveApiUrl();
export const API_ENVIRONMENT = extra?.environment ?? (__DEV__ ? 'development' : 'preview');
export const IS_PRODUCTION_APP = !__DEV__;

/** Timeout largo: Railway puede tardar al despertar (cold start). */
export const API_TIMEOUT_MS = IS_PRODUCTION_APP ? 90000 : 15000;
