import { Audio } from 'expo-av';
import * as Haptics from 'expo-haptics';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

/** Nombre del tono empaquetado en el APK (assets/sounds/bell.wav). */
export const NOTIFICATION_SOUND = 'bell.wav';

export const NOTIFICATION_CHANNELS = {
  orders: 'orders',
  deliveries: 'deliveries',
} as const;

export function resolveNotificationChannel(
  data?: Record<string, unknown> | null,
): string {
  if (data?.shipmentId != null || data?.type === 'shipment') {
    return NOTIFICATION_CHANNELS.deliveries;
  }
  return NOTIFICATION_CHANNELS.orders;
}

/** Configura handler y canales Android (sonido + vibración). */
export function configureNotifications(): void {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
      shouldShowBanner: true,
      shouldShowList: true,
    }),
  });
}

export async function setupNotificationChannels(): Promise<void> {
  if (Platform.OS !== 'android') return;

  const channelBase = {
    sound: NOTIFICATION_SOUND,
    enableVibrate: true,
    vibrationPattern: [0, 280, 120, 280],
    lightColor: '#1E5DB8',
    showBadge: true,
  };

  await Notifications.setNotificationChannelAsync(NOTIFICATION_CHANNELS.orders, {
    name: 'Pedidos',
    description: 'Estado de pedidos y avisos del restaurante',
    importance: Notifications.AndroidImportance.MAX,
    ...channelBase,
  });

  await Notifications.setNotificationChannelAsync(NOTIFICATION_CHANNELS.deliveries, {
    name: 'Envíos y entregas',
    description: 'Envíos, repartidor en camino y entregas',
    importance: Notifications.AndroidImportance.MAX,
    ...channelBase,
  });
}

let bellPlaying = false;

async function playBellSound(): Promise<void> {
  if (bellPlaying) return;
  bellPlaying = true;
  try {
    await Audio.setAudioModeAsync({
      playsInSilentModeIOS: true,
      shouldDuckAndroid: true,
    });
    const { sound } = await Audio.Sound.createAsync(
      require('../../assets/sounds/bell.wav'),
      { shouldPlay: true, volume: 1 },
    );
    sound.setOnPlaybackStatusUpdate((status) => {
      if (status.isLoaded && status.didJustFinish) {
        void sound.unloadAsync();
        bellPlaying = false;
      }
    });
  } catch {
    bellPlaying = false;
  }
}

export async function onNotificationReceived(): Promise<void> {
  await Promise.allSettled([
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success),
    playBellSound(),
  ]);
}
