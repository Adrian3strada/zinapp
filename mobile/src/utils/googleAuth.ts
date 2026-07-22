import Constants from 'expo-constants';
import { Platform } from 'react-native';
import type { AuthRequest } from 'expo-auth-session';
import * as AuthSession from 'expo-auth-session';
import * as Google from 'expo-auth-session/providers/google';
import * as WebBrowser from 'expo-web-browser';

if (Platform.OS !== 'web') {
  WebBrowser.maybeCompleteAuthSession({ skipRedirectCheck: true });
}

const WEB_PENDING_KEY = 'zinapp_google_oauth_pending';
const WEB_STATE_KEY = 'zinapp_google_oauth_state';

type Extra = {
  googleWebClientId?: string;
  googleIosClientId?: string;
  googleAndroidClientId?: string;
};

function googleExtra(): Extra {
  return (Constants.expoConfig?.extra as Extra | undefined) ?? {};
}

export function getGoogleWebClientId(): string {
  return (
    process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID
    || googleExtra().googleWebClientId
    || ''
  ).trim();
}

export function isGoogleSignInConfigured(): boolean {
  return Boolean(getGoogleWebClientId());
}

/**
 * Expo Linking en web usa solo `origin`, así que Google volvía a la landing.
 * Forzamos `/app` (sin slash final: coincide con createURL y con Google Console).
 */
export function getGoogleRedirectUri(): string {
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    const configured = (
      process.env.EXPO_PUBLIC_WEB_BASE_PATH
      || (Constants.expoConfig?.experiments as { baseUrl?: string } | undefined)?.baseUrl
      || ''
    ).trim();

    let base = configured;
    if (!base) {
      const path = window.location.pathname || '/';
      base = path.startsWith('/app') ? '/app' : '/';
    }

    if (!base || base === '/') {
      return window.location.origin;
    }

    const normalized = `/${base.replace(/^\/+|\/+$/g, '')}`;
    return `${window.location.origin}${normalized}`;
  }

  return AuthSession.makeRedirectUri();
}

/** Hook de Expo AuthSession para obtener id_token de Google. */
export function useGoogleIdTokenRequest() {
  const webClientId = getGoogleWebClientId();
  const extra = googleExtra();
  const iosClientId = (process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID || extra.googleIosClientId || '').trim();
  const androidClientId = (
    process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID
    || extra.googleAndroidClientId
    || ''
  ).trim();
  const redirectUri = getGoogleRedirectUri();

  return Google.useIdTokenAuthRequest({
    clientId: webClientId || undefined,
    webClientId: webClientId || undefined,
    iosClientId: iosClientId || undefined,
    androidClientId: androidClientId || undefined,
    redirectUri,
  });
}

export function extractGoogleIdToken(
  response: AuthSession.AuthSessionResult | null,
): string | null {
  if (!response || response.type !== 'success') return null;
  const fromParams = response.params?.id_token;
  if (typeof fromParams === 'string' && fromParams) return fromParams;
  const fromAuth = (response.authentication as { idToken?: string } | null)?.idToken;
  return fromAuth || null;
}

/** Web: evita popups (fallan en móvil). Redirección completa a Google y vuelta a /app. */
export function startGoogleWebRedirect(request: AuthRequest | null): void {
  if (Platform.OS !== 'web' || typeof window === 'undefined') {
    throw new Error('startGoogleWebRedirect solo aplica en web');
  }
  if (!request?.url || !request.state) {
    throw new Error('La solicitud de Google aún no está lista');
  }
  try {
    window.sessionStorage.setItem(WEB_PENDING_KEY, '1');
    window.sessionStorage.setItem(WEB_STATE_KEY, request.state);
  } catch {
    // sessionStorage bloqueado: seguimos; el state check fallará si no se guardó.
  }
  window.location.assign(request.url);
}

function clearGoogleWebRedirectUrl(): void {
  if (typeof window === 'undefined' || !window.history?.replaceState) return;
  const path = `${window.location.pathname}${window.location.search}`;
  window.history.replaceState(null, '', path);
}

/**
 * Si volvemos de Google a /app#id_token=..., consume el token una sola vez.
 * Devuelve null si no hay retorno pendiente.
 */
export function consumeGoogleWebRedirect():
  | { type: 'success'; idToken: string }
  | { type: 'error'; message: string }
  | null {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return null;

  let pending = false;
  let expectedState = '';
  try {
    pending = window.sessionStorage.getItem(WEB_PENDING_KEY) === '1';
    expectedState = window.sessionStorage.getItem(WEB_STATE_KEY) || '';
  } catch {
    return null;
  }
  if (!pending) return null;

  const hash = window.location.hash || '';
  const search = window.location.search || '';
  if (!hash.includes('id_token') && !hash.includes('error') && !search.includes('id_token') && !search.includes('error')) {
    // Aún no llegó el retorno (p. ej. montaje normal).
    return null;
  }

  try {
    window.sessionStorage.removeItem(WEB_PENDING_KEY);
    window.sessionStorage.removeItem(WEB_STATE_KEY);
  } catch {
    // ignore
  }

  const params = new URLSearchParams(hash.replace(/^#/, ''));
  new URLSearchParams(search.replace(/^\?/, '')).forEach((value, key) => {
    if (!params.has(key)) params.set(key, value);
  });
  clearGoogleWebRedirectUrl();

  const error = params.get('error');
  if (error) {
    return {
      type: 'error',
      message: params.get('error_description') || error || 'Cancelado',
    };
  }

  const returnedState = params.get('state') || '';
  if (expectedState && returnedState && returnedState !== expectedState) {
    return { type: 'error', message: 'La verificación de seguridad de Google falló. Intenta de nuevo.' };
  }

  const idToken = params.get('id_token') || '';
  if (!idToken) {
    return { type: 'error', message: 'No se recibió el token de Google. Intenta de nuevo.' };
  }

  return { type: 'success', idToken };
}
