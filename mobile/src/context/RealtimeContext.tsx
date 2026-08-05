import React, { createContext, useContext, useEffect, useMemo, useRef } from 'react';

import { useAuth } from './AuthContext';
import { realtimeClient, type RealtimeEventType, type RealtimeHandler } from '../services/realtime';

type RealtimeContextValue = {
  connected: boolean;
  subscribeOrder: (orderId: number) => void;
  unsubscribeOrder: (orderId: number) => void;
  subscribeShipment: (shipmentId: number) => void;
  unsubscribeShipment: (shipmentId: number) => void;
  subscribeRestaurant: (restaurantId: number) => void;
  unsubscribeRestaurant: (restaurantId: number) => void;
  setDriverAvailable: (available: boolean) => void;
  on: (type: RealtimeEventType | '*', handler: RealtimeHandler) => () => void;
};

const RealtimeContext = createContext<RealtimeContextValue | undefined>(undefined);

export function RealtimeProvider({ children }: { children: React.ReactNode }) {
  const { user, isGuest } = useAuth();
  const activeUserIdRef = useRef<number | null>(null);

  useEffect(() => {
    const nextId = user && !isGuest ? user.id : null;
    const prevId = activeUserIdRef.current;

    // Cambio de cuenta o logout: cortar siempre la sesión WS anterior.
    if (prevId != null && prevId !== nextId) {
      realtimeClient.stop();
    }

    if (nextId == null) {
      activeUserIdRef.current = null;
      realtimeClient.stop();
      return;
    }

    activeUserIdRef.current = nextId;
    void realtimeClient.start();

    return () => {
      // Cleanup del effect (incluye cambio rápido de user.id).
      realtimeClient.stop();
      if (activeUserIdRef.current === nextId) {
        activeUserIdRef.current = null;
      }
    };
  }, [user?.id, isGuest]);

  const value = useMemo<RealtimeContextValue>(
    () => ({
      connected: realtimeClient.isConnected(),
      subscribeOrder: (orderId) => realtimeClient.subscribe({ orderId }),
      unsubscribeOrder: (orderId) => realtimeClient.unsubscribe({ orderId }),
      subscribeShipment: (shipmentId) => realtimeClient.subscribe({ shipmentId }),
      unsubscribeShipment: (shipmentId) => realtimeClient.unsubscribe({ shipmentId }),
      subscribeRestaurant: (restaurantId) => realtimeClient.subscribe({ restaurantId }),
      unsubscribeRestaurant: (restaurantId) => realtimeClient.unsubscribe({ restaurantId }),
      setDriverAvailable: (available) => realtimeClient.setDriverAvailable(available),
      on: (type, handler) => realtimeClient.on(type, handler),
    }),
    [user?.id],
  );

  return <RealtimeContext.Provider value={value}>{children}</RealtimeContext.Provider>;
}

export function useRealtime(): RealtimeContextValue {
  const ctx = useContext(RealtimeContext);
  if (!ctx) {
    throw new Error('useRealtime must be used within RealtimeProvider');
  }
  return ctx;
}

/** Safe variant for screens that may render outside provider during boot. */
export function useRealtimeOptional(): RealtimeContextValue | null {
  return useContext(RealtimeContext) ?? null;
}
