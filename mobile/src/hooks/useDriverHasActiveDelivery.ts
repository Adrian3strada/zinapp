import { useCallback, useEffect, useState } from 'react';

import { orderApi } from '../services/api';
import type { Order } from '../types';

const ACTIVE_ORDER_STATUSES: Order['status'][] = [
  'accepted',
  'preparing',
  'ready',
  'on_the_way',
];

function pickActiveOrder(orders: Order[]): Order | null {
  const active = orders
    .filter((order) => ACTIVE_ORDER_STATUSES.includes(order.status))
    .sort((a, b) => b.updated_at.localeCompare(a.updated_at));
  return active[0] ?? null;
}

export function useDriverActiveDeliveries(pollMs = 5000) {
  const [activeCount, setActiveCount] = useState(0);
  const [hasActiveDelivery, setHasActiveDelivery] = useState(false);
  const [activeOrder, setActiveOrder] = useState<Order | null>(null);

  const check = useCallback(async () => {
    try {
      const { data } = await orderApi.myDeliveries();
      const active = pickActiveOrder(data);
      const count = data.filter((order) =>
        ACTIVE_ORDER_STATUSES.includes(order.status),
      ).length;
      setActiveOrder(active);
      setActiveCount(count);
      setHasActiveDelivery(count > 0);
    } catch {
      // Mantener último valor conocido si falla la red
    }
  }, []);

  useEffect(() => {
    check();
    const interval = setInterval(check, pollMs);
    return () => clearInterval(interval);
  }, [check, pollMs]);

  return { hasActiveDelivery, activeCount, activeOrder, refreshActive: check };
}

/** @deprecated use useDriverActiveDeliveries */
export function useDriverHasActiveDelivery(pollMs = 5000) {
  const { hasActiveDelivery } = useDriverActiveDeliveries(pollMs);
  return hasActiveDelivery;
}
