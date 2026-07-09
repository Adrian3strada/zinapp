import Ionicons from '@expo/vector-icons/Ionicons';
import React, { useMemo, useState } from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';
import { appAlert, appConfirm } from '../../utils/appAlert';
import { formatOrderLabel } from '../../utils/orderDisplay';

import EmptyState from '../../components/EmptyState';
import ListSkeleton from '../../components/ListSkeleton';
import RestaurantFilterChips, {
  type RestaurantOrderFilter,
} from '../../components/restaurant/RestaurantFilterChips';
import RestaurantHeroHeader from '../../components/restaurant/RestaurantHeroHeader';
import RestaurantOrderCard from '../../components/restaurant/RestaurantOrderCard';
import RestaurantSetupBanner from '../../components/RestaurantSetupBanner';
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
  accepted: { status: 'preparing', label: 'Marcar preparando' },
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
      return true;
  }
}

export default function RestaurantOrdersScreen({ navigation }: Props) {
  const { insets, listPaddingBottom } = useTabScreenInsets();
  const { restaurant, refresh: refreshRestaurant } = useRestaurantContext();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busyOrderId, setBusyOrderId] = useState<number | null>(null);
  const [filter, setFilter] = useState<RestaurantOrderFilter>('all');

  const load = React.useCallback(async () => {
    const isRefresh = orders.length > 0;
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError(null);
    try {
      const { data } = await orderApi.restaurantPending();
      setOrders(data);
    } catch (err) {
      setError(getApiErrorMessage(err, 'No se pudieron cargar los pedidos'));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [orders.length]);

  React.useEffect(() => {
    load();
    const interval = setInterval(load, 15000);
    return () => clearInterval(interval);
  }, [load]);

  const counts = useMemo(
    () => ({
      all: orders.length,
      pending: orders.filter((o) => o.status === 'pending').length,
      kitchen: orders.filter((o) => KITCHEN_STATUSES.includes(o.status)).length,
      ready: orders.filter((o) => o.status === 'ready').length,
      delivery: orders.filter((o) => o.status === 'on_the_way').length,
    }),
    [orders],
  );

  const filteredOrders = useMemo(
    () => orders.filter((o) => matchesFilter(o, filter)),
    [orders, filter],
  );

  const filterOptions = useMemo(
    () => [
      { key: 'all' as const, label: 'Todos', count: counts.all },
      { key: 'pending' as const, label: 'Nuevos', count: counts.pending },
      { key: 'kitchen' as const, label: 'Cocina', count: counts.kitchen },
      { key: 'ready' as const, label: 'Listos', count: counts.ready },
      { key: 'delivery' as const, label: 'En camino', count: counts.delivery },
    ],
    [counts],
  );

  const handleAccept = async (order: Order) => {
    if (busyOrderId != null) return;
    setBusyOrderId(order.id);
    try {
      await orderApi.accept(order.id);
      await load();
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
          <View style={styles.skeletonHero} />
          <ListSkeleton count={3} variant="order" />
        </View>
      }
      error={error}
      onRetry={load}
    >
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
            <RestaurantHeroHeader
              restaurant={restaurant}
              topInset={insets.top}
              eyebrow="Pedidos"
              title={restaurant?.name}
              subtitle={
                counts.pending > 0
                  ? `${counts.pending} pedido${counts.pending === 1 ? '' : 's'} esperando respuesta`
                  : 'Gestiona pedidos en tiempo real'
              }
              stats={[
                { label: 'Activos', value: counts.all, icon: 'receipt-outline' },
                { label: 'Nuevos', value: counts.pending, icon: 'notifications-outline' },
                { label: 'Cocina', value: counts.kitchen, icon: 'flame-outline' },
              ]}
            />

            {restaurant?.setup_status ? (
              <RestaurantSetupBanner
                restaurant={restaurant}
                setupStatus={restaurant.setup_status}
              />
            ) : null}

            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Bandeja de pedidos</Text>
              <Text style={styles.sectionSub}>
                {filteredOrders.length} de {orders.length} pedido{orders.length === 1 ? '' : 's'}
              </Text>
            </View>

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
              onAccept={item.status === 'pending' ? () => handleAccept(item) : undefined}
              onReject={item.status === 'pending' ? () => handleReject(item) : undefined}
              onAdvance={next ? () => handleAdvance(item) : undefined}
              advanceLabel={next?.label}
              busy={busyOrderId === item.id}
            />
          );
        }}
        ListEmptyComponent={
          !loading ? (
            <EmptyState
              emoji={filter === 'pending' ? '🔔' : '✨'}
              title={
                filter === 'all'
                  ? 'Sin pedidos activos'
                  : 'Nada en esta bandeja'
              }
              subtitle={
                filter === 'all'
                  ? 'Cuando llegue un pedido nuevo, aparecerá aquí al instante.'
                  : 'Prueba otro filtro o espera nuevos pedidos.'
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
  skeletonHero: {
    height: 200,
    borderRadius: 28,
    backgroundColor: colors.borderLight,
    marginBottom: spacing.lg,
  },
  sectionHeader: {
    marginBottom: spacing.sm,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.text,
    letterSpacing: -0.2,
  },
  sectionSub: {
    fontSize: 13,
    color: colors.textSecondary,
    marginTop: 2,
    fontWeight: '500',
  },
});
