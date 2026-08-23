import Constants from 'expo-constants';
import { Platform } from 'react-native';

import { supportsRemotePush } from '../utils/expoRuntime';
import { authApi } from './api';
import { setupNotificationChannels } from './notificationsSetup';

const PUSH_LOG = '[PUSH]';

function getExpoProjectId(): string | undefined {
  const extra = Constants.expoConfig?.extra as { eas?: { projectId?: string } } | undefined;
  return extra?.eas?.projectId ?? Constants.easConfig?.projectId;
}

/** Token parcial para logs (sin volcar el valor completo). */
function maskExpoToken(token: string): string {
  if (!token) return '(empty)';
  if (token.length <= 28) return `${token.slice(0, 18)}…`;
  return `${token.slice(0, 22)}…${token.slice(-6)}`;
}

/** Pide permiso, obtiene token Expo y lo registra en el backend. */
export async function registerPushNotifications(): Promise<boolean> {
  const device = Platform.OS === 'android' ? 'Android' : Platform.OS === 'ios' ? 'iOS' : Platform.OS;
  console.log(`${PUSH_LOG} Device: ${device}`);

  if (!supportsRemotePush()) {
    console.log(`${PUSH_LOG} Remote push unsupported (web/Expo Go) — skip`);
    return false;
  }

  try {
    const Notifications = await import('expo-notifications');

    const { status: existing } = await Notifications.getPermissionsAsync();
    let finalStatus = existing;
    if (existing !== 'granted') {
      console.log(`${PUSH_LOG} ${device} notification permission: ${existing} — requesting`);
      const { status } = await Notifications.requestPermissionsAsync({
        ios: {
          allowAlert: true,
          allowBadge: true,
          allowSound: true,
        },
      });
      finalStatus = status;
    }
    console.log(`${PUSH_LOG} ${device} notification permission: ${finalStatus}`);
    if (finalStatus !== 'granted') {
      console.log(`${PUSH_LOG} Permission denied — token not registered`);
      return false;
    }

    await setupNotificationChannels();
    if (Platform.OS === 'android') {
      console.log(`${PUSH_LOG} Android notification channels configured (orders_v3, deliveries_v3)`);
    }

    const projectId = getExpoProjectId();
    if (!projectId) {
      console.warn(`${PUSH_LOG} Missing Expo projectId — getExpoPushTokenAsync may fail`);
    }

    const token = await Notifications.getExpoPushTokenAsync(
      projectId ? { projectId } : undefined,
    );
    if (!token.data) {
      console.warn(`${PUSH_LOG} Expo token empty after getExpoPushTokenAsync`);
      return false;
    }

    console.log(`${PUSH_LOG} Expo token generated: ${maskExpoToken(token.data)}`);
    await authApi.registerPushToken(token.data);
    console.log(`${PUSH_LOG} Token sent to backend`);
    return true;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.warn(`${PUSH_LOG} Registration failed: ${message}`);
    return false;
  }
}

/** Quita el token del usuario actual (al cerrar sesión). */
export async function clearPushToken(): Promise<void> {
  try {
    await authApi.registerPushToken('');
    console.log(`${PUSH_LOG} Token cleared on backend (logout)`);
  } catch {
    console.warn(`${PUSH_LOG} Token clear skipped (session expired or offline)`);
  }
}
