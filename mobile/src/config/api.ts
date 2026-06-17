import Constants from 'expo-constants';

const extra = Constants.expoConfig?.extra as {
  apiUrl?: string;
  environment?: string;
} | undefined;

/** API pública en Railway (APK / preview / production). */
export const PRODUCTION_API_URL = 'https://zinapp-api-production.up.railway.app/api';

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

  return configured || 'http://192.168.1.27:8000/api';
}

export const API_URL = resolveApiUrl();
export const API_ENVIRONMENT = extra?.environment ?? (__DEV__ ? 'development' : 'preview');
export const IS_PRODUCTION_APP = !__DEV__;

/** Timeout largo: Railway puede tardar al despertar (cold start). */
export const API_TIMEOUT_MS = IS_PRODUCTION_APP ? 90000 : 15000;
