import { useCallback, useEffect, useState } from 'react';

import { useOnAppActive } from './useOnAppActive';
import { useRealtimeEvent } from './useRealtime';
import { orderApi, shipmentApi } from '../services/api';
import type { Order, Shipment } from '../types';

const ACTIVE_ORDER_STATUSES: Order['status'][] = [
  'accepted',
  'preparing',
  'ready',
  'on_the_way',
];

const ACTIVE_SHIPMENT_STATUSES: Shipment['status'][] = ['picked_up', 'on_the_way'];

function pickActiveOrder(orders: Order[]): Order | null {
  const active = orders
    .filter((order) => ACTIVE_ORDER_STATUSES.includes(order.status))
    .sort((a, b) => b.updated_at.localeCompare(a.updated_at));
  return active[0] ?? null;
}

function pickActiveShipment(shipments: Shipment[]): Shipment | null {
  const active = shipments
    .filter((s) => ACTIVE_SHIPMENT_STATUSES.includes(s.status))
    .sort((a, b) => b.updated_at.localeCompare(a.updated_at));
  return active[0] ?? null;
}

export function useDriverActiveDeliveries(pollMs = 20000) {
  const [activeCount, setActiveCount] = useState(0);
  const [hasActiveDelivery, setHasActiveDelivery] = useState(false);
  const [activeOrder, setActiveOrder] = useState<Order | null>(null);
  const [activeShipment, setActiveShipment] = useState<Shipment | null>(null);

  const check = useCallback(async () => {
    try {
      const [ordersRes, shipmentsRes] = await Promise.all([
        orderApi.myDeliveries(),
        shipmentApi.myDeliveries(),
      ]);
      const order = pickActiveOrder(ordersRes.data);
      const shipment = pickActiveShipment(shipmentsRes.data);
      const orderCount = ordersRes.data.filter((o) =>
        ACTIVE_ORDER_STATUSES.includes(o.status),
      ).length;
      const shipmentCount = shipmentsRes.data.filter((s) =>
        ACTIVE_SHIPMENT_STATUSES.includes(s.status),
      ).length;
      const count = orderCount + shipmentCount;
      // Prefer order map flow if both somehow active (backend should prevent).
      setActiveOrder(order);
      setActiveShipment(order ? null : shipment);
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

  useOnAppActive(() => {
    void check();
  });

  useRealtimeEvent(
    'connected',
    useCallback(() => {
      void check();
    }, [check]),
  );

  useRealtimeEvent(
    'order.updated',
    useCallback(() => {
      void check();
    }, [check]),
  );
  useRealtimeEvent(
    'shipment.updated',
    useCallback(() => {
      void check();
    }, [check]),
  );
  useRealtimeEvent(
    'drivers.job',
    useCallback(() => {
      void check();
    }, [check]),
  );

  return {
    hasActiveDelivery,
    activeCount,
    activeOrder,
    activeShipment,
    refreshActive: check,
  };
}

/** @deprecated use useDriverActiveDeliveries */
export function useDriverHasActiveDelivery(pollMs = 20000) {
  const { hasActiveDelivery } = useDriverActiveDeliveries(pollMs);
  return hasActiveDelivery;
}
