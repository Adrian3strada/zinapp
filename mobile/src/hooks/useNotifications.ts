import * as Notifications from 'expo-notifications';
import { useEffect } from 'react';
import { AppState, AppStateStatus } from 'react-native';

import { handleNotificationNavigation } from '../navigation/navigationRef';
import {
  configureNotifications,
  onNotificationReceived,
} from '../services/notificationsSetup';
import { registerPushNotifications } from '../services/pushRegistration';

configureNotifications();

export function usePushNotifications(enabled: boolean) {
  useEffect(() => {
    if (!enabled) return;

    let mounted = true;

    (async () => {
      if (!mounted) return;
      try {
        await registerPushNotifications();
      } catch {
        // Push opcional — no debe tumbar la app
      }
    })();

    const onAppStateChange = (next: AppStateStatus) => {
      if (next === 'active' && mounted) {
        void registerPushNotifications();
      }
    };
    const appSub = AppState.addEventListener('change', onAppStateChange);

    return () => {
      mounted = false;
      appSub.remove();
    };
  }, [enabled]);

  useEffect(() => {
    if (!enabled) return;

    let responseSub: Notifications.Subscription | null = null;
    let receivedSub: Notifications.Subscription | null = null;

    (async () => {
      try {
        const last = await Notifications.getLastNotificationResponseAsync();
        if (last) {
          handleNotificationNavigation(
            last.notification.request.content.data as Record<string, unknown> | undefined,
          );
        }
      } catch {
        // ignorar
      }
    })();

    try {
      responseSub = Notifications.addNotificationResponseReceivedListener((response) => {
        handleNotificationNavigation(
          response.notification.request.content.data as Record<string, unknown> | undefined,
        );
      });

      receivedSub = Notifications.addNotificationReceivedListener(() => {
        void onNotificationReceived();
      });
    } catch {
      // ignorar
    }

    return () => {
      responseSub?.remove();
      receivedSub?.remove();
    };
  }, [enabled]);
}
