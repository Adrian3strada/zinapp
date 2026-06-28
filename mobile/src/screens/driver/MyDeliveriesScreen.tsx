import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';
import { appAlert, appConfirm } from '../../utils/appAlert';
import { formatOrderLabel } from '../../utils/orderDisplay';

import DriverJobCard from '../../components/DriverJobCard';
import EmptyState from '../../components/EmptyState';
import ListSkeleton from '../../components/ListSkeleton';
import ScreenContainer from '../../components/ScreenContainer';
import type { MyDeliveriesScreenProps } from '../../navigation/types';
import { useTabScreenInsets } from '../../hooks/useTabScreenInsets';
import { orderApi, shipmentApi } from '../../services/api';
import { colors } from '../../theme/colors';
import type { Order, Shipment } from '../../types';
import { getApiErrorMessage } from '../../utils/apiErrors';

type DeliveryItem =
  | { kind: 'order'; id: string; order: Order }
  | { kind: 'shipment'; id: string; shipment: Shipment };

type DeliveryListRow =
  | { type: 'header'; id: string; label: string }
  | ({ type: 'item' } & DeliveryItem);

function isActiveOrder(order: Order): boolean {
  return order.status === 'on_the_way' || order.status === 'ready';
}

function isActiveShipment(shipment: Shipment): boolean {
  return shipment.status === 'picked_up' || shipment.status === 'on_the_way';
}

export default function MyDeliveriesScreen({ navigation }: MyDeliveriesScreenProps) {
  const { listPaddingBottom } = useTabScreenInsets();
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
        })),
        ...shipmentsRes.data.map((shipment) => ({
          kind: 'shipment' as const,
          id: `shipment-${shipment.id}`,
          shipment,
        })),
      ].sort((a, b) => {
        const aTime = a.kind === 'order' ? a.order.updated_at : a.shipment.updated_at;
        const bTime = b.kind === 'order' ? b.order.updated_at : b.shipment.updated_at;
        return bTime.localeCompare(aTime);
      });
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
      const activeNow = item.kind === 'order'
        ? isActiveOrder(item.order)
        : isActiveShipment(item.shipment);
      if (activeNow) active.push(item);
      else past.push(item);
    }
    return { activeItems: active, pastItems: past };
  }, [items]);

  useEffect(() => {
    load();
    const interval = setInterval(() => load(true), activeItems.length > 0 ? 8000 : 20000);
    return () => clearInterval(interval);
  }, [load, activeItems.length]);

  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => load(true));
    return unsubscribe;
  }, [navigation, load]);

  const listData = useMemo<DeliveryListRow[]>(
    () => [
      ...(activeItems.length ? [{ type: 'header' as const, id: 'h-active', label: 'En curso' }] : []),
      ...activeItems.map((item) => ({ type: 'item' as const, ...item })),
      ...(pastItems.length ? [{ type: 'header' as const, id: 'h-past', label: 'Anteriores' }] : []),
      ...pastItems.map((item) => ({ type: 'item' as const, ...item })),
    ],
    [activeItems, pastItems],
  );

  const handleOrderDelivered = (item: Extract<DeliveryItem, { kind: 'order' }>) => {
    appConfirm(
      'Confirmar entrega',
      '¿Marcar como entregado?',
      async () => {
        try {
          await orderApi.markDelivered(item.order.id);
          load(true);
          navigation.navigate('OrderDetail', { orderId: item.order.id, promptReview: true });
        } catch (err) {
          appAlert('Error', getApiErrorMessage(err, 'No se pudo marcar entregado'));
        }
      },
      'Sí, entregado',
    );
  };

  const handleShipmentPickedUp = async (shipment: Shipment) => {
    try {
      await shipmentApi.markPickedUp(shipment.id);
      load(true);
    } catch (err) {
      appAlert('Error', getApiErrorMessage(err, 'No se pudo marcar recogido'));
    }
  };

  const handleShipmentDelivered = (shipment: Shipment) => {
    appConfirm(
      'Confirmar entrega',
      '¿Marcar el envío como entregado?',
      async () => {
        try {
          await shipmentApi.markDelivered(shipment.id);
          load(true);
          navigation.navigate('ShipmentDetail', { shipmentId: shipment.id });
        } catch (err) {
          appAlert('Error', getApiErrorMessage(err, 'No se pudo marcar entregado'));
        }
      },
      'Sí, entregado',
    );
  };

  const renderJob = (item: DeliveryItem) => {
    if (item.kind === 'order') {
      const order = item.order;
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
          total={order.total}
          onPress={() => navigation.navigate('OrderDetail', { orderId: order.id })}
          showActions={order.status === 'on_the_way'}
          onNavigate={() => navigation.navigate('DriverMap', { orderId: order.id })}
          onDelivered={() => handleOrderDelivered(item)}
        />
      );
    }

    const shipment = item.shipment;
    return (
      <DriverJobCard
        kind="shipment"
        id={shipment.id}
        title={`Envío #${shipment.id}`}
        subtitle={shipment.description}
        status={shipment.status}
        statusLabel={shipment.status_display}
        lines={[
          { icon: 'cube-outline', text: shipment.pickup_address },
          { icon: 'location', text: shipment.delivery_address },
        ]}
        total={shipment.total}
        onPress={() => navigation.navigate('ShipmentDetail', { shipmentId: shipment.id })}
        showActions={shipment.status === 'picked_up' || shipment.status === 'on_the_way'}
        onNavigate={() => navigation.navigate('DriverMap', { shipmentId: shipment.id })}
        onPickedUp={shipment.status === 'picked_up' ? () => handleShipmentPickedUp(shipment) : undefined}
        onDelivered={shipment.status === 'on_the_way' ? () => handleShipmentDelivered(shipment) : undefined}
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
      error={error}
      onRetry={() => load()}
    >
      <FlatList
        data={listData}
        keyExtractor={(row) => row.id}
        contentContainerStyle={[styles.list, listPaddingBottom()]}
        onRefresh={() => load(true)}
        refreshing={refreshing}
        renderItem={({ item: row }) => {
          if (row.type === 'header') {
            return <Text style={styles.sectionHeader}>{row.label}</Text>;
          }
          const { type: _t, ...item } = row;
          return renderJob(item as DeliveryItem);
        }}
        ListEmptyComponent={
          !loading ? (
            <EmptyState
              emoji="🛵"
              title="Sin entregas aún"
              subtitle="Acepta pedidos o envíos en Disponibles"
              actionLabel="Ver disponibles"
              onAction={() => navigation.navigate('Disponibles')}
            />
          ) : null
        }
      />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  list: { padding: 16, flexGrow: 1 },
  skeletonWrap: { flex: 1, padding: 16 },
  sectionHeader: {
    fontSize: 13,
    fontWeight: '800',
    color: colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginTop: 8,
    marginBottom: 10,
  },
});
