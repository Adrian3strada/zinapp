import { useCallback, useEffect, useMemo, useState } from 'react';
import { InteractionManager } from 'react-native';

import { orderApi } from '../services/api';
import type { OrderActiveSummary } from '../types';
import { formatOrderLabel } from '../utils/orderDisplay';

const ACTIVE_ORDER_STATUSES = ['pending', 'accepted', 'preparing', 'ready', 'on_the_way'] as const;

export interface ActiveDeliveryItem {
  kind: 'order';
  id: number;
  title: string;
  subtitle: string;
  status: string;
  statusDisplay: string;
  isLive: boolean;
  emoji: string;
}

function mapOrderToItem(order: OrderActiveSummary): ActiveDeliveryItem {
  return {
    kind: 'order',
    id: order.id,
    title: formatOrderLabel(order),
    subtitle: order.restaurant_name ?? order.delivery_address,
    status: order.status,
    statusDisplay: order.status_display,
    isLive:
      order.status === 'on_the_way'
      || (order.status === 'ready' && !!order.driver_latitude && !!order.driver_longitude),
    emoji: '🍽️',
  };
}

/** Una sola instancia por app — usar vía CustomerActiveDeliveriesProvider. */
export function useCustomerActiveDeliveriesState() {
  const [orders, setOrders] = useState<OrderActiveSummary[]>([]);
  const [refreshError, setRefreshError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const ordersRes = await orderApi.active();
      setOrders(ordersRes.data);
      setRefreshError(null);
    } catch {
      setRefreshError('No se pudo actualizar el estado de tus pedidos');
    }
  }, []);

  const activeOrders = useMemo(
    () => orders.filter((o) => ACTIVE_ORDER_STATUSES.includes(o.status as typeof ACTIVE_ORDER_STATUSES[number])),
    [orders],
  );

  const liveItems = useMemo<ActiveDeliveryItem[]>(() => {
    const items: ActiveDeliveryItem[] = [];
    for (const order of activeOrders) {
      if (order.status !== 'on_the_way' && order.status !== 'ready') continue;
      if (order.status === 'ready' && (!order.driver_latitude || !order.driver_longitude)) continue;
      items.push({
        ...mapOrderToItem(order),
        subtitle:
          order.status === 'on_the_way'
            ? (order.restaurant_name ?? 'En camino a tu domicilio')
            : 'Repartidor en camino al restaurante',
        isLive: true,
      });
    }
    return items;
  }, [activeOrders]);

  const trackingItems = useMemo<ActiveDeliveryItem[]>(
    () => activeOrders.map(mapOrderToItem).sort((a, b) => Number(b.isLive) - Number(a.isLive)),
    [activeOrders],
  );

  const hasLiveTracking = useMemo(() => {
    return activeOrders.some(
      (o) =>
        o.status === 'on_the_way'
        || (o.status === 'ready' && o.driver_latitude && o.driver_longitude),
    );
  }, [activeOrders]);

  const pollMs = hasLiveTracking ? 3000 : 45000;

  useEffect(() => {
    let cancelled = false;
    let interval: ReturnType<typeof setInterval> | null = null;

    const task = InteractionManager.runAfterInteractions(() => {
      if (cancelled) return;
      load();
      interval = setInterval(load, pollMs);
    });

    return () => {
      cancelled = true;
      task.cancel();
      if (interval) clearInterval(interval);
    };
  }, [load, pollMs]);

  return {
    activeOrderCount: activeOrders.length,
    liveItems,
    trackingItems,
    refreshError,
    refresh: load,
  };
}
