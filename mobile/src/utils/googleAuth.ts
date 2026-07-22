import Constants from 'expo-constants';
import * as AuthSession from 'expo-auth-session';
import * as Google from 'expo-auth-session/providers/google';
import * as WebBrowser from 'expo-web-browser';

WebBrowser.maybeCompleteAuthSession();

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

  return Google.useIdTokenAuthRequest({
    clientId: webClientId || undefined,
    webClientId: webClientId || undefined,
    iosClientId: iosClientId || undefined,
    androidClientId: androidClientId || undefined,
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
