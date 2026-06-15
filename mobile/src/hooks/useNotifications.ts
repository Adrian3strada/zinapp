import Constants from 'expo-constants';
import * as Notifications from 'expo-notifications';
import { useEffect } from 'react';
import { Platform } from 'react-native';

import { handleNotificationNavigation } from '../navigation/navigationRef';
import { authApi } from '../services/api';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

function getExpoProjectId(): string | undefined {
  const extra = Constants.expoConfig?.extra as { eas?: { projectId?: string } } | undefined;
  return extra?.eas?.projectId ?? Constants.easConfig?.projectId;
}

export function usePushNotifications(enabled: boolean) {
  useEffect(() => {
    if (!enabled) return;

    let mounted = true;

    (async () => {
      const { status: existing } = await Notifications.getPermissionsAsync();
      let finalStatus = existing;
      if (existing !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }
      if (finalStatus !== 'granted' || !mounted) return;

      if (Platform.OS === 'android') {
        await Notifications.setNotificationChannelAsync('orders', {
          name: 'Pedidos',
          importance: Notifications.AndroidImportance.HIGH,
        });
        await Notifications.setNotificationChannelAsync('deliveries', {
          name: 'Envíos y entregas',
          importance: Notifications.AndroidImportance.HIGH,
        });
      }

      try {
        const projectId = getExpoProjectId();
        const token = await Notifications.getExpoPushTokenAsync(
          projectId ? { projectId } : undefined,
        );
        if (token.data && mounted) {
          await authApi.registerPushToken(token.data);
        }
      } catch {
        // Sin projectId EAS o Expo Go — ignorar en dev
      }
    })();

    return () => {
      mounted = false;
    };
  }, [enabled]);

  useEffect(() => {
    if (!enabled) return;

    (async () => {
      const last = await Notifications.getLastNotificationResponseAsync();
      if (last) {
        handleNotificationNavigation(
          last.notification.request.content.data as Record<string, unknown> | undefined,
        );
      }
    })();

    const responseSub = Notifications.addNotificationResponseReceivedListener((response) => {
      handleNotificationNavigation(
        response.notification.request.content.data as Record<string, unknown> | undefined,
      );
    });

    const receivedSub = Notifications.addNotificationReceivedListener((notification) => {
      const data = notification.request.content.data as Record<string, unknown> | undefined;
      if (data?.type === 'driver_nearby') {
        // Banner visible via setNotificationHandler; deep link on tap only
      }
    });

    return () => {
      responseSub.remove();
      receivedSub.remove();
    };
  }, [enabled]);
}
