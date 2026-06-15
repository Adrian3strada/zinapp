import { useCallback, useEffect, useState } from 'react';

import { orderApi } from '../services/api';

export function useRestaurantPendingCount(pollMs = 12000) {
  const [count, setCount] = useState(0);

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

  return count;
}
