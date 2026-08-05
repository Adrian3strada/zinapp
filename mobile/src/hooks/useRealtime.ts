import { useEffect } from 'react';

import { useRealtimeOptional } from '../context/RealtimeContext';
import type { RealtimeEventType, RealtimeHandler } from '../services/realtime';

export function useRealtimeEvent(
  type: RealtimeEventType | '*',
  handler: RealtimeHandler,
  enabled = true,
): void {
  const rt = useRealtimeOptional();
  useEffect(() => {
    if (!enabled || !rt) return;
    return rt.on(type, handler);
  }, [rt, type, handler, enabled]);
}

export function useRealtimeOrder(orderId: number | null | undefined, enabled = true): void {
  const rt = useRealtimeOptional();
  useEffect(() => {
    if (!enabled || !rt || orderId == null) return;
    rt.subscribeOrder(orderId);
    return () => rt.unsubscribeOrder(orderId);
  }, [rt, orderId, enabled]);
}

export function useRealtimeShipment(shipmentId: number | null | undefined, enabled = true): void {
  const rt = useRealtimeOptional();
  useEffect(() => {
    if (!enabled || !rt || shipmentId == null) return;
    rt.subscribeShipment(shipmentId);
    return () => rt.unsubscribeShipment(shipmentId);
  }, [rt, shipmentId, enabled]);
}

export function useRealtimeRestaurant(restaurantId: number | null | undefined, enabled = true): void {
  const rt = useRealtimeOptional();
  useEffect(() => {
    if (!enabled || !rt || restaurantId == null) return;
    rt.subscribeRestaurant(restaurantId);
    return () => rt.unsubscribeRestaurant(restaurantId);
  }, [rt, restaurantId, enabled]);
}

export { useRealtimeOptional as useRealtime };
