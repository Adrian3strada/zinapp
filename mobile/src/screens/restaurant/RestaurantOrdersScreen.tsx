import React, { useMemo, useState } from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';
import { appAlert, appConfirm } from '../../utils/appAlert';
import { formatOrderLabel } from '../../utils/orderDisplay';

import EmptyState from '../../components/EmptyState';
import ListSkeleton from '../../components/ListSkeleton';
import NewOrderAlert from '../../components/restaurant/NewOrderAlert';
import RestaurantFilterChips, {
  type RestaurantOrderFilter,
} from '../../components/restaurant/RestaurantFilterChips';
import RestaurantOrderCard from '../../components/restaurant/RestaurantOrderCard';
import RestaurantSetupBanner from '../../components/RestaurantSetupBanner';
import StoreHomeHeader, {
  type RestaurantTodaySummary,
} from '../../components/restaurant/StoreHomeHeader';
import ScreenContainer from '../../components/ScreenContainer';
import { useRestaurantContext } from '../../context/RestaurantContext';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import type { CompositeScreenProps } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useTabScreenInsets } from '../../hooks/useTabScreenInsets';
import type { RestaurantStackParamList, RestaurantTabParamList } from '../../navigation/types';
import { orderApi } from '../../services/api';
import { colors } from '../../theme/colors';
import { spacing } from '../../theme/spacing';
import type { Order } from '../../types';
import { getApiErrorMessage } from '../../utils/apiErrors';

type Props = CompositeScreenProps<
  BottomTabScreenProps<RestaurantTabParamList, 'Pedidos'>,
  NativeStackScreenProps<RestaurantStackParamList>
>;

const NEXT_STATUS: Record<string, { status: string; label: string }> = {
  accepted: { status: 'preparing', label: 'Empezar a preparar' },
  preparing: { status: 'ready', label: 'Listo para recoger' },
};

const KITCHEN_STATUSES = ['accepted', 'preparing'];

function matchesFilter(order: Order, filter: RestaurantOrderFilter): boolean {
  switch (filter) {
    case 'pending':
      return order.status === 'pending';
    case 'kitchen':
      return KITCHEN_STATUSES.includes(order.status);
    case 'ready':
      return order.status === 'ready';
    case 'delivery':
      return order.status === 'on_the_way';
    default:
      return order.status !== 'pending';
  }
}

export default function RestaurantOrdersScreen({ navigation }: Props) {
  const { insets, listPaddingBottom } = useTabScreenInsets();
  const {
    restaurant,
    refresh: refreshRestaurant,
    togglingOrders,
    toggleAcceptingOrders,
  } = useRestaurantContext();
  const [orders, setOrders] = useState<Order[]>([]);
  const [today, setToday] = useState<RestaurantTodaySummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busyOrderId, setBusyOrderId] = useState<number | null>(null);
  const [filter, setFilter] = useState<RestaurantOrderFilter>('kitchen');

  const load = React.useCallback(async () => {
    const isRefresh = orders.length > 0;
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError(null);
    try {
      const [pendingRes, todayRes] = await Promise.all([
        orderApi.restaurantPending(),
        orderApi.restaurantToday().catch(() => null),
      ]);
      setOrders(pendingRes.data);
      if (todayRes) {
        setToday({
          orders_created: todayRes.data.orders_created,
          orders_active: todayRes.data.orders_active,
          orders_delivered: todayRes.data.orders_delivered,
          orders_cancelled: todayRes.data.orders_cancelled,
          net_sales: todayRes.data.net_sales,
        });
      }
    } catch (err) {
      setError(getApiErrorMessage(err, 'No se pudieron cargar los pedidos'));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [orders.length]);

  React.useEffect(() => {
    load();
    const interval = setInterval(load, 10000);
    return () => clearInterval(interval);
  }, [load]);

  React.useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      void load();
      void refreshRestaurant();
    });
    return unsubscribe;
  }, [navigation, load, refreshRestaurant]);

  const pendingOrders = useMemo(
    () => orders.filter((o) => o.status === 'pending'),
    [orders],
  );
  const alertOrder = pendingOrders[0] ?? null;

  const counts = useMemo(
    () => ({
      all: orders.filter((o) => o.status !== 'pending').length,
      pending: pendingOrders.length,
      kitchen: orders.filter((o) => KITCHEN_STATUSES.includes(o.status)).length,
      ready: orders.filter((o) => o.status === 'ready').length,
      delivery: orders.filter((o) => o.status === 'on_the_way').length,
    }),
    [orders, pendingOrders.length],
  );

  const filteredOrders = useMemo(
    () => orders.filter((o) => matchesFilter(o, filter)),
    [orders, filter],
  );

  const filterOptions = useMemo(
    () => [
      { key: 'kitchen' as const, label: 'Cocina', count: counts.kitchen },
      { key: 'ready' as const, label: 'Listos', count: counts.ready },
      { key: 'delivery' as const, label: 'En camino', count: counts.delivery },
      { key: 'all' as const, label: 'Todos', count: counts.all },
    ],
    [counts],
  );

  const isOpen =
    !!restaurant?.is_active
    && restaurant.accepting_orders !== false;

  const handleAccept = async (order: Order, prepMinutes: number) => {
    if (busyOrderId != null) return;
    setBusyOrderId(order.id);
    try {
      await orderApi.accept(order.id, prepMinutes);
      await load();
      setFilter('kitchen');
    } catch (err) {
      appAlert('Error', getApiErrorMessage(err, 'No se pudo aceptar'));
    } finally {
      setBusyOrderId(null);
    }
  };

  const handleReject = (order: Order) => {
    if (busyOrderId != null) return;
    appConfirm(
      'Rechazar pedido',
      `¿Rechazar ${formatOrderLabel(order)}?`,
      async () => {
        setBusyOrderId(order.id);
        try {
          await orderApi.reject(order.id);
          await load();
        } catch (err) {
          appAlert('Error', getApiErrorMessage(err, 'No se pudo rechazar'));
        } finally {
          setBusyOrderId(null);
        }
      },
      'Rechazar',
    );
  };

  const handleAdvance = async (order: Order) => {
    const next = NEXT_STATUS[order.status];
    if (!next || busyOrderId != null) return;
    setBusyOrderId(order.id);
    try {
      await orderApi.updateStatus(order.id, next.status);
      await load();
      if (next.status === 'ready') setFilter('ready');
    } catch (err) {
      appAlert('Error', getApiErrorMessage(err, 'No se pudo actualizar'));
    } finally {
      setBusyOrderId(null);
    }
  };

  const initialLoading = loading && orders.length === 0;

  return (
    <ScreenContainer
      loading={initialLoading}
      loadingSkeleton={
        <View style={[styles.skeletonWrap, { paddingTop: insets.top + spacing.sm }, listPaddingBottom()]}>
          <View style={styles.skeletonHeader} />
          <ListSkeleton count={3} variant="order" />
        </View>
      }
      error={error}
      onRetry={load}
    >
      {alertOrder ? (
        <NewOrderAlert
          order={alertOrder}
          busy={busyOrderId === alertOrder.id}
          queueCount={pendingOrders.length}
          onAccept={(prepMinutes) => handleAccept(alertOrder, prepMinutes)}
          onReject={() => handleReject(alertOrder)}
          onDetails={() =>
            navigation.navigate('OrderDetail', { orderId: alertOrder.id })
          }
        />
      ) : null}

      <FlatList
        data={filteredOrders}
        keyExtractor={(item) => String(item.id)}
        contentContainerStyle={[styles.list, listPaddingBottom()]}
        onRefresh={() => {
          void load();
          void refreshRestaurant();
        }}
        refreshing={refreshing}
        keyboardShouldPersistTaps="handled"
        ListHeaderComponent={
          <>
            <StoreHomeHeader
              topInset={insets.top}
              restaurant={restaurant}
              today={today}
              kitchenCount={counts.kitchen}
              readyCount={counts.ready}
              deliveryCount={counts.delivery}
              toggling={togglingOrders}
              onToggleOpen={(open) => {
                void toggleAcceptingOrders(open);
              }}
            />

            {!isOpen && restaurant?.is_active ? (
              <View style={styles.closedBanner}>
                <Text style={styles.closedText}>
                  Estás cerrado. Desliza para abrir y recibir pedidos.
                </Text>
              </View>
            ) : null}
            {restaurant?.setup_status ? (
              <RestaurantSetupBanner
                restaurant={restaurant}
                setupStatus={restaurant.setup_status}
              />
            ) : null}

            {pendingOrders.length > 0 ? (
              <View style={styles.pendingHint}>
                <Text style={styles.pendingHintText}>
                  {pendingOrders.length} pedido{pendingOrders.length === 1 ? '' : 's'} nuevo
                  {pendingOrders.length === 1 ? '' : 's'} esperando respuesta
                </Text>
              </View>
            ) : null}

            <RestaurantFilterChips
              options={filterOptions}
              selected={filter}
              onChange={setFilter}
            />
          </>
        }
        renderItem={({ item }) => {
          const next = NEXT_STATUS[item.status];
          return (
            <RestaurantOrderCard
              order={item}
              onPress={() => navigation.navigate('OrderDetail', { orderId: item.id })}
              onAdvance={next ? () => handleAdvance(item) : undefined}
              advanceLabel={next?.label}
              busy={busyOrderId === item.id}
            />
          );
        }}
        ListEmptyComponent={
          !loading ? (
            <EmptyState
              emoji={filter === 'kitchen' ? '👨‍🍳' : '✨'}
              title={
                filter === 'kitchen'
                  ? 'Cocina libre'
                  : filter === 'ready'
                    ? 'Nada listo por ahora'
                    : 'Sin pedidos activos'
              }
              subtitle={
                filter === 'kitchen'
                  ? 'Cuando aceptes un pedido nuevo, aparecerá aquí para prepararlo.'
                  : 'Los pedidos de esta bandeja aparecerán automáticamente.'
              }
            />
          ) : null
        }
      />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  list: {
    paddingHorizontal: spacing.screen,
    flexGrow: 1,
  },
  skeletonWrap: {
    flex: 1,
    paddingHorizontal: spacing.screen,
  },
  skeletonHeader: {
    height: 120,
    borderRadius: 18,
    backgroundColor: colors.borderLight,
    marginBottom: spacing.lg,
  },
  pendingHint: {
    backgroundColor: colors.primaryLight,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: spacing.sm,
  },
  pendingHintText: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.primaryDark,
    textAlign: 'center',
  },
  closedBanner: {
    backgroundColor: colors.background,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  closedText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textSecondary,
    textAlign: 'center',
  },
});
