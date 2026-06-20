import { useCallback, useEffect, useMemo, useState } from 'react';
import { InteractionManager } from 'react-native';

import { orderApi, shipmentApi } from '../services/api';
import type { OrderActiveSummary, ShipmentActiveSummary } from '../types';
import { formatOrderLabel } from '../utils/orderDisplay';

const ACTIVE_ORDER_STATUSES = ['pending', 'accepted', 'preparing', 'ready', 'on_the_way'] as const;
const ACTIVE_SHIPMENT_STATUSES = ['pending', 'picked_up', 'on_the_way'] as const;

export interface ActiveDeliveryItem {
  kind: 'order' | 'shipment';
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
    isLive: order.status === 'on_the_way',
    emoji: '🍽️',
  };
}

function mapShipmentToItem(shipment: ShipmentActiveSummary): ActiveDeliveryItem {
  return {
    kind: 'shipment',
    id: shipment.id,
    title: `Envío #${shipment.id}`,
    subtitle: shipment.description,
    status: shipment.status,
    statusDisplay: shipment.status_display,
    isLive: shipment.status === 'on_the_way',
    emoji: '📦',
  };
}

/** Una sola instancia por app — usar vía CustomerActiveDeliveriesProvider. */
export function useCustomerActiveDeliveriesState() {
  const [orders, setOrders] = useState<OrderActiveSummary[]>([]);
  const [shipments, setShipments] = useState<ShipmentActiveSummary[]>([]);
  const [refreshError, setRefreshError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [ordersRes, shipmentsRes] = await Promise.all([
        orderApi.active(),
        shipmentApi.active(),
      ]);
      setOrders(ordersRes.data);
      setShipments(shipmentsRes.data);
      setRefreshError(null);
    } catch {
      setRefreshError('No se pudo actualizar el estado de tus pedidos');
    }
  }, []);

  const activeOrders = useMemo(
    () => orders.filter((o) => ACTIVE_ORDER_STATUSES.includes(o.status as typeof ACTIVE_ORDER_STATUSES[number])),
    [orders],
  );

  const activeShipments = useMemo(
    () => shipments.filter((s) => ACTIVE_SHIPMENT_STATUSES.includes(s.status as typeof ACTIVE_SHIPMENT_STATUSES[number])),
    [shipments],
  );

  const liveItems = useMemo<ActiveDeliveryItem[]>(() => {
    const items: ActiveDeliveryItem[] = [];
    for (const order of activeOrders) {
      if (order.status !== 'on_the_way') continue;
      items.push({
        ...mapOrderToItem(order),
        subtitle: order.restaurant_name ?? 'En camino a tu domicilio',
        isLive: true,
      });
    }
    for (const shipment of activeShipments) {
      if (shipment.status !== 'on_the_way') continue;
      items.push({ ...mapShipmentToItem(shipment), isLive: true });
    }
    return items;
  }, [activeOrders, activeShipments]);

  const trackingItems = useMemo<ActiveDeliveryItem[]>(() => {
    const items = [
      ...activeOrders.map(mapOrderToItem),
      ...activeShipments.map(mapShipmentToItem),
    ];
    return items.sort((a, b) => Number(b.isLive) - Number(a.isLive));
  }, [activeOrders, activeShipments]);

  const hasLive = liveItems.length > 0;
  const pollMs = hasLive ? 12000 : 45000;

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
    activeShipmentCount: activeShipments.length,
    liveItems,
    trackingItems,
    refreshError,
    refresh: load,
  };
}
