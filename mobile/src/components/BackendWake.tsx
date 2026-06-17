import React, { useEffect, useRef } from 'react';
import { AppState, AppStateStatus } from 'react-native';

import { wakeBackend } from '../services/apiWake';

const KEEPALIVE_MS = 4 * 60 * 1000;

/** Mantiene el backend despierto al abrir la app y al volver del background. */
export default function BackendWake() {
  const appState = useRef<AppStateStatus>(AppState.currentState);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    void wakeBackend(true);

    const clearKeepalive = () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };

    const startKeepalive = () => {
      clearKeepalive();
      intervalRef.current = setInterval(() => {
        void wakeBackend(true);
      }, KEEPALIVE_MS);
    };

    const sub = AppState.addEventListener('change', (next) => {
      appState.current = next;
      if (next === 'active') {
        void wakeBackend(true);
        startKeepalive();
      } else {
        clearKeepalive();
      }
    });

    if (appState.current === 'active') {
      startKeepalive();
    }

    return () => {
      sub.remove();
      clearKeepalive();
    };
  }, []);

  return null;
}
