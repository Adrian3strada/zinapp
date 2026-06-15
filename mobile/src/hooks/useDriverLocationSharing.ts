import * as Location from 'expo-location';
import { useEffect, useRef } from 'react';
import { AppState, type AppStateStatus } from 'react-native';

import { deliveryApi } from '../services/api';

const IDLE_MIN_SEND_MS = 6000;
const ACTIVE_MIN_SEND_MS = 2000;
const BACKGROUND_SEND_MS = 25000;

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

  useEffect(() => {
    if (!active || !shareGps) {
      subscriptionRef.current?.remove();
      subscriptionRef.current = null;
      if (backgroundTimerRef.current) {
        clearInterval(backgroundTimerRef.current);
        backgroundTimerRef.current = null;
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

    const startBackgroundPing = () => {
      if (backgroundTimerRef.current) return;
      backgroundTimerRef.current = setInterval(async () => {
        const coords = lastCoordsRef.current;
        if (!coords) return;
        await sendLocation(coords.latitude, coords.longitude, true);
      }, BACKGROUND_SEND_MS);
    };

    const stopBackgroundPing = () => {
      if (backgroundTimerRef.current) {
        clearInterval(backgroundTimerRef.current);
        backgroundTimerRef.current = null;
      }
    };

    const startWatching = async () => {
      try {
        let { status } = await Location.getForegroundPermissionsAsync();
        if (status !== 'granted') {
          const req = await Location.requestForegroundPermissionsAsync();
          status = req.status;
        }
        if (status !== 'granted' || cancelled) return;

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
        startBackgroundPing();
      }
      if (nextState === 'active') {
        stopBackgroundPing();
      }
    });

    return () => {
      cancelled = true;
      appSub.remove();
      stopBackgroundPing();
      subscriptionRef.current?.remove();
      subscriptionRef.current = null;
      lastCoordsRef.current = null;
    };
  }, [active, hasActiveDelivery, shareGps]);
}
