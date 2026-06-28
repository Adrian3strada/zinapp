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
import { orderApi } from '../../services/api';
import { colors } from '../../theme/colors';
import type { Order } from '../../types';
import { getApiErrorMessage } from '../../utils/apiErrors';

type DeliveryItem = { kind: 'order'; id: string; order: Order };

type DeliveryListRow =
  | { type: 'header'; id: string; label: string }
  | ({ type: 'item' } & DeliveryItem);

function isActiveOrder(order: Order): boolean {
  return order.status === 'on_the_way' || order.status === 'ready';
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
      const { data } = await orderApi.myDeliveries();
      const merged: DeliveryItem[] = data
        .map((order) => ({
          kind: 'order' as const,
          id: `order-${order.id}`,
          order,
        }))
        .sort((a, b) => b.order.updated_at.localeCompare(a.order.updated_at));
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
      if (isActiveOrder(item.order)) active.push(item);
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

  const handleDelivered = (item: DeliveryItem) => {
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

  const renderJob = (item: DeliveryItem) => {
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
        onDelivered={() => handleDelivered(item)}
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
              title="Sin entregas asignadas"
              subtitle="Acepta pedidos en la pestaña Disponibles."
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
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: 10,
    marginTop: 4,
  },
});
