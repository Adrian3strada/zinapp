import * as Location from 'expo-location';
import { Platform } from 'react-native';
import { useEffect, useRef } from 'react';
import { AppState, type AppStateStatus } from 'react-native';

import { deliveryApi } from '../services/api';
import { DRIVER_LOCATION_TASK } from '../tasks/driverLocationTask';

const IDLE_MIN_SEND_MS = 6000;
const ACTIVE_MIN_SEND_MS = 2000;
const BACKGROUND_FETCH_MS = 20000;

export function useDriverLocationSharing(
  active: boolean,
  hasActiveDelivery = false,
  shareGps = true,
) {
  const subscriptionRef = useRef<Location.LocationSubscription | null>(null);
  const backgroundTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastSentRef = useRef(0);
  const lastCoordsRef = useRef<{ latitude: number; longitude: number } | null>(null);
  const appStateRef = useRef<AppStateStatus>(AppState.currentState);
  const backgroundUpdatesActiveRef = useRef(false);

  useEffect(() => {
    if (!active || !shareGps) {
      subscriptionRef.current?.remove();
      subscriptionRef.current = null;
      if (backgroundTimerRef.current) {
        clearInterval(backgroundTimerRef.current);
        backgroundTimerRef.current = null;
      }
      if (Platform.OS !== 'web' && backgroundUpdatesActiveRef.current) {
        void Location.stopLocationUpdatesAsync(DRIVER_LOCATION_TASK).catch(() => {});
        backgroundUpdatesActiveRef.current = false;
      }
      return;
    }

    let cancelled = false;
    const minSendMs = hasActiveDelivery ? ACTIVE_MIN_SEND_MS : IDLE_MIN_SEND_MS;
    const watchOptions: Location.LocationOptions = hasActiveDelivery
      ? {
          accuracy: Location.Accuracy.BestForNavigation,
          timeInterval: 2000,
          distanceInterval: 3,
        }
      : {
          accuracy: Location.Accuracy.High,
          timeInterval: 6000,
          distanceInterval: 12,
        };

    const sendLocation = async (latitude: number, longitude: number, force = false) => {
      const now = Date.now();
      const last = lastCoordsRef.current;
      const movedEnough =
        !last
        || Math.abs(last.latitude - latitude) >= 0.00003
        || Math.abs(last.longitude - longitude) >= 0.00003;

      if (!force && !movedEnough && now - lastSentRef.current < minSendMs) return;
      if (!force && now - lastSentRef.current < minSendMs) return;

      lastSentRef.current = now;
      lastCoordsRef.current = { latitude, longitude };

      try {
        await deliveryApi.updateLocation(latitude, longitude);
      } catch {
        // Silencioso: el repartidor puede seguir sin red momentánea
      }
    };

    const fetchAndSend = async (force = false) => {
      try {
        const position = await Location.getCurrentPositionAsync({
          accuracy: hasActiveDelivery
            ? Location.Accuracy.BestForNavigation
            : Location.Accuracy.High,
        });
        await sendLocation(position.coords.latitude, position.coords.longitude, force);
      } catch {
        const coords = lastCoordsRef.current;
        if (coords) await sendLocation(coords.latitude, coords.longitude, force);
      }
    };

    const startBackgroundPing = () => {
      if (backgroundTimerRef.current) return;
      backgroundTimerRef.current = setInterval(() => {
        void fetchAndSend(true);
      }, BACKGROUND_FETCH_MS);
    };

    const stopBackgroundPing = () => {
      if (backgroundTimerRef.current) {
        clearInterval(backgroundTimerRef.current);
        backgroundTimerRef.current = null;
      }
    };

    const startBackgroundUpdates = async () => {
      if (Platform.OS === 'web' || !hasActiveDelivery || backgroundUpdatesActiveRef.current) return;

      try {
        const bg = await Location.requestBackgroundPermissionsAsync();
        if (bg.status !== 'granted') return;

        const started = await Location.hasStartedLocationUpdatesAsync(DRIVER_LOCATION_TASK);
        if (!started) {
          await Location.startLocationUpdatesAsync(DRIVER_LOCATION_TASK, {
            accuracy: Location.Accuracy.BestForNavigation,
            timeInterval: 15000,
            distanceInterval: 8,
            showsBackgroundLocationIndicator: true,
            foregroundService: {
              notificationTitle: 'ZinApp repartidor',
              notificationBody: 'Compartiendo ubicación durante la entrega.',
              notificationColor: '#1E5DB8',
            },
          });
        }
        backgroundUpdatesActiveRef.current = true;
      } catch {
        // Fallback al ping periódico en AppState
      }
    };

    const stopBackgroundUpdates = async () => {
      if (Platform.OS === 'web' || !backgroundUpdatesActiveRef.current) return;
      try {
        const started = await Location.hasStartedLocationUpdatesAsync(DRIVER_LOCATION_TASK);
        if (started) await Location.stopLocationUpdatesAsync(DRIVER_LOCATION_TASK);
      } catch {
        // ignore
      }
      backgroundUpdatesActiveRef.current = false;
    };

    const startWatching = async () => {
      try {
        let { status } = await Location.getForegroundPermissionsAsync();
        if (status !== 'granted') {
          const req = await Location.requestForegroundPermissionsAsync();
          status = req.status;
        }
        if (status !== 'granted' || cancelled) return;

        if (hasActiveDelivery) {
          await startBackgroundUpdates();
        } else {
          await stopBackgroundUpdates();
        }

        const initial = await Location.getCurrentPositionAsync({
          accuracy: hasActiveDelivery
            ? Location.Accuracy.BestForNavigation
            : Location.Accuracy.High,
        });
        await sendLocation(initial.coords.latitude, initial.coords.longitude, true);

        subscriptionRef.current = await Location.watchPositionAsync(
          watchOptions,
          (position) => {
            sendLocation(position.coords.latitude, position.coords.longitude);
          },
        );
      } catch {
        // GPS no disponible temporalmente
      }
    };

    startWatching();

    const appSub = AppState.addEventListener('change', (nextState) => {
      const prev = appStateRef.current;
      appStateRef.current = nextState;
      if (prev === 'active' && nextState.match(/inactive|background/)) {
        if (!backgroundUpdatesActiveRef.current) startBackgroundPing();
      }
      if (nextState === 'active') {
        stopBackgroundPing();
      }
    });

    return () => {
      cancelled = true;
      appSub.remove();
      stopBackgroundPing();
      void stopBackgroundUpdates();
      subscriptionRef.current?.remove();
      subscriptionRef.current = null;
      lastCoordsRef.current = null;
    };
  }, [active, hasActiveDelivery, shareGps]);
}
