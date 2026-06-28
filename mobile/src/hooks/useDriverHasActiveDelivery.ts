import { useCallback, useEffect, useState } from 'react';

import { orderApi, shipmentApi } from '../services/api';
import type { Order } from '../types';

const ACTIVE_ORDER_STATUSES: Order['status'][] = [
  'accepted',
  'preparing',
  'ready',
  'on_the_way',
];

const ACTIVE_SHIPMENT_STATUSES = ['picked_up', 'on_the_way'] as const;

export function useDriverActiveDeliveries(pollMs = 5000) {
  const [activeCount, setActiveCount] = useState(0);
  const [hasActiveDelivery, setHasActiveDelivery] = useState(false);

  const check = useCallback(async () => {
    try {
      const [ordersRes, shipmentsRes] = await Promise.all([
        orderApi.myDeliveries(),
        shipmentApi.myDeliveries(),
      ]);
      const orderCount = ordersRes.data.filter((order) =>
        ACTIVE_ORDER_STATUSES.includes(order.status),
      ).length;
      const shipmentCount = shipmentsRes.data.filter((shipment) =>
        ACTIVE_SHIPMENT_STATUSES.includes(
          shipment.status as typeof ACTIVE_SHIPMENT_STATUSES[number],
        ),
      ).length;
      const count = orderCount + shipmentCount;
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

  return { hasActiveDelivery, activeCount };
}

/** @deprecated use useDriverActiveDeliveries */
export function useDriverHasActiveDelivery(pollMs = 5000) {
  const { hasActiveDelivery } = useDriverActiveDeliveries(pollMs);
  return hasActiveDelivery;
}
