import { createAudioPlayer, setAudioModeAsync, type AudioPlayer } from 'expo-audio';
import { Platform } from 'react-native';

import { colors } from '../theme/colors';
import { notificationSuccess } from '../utils/haptics';

/** Tono fuerte empaquetado en el build nativo (assets/sounds/alert.wav). */
export const NOTIFICATION_SOUND = 'alert.wav';

/**
 * IDs de canal con versión: Android cachea el sonido del canal.
 * Al cambiar el tono hay que subir el sufijo (_v2, _v3…) o los usuarios
 * seguirán oyendo el anterior hasta reinstalar / borrar datos.
 */
export const NOTIFICATION_CHANNELS = {
  orders: 'orders_v2',
  deliveries: 'deliveries_v2',
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
    // Más largo e insistente que el patrón anterior.
    vibrationPattern: [0, 400, 120, 400, 120, 500, 160, 500],
    lightColor: colors.primary,
    showBadge: true,
  };

  await Notifications.setNotificationChannelAsync(NOTIFICATION_CHANNELS.orders, {
    name: 'Pedidos',
    description: 'Avisos urgentes de pedidos nuevos y cambios de estado',
    importance: Notifications.AndroidImportance.MAX,
    ...channelBase,
  });

  await Notifications.setNotificationChannelAsync(NOTIFICATION_CHANNELS.deliveries, {
    name: 'Envíos y entregas',
    description: 'Avisos urgentes de envíos, repartidor y entregas',
    importance: Notifications.AndroidImportance.MAX,
    ...channelBase,
  });
}

const alertSource = require('../../assets/sounds/alert.wav');
let alertPlayer: AudioPlayer | null = null;
let alertPlaying = false;

async function playAlertSound(): Promise<void> {
  if (alertPlaying) return;
  alertPlaying = true;
  try {
    await setAudioModeAsync({
      playsInSilentMode: true,
    });
    if (!alertPlayer) {
      alertPlayer = createAudioPlayer(alertSource);
    } else {
      alertPlayer.seekTo(0);
    }
    alertPlayer.volume = 1;
    alertPlayer.play();
    setTimeout(() => {
      alertPlaying = false;
    }, 2000);
  } catch {
    alertPlaying = false;
  }
}

export async function onNotificationReceived(): Promise<void> {
  if (Platform.OS === 'web') return;
  await Promise.allSettled([
    notificationSuccess(),
    playAlertSound(),
  ]);
}
