import Constants from 'expo-constants';
import { Platform } from 'react-native';
import type { AuthRequest } from 'expo-auth-session';
import * as AuthSession from 'expo-auth-session';
import * as Google from 'expo-auth-session/providers/google';
import * as WebBrowser from 'expo-web-browser';

if (Platform.OS === 'web') {
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

export function getGoogleIosClientId(): string {
  return (
    process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID
    || googleExtra().googleIosClientId
    || ''
  ).trim();
}

export function getGoogleAndroidClientId(): string {
  return (
    process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID
    || googleExtra().googleAndroidClientId
    || ''
  ).trim();
}

/** Web: Client ID web. Nativo: web + iOS/Android según plataforma. */
export function isGoogleSignInConfigured(): boolean {
  const web = getGoogleWebClientId();
  if (!web) return false;
  if (Platform.OS === 'ios') return Boolean(getGoogleIosClientId());
  // Android nativo usa Play Services + webClientId (idToken); el client Android (SHA) vive en Google Cloud.
  if (Platform.OS === 'android') return true;
  return true;
}

/**
 * Solo web: Expo Linking usa el origin y Google debe volver a /app.
 * Un Client ID web + zinapp:// = Error 400.
 */
export function getGoogleRedirectUri(): string | undefined {
  if (Platform.OS !== 'web' || typeof window === 'undefined') {
    return undefined;
  }

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

/**
 * Hook AuthSession (web). En nativo el botón usa signInWithGoogleNative;
 * igual pasamos client IDs para que el hook no falle por Rules of Hooks.
 */
export function useGoogleIdTokenRequest() {
  const webClientId = getGoogleWebClientId();
  const iosClientId = getGoogleIosClientId();
  const androidClientId = getGoogleAndroidClientId() || webClientId;
  const redirectUri = getGoogleRedirectUri();

  return Google.useIdTokenAuthRequest({
    webClientId: webClientId || undefined,
    iosClientId: iosClientId || undefined,
    androidClientId: androidClientId || undefined,
    ...(redirectUri ? { redirectUri } : {}),
  });
}

let nativeConfigured = false;

function ensureNativeGoogleConfigured(): void {
  if (nativeConfigured || Platform.OS === 'web') return;
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { GoogleSignin } = require('@react-native-google-signin/google-signin') as typeof import('@react-native-google-signin/google-signin');
  GoogleSignin.configure({
    webClientId: getGoogleWebClientId(),
    iosClientId: getGoogleIosClientId() || undefined,
    offlineAccess: false,
  });
  nativeConfigured = true;
}

/**
 * Login nativo (Android/iOS) con Play Services / Google Sign-In SDK.
 * Evita el Error 400 invalid_request del flujo AuthSession en Custom Tabs.
 */
export async function signInWithGoogleNative(): Promise<string> {
  if (Platform.OS === 'web') {
    throw new Error('signInWithGoogleNative no aplica en web');
  }
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const {
    GoogleSignin,
    isSuccessResponse,
    isCancelledResponse,
    statusCodes,
    isErrorWithCode,
  } = require('@react-native-google-signin/google-signin') as typeof import('@react-native-google-signin/google-signin');

  ensureNativeGoogleConfigured();
  await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });

  try {
    const response = await GoogleSignin.signIn();
    if (isCancelledResponse(response)) {
      throw new Error('CANCELLED');
    }
    if (!isSuccessResponse(response)) {
      throw new Error('No se pudo completar el inicio con Google.');
    }
    let idToken = response.data.idToken;
    if (!idToken) {
      const tokens = await GoogleSignin.getTokens();
      idToken = tokens.idToken;
    }
    if (!idToken) {
      throw new Error('No se recibió el token de Google. Intenta de nuevo.');
    }
    return idToken;
  } catch (err) {
    if (err instanceof Error && err.message === 'CANCELLED') {
      throw err;
    }
    if (isErrorWithCode(err) && err.code === statusCodes.SIGN_IN_CANCELLED) {
      throw new Error('CANCELLED');
    }
    if (isErrorWithCode(err) && err.code === statusCodes.IN_PROGRESS) {
      throw new Error('Ya hay un inicio de sesión con Google en curso.');
    }
    if (isErrorWithCode(err) && err.code === statusCodes.PLAY_SERVICES_NOT_AVAILABLE) {
      throw new Error('Google Play Services no está disponible en este dispositivo.');
    }
    throw err instanceof Error ? err : new Error('No se pudo iniciar sesión con Google.');
  }
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
