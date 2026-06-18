import { useEffect } from 'react';
import { AppState, AppStateStatus } from 'react-native';

import { handleNotificationNavigation } from '../navigation/navigationRef';
import { supportsRemotePush } from '../utils/expoRuntime';

export function usePushNotifications(enabled: boolean) {
  useEffect(() => {
    if (!enabled || !supportsRemotePush()) return;

    let mounted = true;

    (async () => {
      if (!mounted) return;
      try {
        const { configureNotifications } = await import('../services/notificationsSetup');
        const { registerPushNotifications } = await import('../services/pushRegistration');
        await configureNotifications();
        await registerPushNotifications();
      } catch {
        // Push opcional — no debe tumbar la app
      }
    })();

    const onAppStateChange = (next: AppStateStatus) => {
      if (next === 'active' && mounted) {
        void import('../services/pushRegistration').then(({ registerPushNotifications }) =>
          registerPushNotifications(),
        );
      }
    };
    const appSub = AppState.addEventListener('change', onAppStateChange);

    return () => {
      mounted = false;
      appSub.remove();
    };
  }, [enabled]);

  useEffect(() => {
    if (!enabled || !supportsRemotePush()) return;

    let responseSub: { remove: () => void } | null = null;
    let receivedSub: { remove: () => void } | null = null;
    let cancelled = false;

    (async () => {
      try {
        const Notifications = await import('expo-notifications');
        const { onNotificationReceived } = await import('../services/notificationsSetup');

        if (cancelled) return;

        const last = await Notifications.getLastNotificationResponseAsync();
        if (last) {
          handleNotificationNavigation(
            last.notification.request.content.data as Record<string, unknown> | undefined,
          );
        }

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
    })();

    return () => {
      cancelled = true;
      responseSub?.remove();
      receivedSub?.remove();
    };
  }, [enabled]);
}
