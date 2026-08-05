import { useCallback, useEffect, useState } from 'react';

import { useRealtimeEvent, useRealtimeRestaurant } from './useRealtime';
import { useOptionalRestaurantContext } from '../context/RestaurantContext';
import { orderApi } from '../services/api';

export function useRestaurantPendingCount(pollMs = 45000) {
  const [count, setCount] = useState(0);
  const restaurantCtx = useOptionalRestaurantContext();
  const restaurantId = restaurantCtx?.restaurant?.id;

  const refresh = useCallback(async () => {
    try {
      const { data } = await orderApi.restaurantPending();
      setCount(data.length);
    } catch {
      setCount(0);
    }
  }, []);

  useEffect(() => {
    refresh();
    const interval = setInterval(refresh, pollMs);
    return () => clearInterval(interval);
  }, [refresh, pollMs]);

  useRealtimeRestaurant(restaurantId, !!restaurantId);
  useRealtimeEvent(
    'restaurant.orders',
    useCallback(() => {
      void refresh();
    }, [refresh]),
    !!restaurantId,
  );
  useRealtimeEvent(
    'order.updated',
    useCallback(() => {
      void refresh();
    }, [refresh]),
    !!restaurantId,
  );

  return count;
}
