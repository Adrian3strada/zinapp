import Constants from 'expo-constants';
import * as Notifications from 'expo-notifications';

import { authApi } from './api';
import { setupNotificationChannels } from './notificationsSetup';

function getExpoProjectId(): string | undefined {
  const extra = Constants.expoConfig?.extra as { eas?: { projectId?: string } } | undefined;
  return extra?.eas?.projectId ?? Constants.easConfig?.projectId;
}

/** Pide permiso, obtiene token Expo y lo registra en el backend. */
export async function registerPushNotifications(): Promise<boolean> {
  const { status: existing } = await Notifications.getPermissionsAsync();
  let finalStatus = existing;
  if (existing !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync({
      ios: {
        allowAlert: true,
        allowBadge: true,
        allowSound: true,
      },
    });
    finalStatus = status;
  }
  if (finalStatus !== 'granted') return false;

  await setupNotificationChannels();

  const projectId = getExpoProjectId();
  const token = await Notifications.getExpoPushTokenAsync(
    projectId ? { projectId } : undefined,
  );
  if (token.data) {
    await authApi.registerPushToken(token.data);
    return true;
  }
  return false;
}

/** Quita el token del usuario actual (al cerrar sesión). */
export async function clearPushToken(): Promise<void> {
  try {
    await authApi.registerPushToken('');
  } catch {
    // Sesión ya expirada o sin red
  }
}
