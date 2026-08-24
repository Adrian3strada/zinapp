import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';
import { formatOrderLabel } from '../../utils/orderDisplay';

import DeliveriesHeader from '../../components/driver/DeliveriesHeader';
import DriverJobCard from '../../components/DriverJobCard';
import EmptyState from '../../components/EmptyState';
import ListSkeleton from '../../components/ListSkeleton';
import ScreenContainer from '../../components/ScreenContainer';
import { useDriverProfileContext } from '../../context/DriverProfileContext';
import { useRealtimeEvent } from '../../hooks/useRealtime';
import type { MyDeliveriesScreenProps } from '../../navigation/types';
import { useTabScreenInsets } from '../../hooks/useTabScreenInsets';
import { orderApi, shipmentApi } from '../../services/api';
import { colors } from '../../theme/colors';
import type { Order, Shipment } from '../../types';
import { getApiErrorMessage } from '../../utils/apiErrors';

type DeliveryItem =
  | { kind: 'order'; id: string; order: Order; updatedAt: string }
  | { kind: 'shipment'; id: string; shipment: Shipment; updatedAt: string };

type DeliveryListRow =
  | { type: 'header'; id: string; label: string; count: number }
  | ({ type: 'item' } & DeliveryItem);

function isActiveOrder(order: Order): boolean {
  return order.status === 'on_the_way' || order.status === 'ready';
}

function isActiveShipment(shipment: Shipment): boolean {
  return shipment.status === 'picked_up' || shipment.status === 'on_the_way';
}

function isActiveItem(item: DeliveryItem): boolean {
  return item.kind === 'order' ? isActiveOrder(item.order) : isActiveShipment(item.shipment);
}

function itemEarn(item: DeliveryItem): number {
  if (item.kind === 'order') {
    const fee = parseFloat(item.order.delivery_fee || '0');
    const tip = parseFloat(item.order.tip_amount || '0');
    const earn = (Number.isFinite(fee) ? fee : 0) + (Number.isFinite(tip) ? tip : 0);
    return earn > 0 ? earn : parseFloat(item.order.total || '0') || 0;
  }
  return parseFloat(item.shipment.delivery_fee || item.shipment.total || '0') || 0;
}

export default function MyDeliveriesScreen({ navigation }: MyDeliveriesScreenProps) {
  const { insets, listPaddingBottom } = useTabScreenInsets();
  const { isAvailable } = useDriverProfileContext();
  const [items, setItems] = useState<DeliveryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    else setRefreshing(true);
    try {
      const [ordersRes, shipmentsRes] = await Promise.all([
        orderApi.myDeliveries(),
        shipmentApi.myDeliveries(),
      ]);
      const merged: DeliveryItem[] = [
        ...ordersRes.data.map((order) => ({
          kind: 'order' as const,
          id: `order-${order.id}`,
          order,
          updatedAt: order.updated_at,
        })),
        ...shipmentsRes.data.map((shipment) => ({
          kind: 'shipment' as const,
          id: `shipment-${shipment.id}`,
          shipment,
          updatedAt: shipment.updated_at,
        })),
      ].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
      setItems(merged);
      setError(null);
    } catch (err) {
      setError(getApiErrorMessage(err, 'No se pudieron cargar entregas'));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  const { activeItems, pastItems } = useMemo(() => {
    const active: DeliveryItem[] = [];
    const past: DeliveryItem[] = [];
    for (const item of items) {
      if (isActiveItem(item)) active.push(item);
      else past.push(item);
    }
    return { activeItems: active, pastItems: past };
  }, [items]);

  const activeEarnings = useMemo(
    () => activeItems.reduce((sum, item) => sum + itemEarn(item), 0),
    [activeItems],
  );

  useEffect(() => {
    load();
    const interval = setInterval(() => load(true), activeItems.length > 0 ? 30000 : 60000);
    return () => clearInterval(interval);
  }, [load, activeItems.length]);

  useRealtimeEvent(
    'order.updated',
    useCallback(() => {
      void load(true);
    }, [load]),
  );
  useRealtimeEvent(
    'drivers.job',
    useCallback(() => {
      void load(true);
    }, [load]),
  );

  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => load(true));
    return unsubscribe;
  }, [navigation, load]);

  const listData = useMemo<DeliveryListRow[]>(
    () => [
      ...(activeItems.length
        ? [{ type: 'header' as const, id: 'h-active', label: 'En curso', count: activeItems.length }]
        : []),
      ...activeItems.map((item) => ({ type: 'item' as const, ...item })),
      ...(pastItems.length
        ? [{ type: 'header' as const, id: 'h-past', label: 'Anteriores', count: pastItems.length }]
        : []),
      ...pastItems.map((item) => ({ type: 'item' as const, ...item })),
    ],
    [activeItems, pastItems],
  );

  const renderJob = (item: DeliveryItem) => {
    if (item.kind === 'shipment') {
      const s = item.shipment;
      const isActive = isActiveShipment(s);
      const isMandado = s.kind === 'mandado';
      return (
        <DriverJobCard
          kind="shipment"
          id={s.id}
          title={isMandado ? `Mandado #${s.id}` : `Envío #${s.id}`}
          subtitle={isMandado ? 'Compra en tienda' : s.size_display}
          status={s.status}
          statusLabel={s.status_display}
          lines={[
            { icon: 'storefront-outline', text: s.pickup_address },
            { icon: 'location', text: s.delivery_address },
            ...(s.payment_method === 'cash'
              ? [{ icon: 'cash-outline' as const, text: 'Cobrar servicio: efectivo' }]
              : []),
          ]}
          total={s.delivery_fee || s.total}
          onPress={() => navigation.navigate('ShipmentDetail', { shipmentId: s.id })}
          showActions={isActive}
          onNavigate={() => navigation.navigate('DriverMap', { shipmentId: s.id })}
          navigateLabel="Abrir mapa"
        />
      );
    }
    const order = item.order;
    const isActive = isActiveOrder(order);
    return (
      <DriverJobCard
        kind="order"
        id={order.id}
        title={formatOrderLabel(order)}
        subtitle={order.restaurant_detail?.name}
        restaurantName={order.restaurant_detail?.name}
        status={order.status}
        statusLabel={order.status_display}
        lines={[
          { icon: 'location', text: order.delivery_address },
          ...(order.payment_method === 'transfer'
            ? [{ icon: 'card-outline' as const, text: 'Cobrar: transferencia (ya pagado)' }]
            : order.payment_method === 'cash'
              ? [{ icon: 'cash-outline' as const, text: 'Cobrar: efectivo al entregar' }]
              : []),
          ...(order.delivery_notes
            ? [{ icon: 'chatbubble-outline' as const, text: order.delivery_notes }]
            : []),
        ]}
        total={order.delivery_fee || order.total}
        onPress={() => navigation.navigate('OrderDetail', { orderId: order.id })}
        showActions={isActive}
        onNavigate={() => navigation.navigate('Inicio')}
        navigateLabel="Continuar en mapa"
      />
    );
  };

  return (
    <ScreenContainer
      loading={loading && items.length === 0}
      loadingSkeleton={
        <View style={[styles.skeletonWrap, listPaddingBottom()]}>
          <ListSkeleton count={3} variant="job" />
        </View>
      }
      error={error && items.length === 0 ? error : null}
      onRetry={() => load()}
    >
      <FlatList
        data={listData}
        keyExtractor={(row) => row.id}
        contentContainerStyle={[styles.list, listPaddingBottom()]}
        onRefresh={() => load(true)}
        refreshing={refreshing}
        ListHeaderComponent={
          <DeliveriesHeader
            topInset={insets.top}
            activeCount={activeItems.length}
            historyCount={pastItems.length}
            isAvailable={isAvailable}
            activeEarnings={activeEarnings}
            onContinue={
              activeItems.length > 0
                ? () => {
                    const first = activeItems[0];
                    if (first.kind === 'shipment') {
                      navigation.navigate('DriverMap', { shipmentId: first.shipment.id });
                    } else {
                      navigation.navigate('Inicio');
                    }
                  }
                : undefined
            }
          />
        }
        renderItem={({ item: row }) => {
          if (row.type === 'header') {
            return (
              <View style={styles.sectionHead}>
                <Text style={styles.sectionTitle}>{row.label}</Text>
                <View style={styles.sectionCount}>
                  <Text style={styles.sectionCountText}>{row.count}</Text>
                </View>
              </View>
            );
          }
          const { type: _t, ...item } = row;
          return renderJob(item as DeliveryItem);
        }}
        ListEmptyComponent={
          !loading ? (
            <EmptyState
              emoji="🛵"
              title="Aún no tienes entregas"
              subtitle="Conéctate en Inicio, acepta un pedido o mandado y aparecerá aquí."
              actionLabel="Ir a Inicio"
              onAction={() => navigation.navigate('Inicio')}
            />
          ) : null
        }
      />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  list: { paddingHorizontal: 16, flexGrow: 1 },
  skeletonWrap: { flex: 1, padding: 16 },
  sectionHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 8,
    marginBottom: 10,
  },
  sectionTitle: { fontSize: 15, fontWeight: '800', color: colors.text },
  sectionCount: {
    minWidth: 24,
    height: 24,
    borderRadius: 12,
    paddingHorizontal: 8,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionCountText: { fontSize: 12, fontWeight: '800', color: colors.primaryDark },
});
