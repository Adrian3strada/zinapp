import Constants, { ExecutionEnvironment } from 'expo-constants';

const extra = Constants.expoConfig?.extra as {
  apiUrl?: string;
  environment?: string;
} | undefined;

/** API pública en Railway (APK / preview / production). */
export const PRODUCTION_API_URL = 'https://zinapp-api-production.up.railway.app/api';

const isStandaloneApp =
  Constants.executionEnvironment === ExecutionEnvironment.Standalone;

function resolveApiUrl(): string {
  const configured = extra?.apiUrl?.trim();
  const environment =
    extra?.environment ?? (isStandaloneApp ? 'preview' : 'development');
  const isLocal =
    !configured ||
    /^https?:\/\/(192\.168\.|10\.|localhost|127\.)/.test(configured);

  if (environment === 'preview' || environment === 'production' || isStandaloneApp) {
    return isLocal ? PRODUCTION_API_URL : configured!;
  }

  return configured || 'http://192.168.1.27:8000/api';
}

export const API_URL = resolveApiUrl();
export const API_ENVIRONMENT =
  extra?.environment ?? (isStandaloneApp ? 'preview' : 'development');
export const IS_PRODUCTION_APP =
  isStandaloneApp ||
  API_ENVIRONMENT === 'preview' ||
  API_ENVIRONMENT === 'production';

/** Timeout largo: Railway free puede tardar al despertar. */
export const API_TIMEOUT_MS = IS_PRODUCTION_APP ? 30000 : 8000;
