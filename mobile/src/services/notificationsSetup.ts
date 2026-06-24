import { createAudioPlayer, setAudioModeAsync, type AudioPlayer } from 'expo-audio';
import { Platform } from 'react-native';

import { colors } from '../theme/colors';
import { notificationSuccess } from '../utils/haptics';

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
export async function configureNotifications(): Promise<void> {
  if (Platform.OS === 'web') return;

  const Notifications = await import('expo-notifications');
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

  const Notifications = await import('expo-notifications');

  const channelBase = {
    sound: NOTIFICATION_SOUND,
    enableVibrate: true,
    vibrationPattern: [0, 280, 120, 280],
    lightColor: colors.primary,
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

const bellSource = require('../../assets/sounds/bell.wav');
let bellPlayer: AudioPlayer | null = null;
let bellPlaying = false;

async function playBellSound(): Promise<void> {
  if (bellPlaying) return;
  bellPlaying = true;
  try {
    await setAudioModeAsync({
      playsInSilentMode: true,
    });
    if (!bellPlayer) {
      bellPlayer = createAudioPlayer(bellSource);
    } else {
      bellPlayer.seekTo(0);
    }
    bellPlayer.play();
    setTimeout(() => {
      bellPlaying = false;
    }, 1200);
  } catch {
    bellPlaying = false;
  }
}

export async function onNotificationReceived(): Promise<void> {
  if (Platform.OS === 'web') return;
  await Promise.allSettled([
    notificationSuccess(),
    playBellSound(),
  ]);
}
