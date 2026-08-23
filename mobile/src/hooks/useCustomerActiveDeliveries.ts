import { useCallback, useEffect, useMemo, useState } from 'react';
import { InteractionManager } from 'react-native';

import { useRealtimeEvent } from './useRealtime';
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
    isLive:
      order.status === 'on_the_way'
      || (order.status === 'ready' && !!order.driver_latitude && !!order.driver_longitude),
    emoji: '🍽️',
  };
}

function mapShipmentToItem(shipment: ShipmentActiveSummary): ActiveDeliveryItem {
  const isMandado = shipment.kind === 'mandado';
  return {
    kind: 'shipment',
    id: shipment.id,
    title: isMandado ? `Mandado #${shipment.id}` : `Envío #${shipment.id}`,
    subtitle: shipment.description || (isMandado ? 'Compra en tienda' : 'Paquete'),
    status: shipment.status,
    statusDisplay: shipment.status_display,
    isLive: shipment.status === 'on_the_way',
    emoji: isMandado ? '🛒' : '📦',
  };
}

/** Una sola instancia por app — usar vía CustomerActiveDeliveriesProvider. */
export function useCustomerActiveDeliveriesState(enabled = true) {
  const [orders, setOrders] = useState<OrderActiveSummary[]>([]);
  const [shipments, setShipments] = useState<ShipmentActiveSummary[]>([]);
  const [refreshError, setRefreshError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!enabled) return;
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
  }, [enabled]);

  const activeOrders = useMemo(
    () => orders.filter((o) => ACTIVE_ORDER_STATUSES.includes(o.status as typeof ACTIVE_ORDER_STATUSES[number])),
    [orders],
  );

  const activeShipments = useMemo(
    () =>
      shipments.filter((s) =>
        ACTIVE_SHIPMENT_STATUSES.includes(s.status as typeof ACTIVE_SHIPMENT_STATUSES[number]),
      ),
    [shipments],
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
    for (const shipment of activeShipments) {
      if (shipment.status !== 'on_the_way') continue;
      items.push({
        ...mapShipmentToItem(shipment),
        subtitle: shipment.kind === 'mandado' ? 'Tu mandado va en camino' : 'Tu paquete va en camino',
        isLive: true,
      });
    }
    return items;
  }, [activeOrders, activeShipments]);

  const trackingItems = useMemo<ActiveDeliveryItem[]>(
    () =>
      [
        ...activeOrders.map(mapOrderToItem),
        ...activeShipments.map(mapShipmentToItem),
      ].sort((a, b) => Number(b.isLive) - Number(a.isLive)),
    [activeOrders, activeShipments],
  );

  const hasLiveTracking = useMemo(() => {
    const orderLive = activeOrders.some(
      (o) =>
        o.status === 'on_the_way'
        || (o.status === 'ready' && o.driver_latitude && o.driver_longitude),
    );
    const shipmentLive = activeShipments.some((s) => s.status === 'on_the_way');
    return orderLive || shipmentLive;
  }, [activeOrders, activeShipments]);

  const pollMs = hasLiveTracking ? 30000 : 60000;

  useEffect(() => {
    if (!enabled) {
      setOrders([]);
      setShipments([]);
      setRefreshError(null);
      return;
    }
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
  }, [load, pollMs, enabled]);

  useRealtimeEvent(
    'order.updated',
    useCallback(() => {
      void load();
    }, [load]),
    enabled,
  );
  useRealtimeEvent(
    'shipment.updated',
    useCallback(() => {
      void load();
    }, [load]),
    enabled,
  );
  useRealtimeEvent(
    'driver.location',
    useCallback(() => {
      void load();
    }, [load]),
    enabled && hasLiveTracking,
  );

  if (!enabled) {
    return {
      activeOrderCount: 0,
      liveItems: [],
      trackingItems: [],
      refreshError: null,
      refresh: async () => {},
    };
  }

  return {
    activeOrderCount: activeOrders.length + activeShipments.length,
    liveItems,
    trackingItems,
    refreshError,
    refresh: load,
  };
}
