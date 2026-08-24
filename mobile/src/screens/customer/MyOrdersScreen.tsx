import Ionicons from '@expo/vector-icons/Ionicons';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';

import CustomerOrdersHero from '../../components/customer/CustomerOrdersHero';
import EmptyState from '../../components/EmptyState';
import ListFooter from '../../components/ListFooter';
import ListSkeleton from '../../components/ListSkeleton';
import LiveBadge from '../../components/LiveBadge';
import OrderStatusBadge from '../../components/OrderStatusBadge';
import ScreenContainer from '../../components/ScreenContainer';
import { useCart } from '../../context/CartContext';
import { usePaginatedList } from '../../hooks/usePaginatedList';
import { useTabScreenInsets } from '../../hooks/useTabScreenInsets';
import type { MyOrdersScreenProps } from '../../navigation/types';
import { formatOrderLabel } from '../../utils/orderDisplay';
import { orderApi, shipmentApi } from '../../services/api';
import { colors, statusColors } from '../../theme/colors';
import { spacing } from '../../theme/spacing';
import { cardShadow } from '../../theme/shadows';
import type { Order, Shipment } from '../../types';
import { appAlert } from '../../utils/appAlert';
import { formatCurrency } from '../../utils/format';
import { getApiErrorMessage } from '../../utils/apiErrors';
import { previewToCartItems, reorderUnavailableMessage } from '../../utils/reorderFromOrder';
import { trackEvent } from '../../utils/analytics';
import { FLATLIST_TUNING } from '../../utils/responsive';
import { getRestaurantVisual } from '../../utils/foodVisuals';
import FoodImage from '../../components/FoodImage';

const ACTIVE_ORDER_STATUSES = ['pending', 'accepted', 'preparing', 'ready', 'on_the_way'];
const ACTIVE_SHIPMENT_STATUSES = ['pending', 'picked_up', 'on_the_way'];

type FeedItem =
  | { kind: 'order'; id: string; order: Order; createdAt: string }
  | { kind: 'shipment'; id: string; shipment: Shipment; createdAt: string };

function OrderCard({
  item,
  onPress,
  onReorder,
  reordering,
}: {
  item: Order;
  onPress: () => void;
  onReorder?: () => void;
  reordering?: boolean;
}) {
  const visual = getRestaurantVisual(item.restaurant_detail?.name ?? '');
  const isActive = ACTIVE_ORDER_STATUSES.includes(item.status);
  const isLive = item.status === 'on_the_way';
  const accent = statusColors[item.status] ?? colors.primary;
  const canReorder = item.status === 'delivered' && !!onReorder;

  return (
    <Pressable
      style={({ pressed }) => [
        styles.card,
        isActive && styles.cardActive,
        isActive && { borderLeftColor: accent },
        isLive && styles.cardLive,
        pressed && styles.cardPressed,
      ]}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`Pedido ${formatOrderLabel(item)}, ${item.restaurant_detail?.name ?? ''}, ${item.status_display}`}
      accessibilityHint={isLive ? 'Abre el mapa en vivo' : 'Ver detalle del pedido'}
    >
      <View style={[styles.imageWrap, isLive && styles.imageWrapLive]}>
        <FoodImage emoji={visual.emoji} color={visual.color} size="sm" />
      </View>
      <View style={styles.content}>
        <Text style={styles.restaurant}>{item.restaurant_detail?.name}</Text>
        <Text style={styles.orderId}>{formatOrderLabel(item)}</Text>
        <View style={styles.badgeRow}>
          {isLive ? (
            <LiveBadge label="En camino" />
          ) : (
            <OrderStatusBadge status={item.status} label={item.status_display} />
          )}
        </View>
        <Text style={styles.date}>
          {new Date(item.created_at).toLocaleDateString('es-MX', {
            day: 'numeric',
            month: 'short',
            hour: '2-digit',
            minute: '2-digit',
          })}
        </Text>
        {isLive && (
          <Text style={styles.trackHint}>Toca para ver el mapa en vivo</Text>
        )}
        {canReorder ? (
          <Pressable
            style={styles.reorderBtn}
            onPress={(e) => {
              e.stopPropagation?.();
              onReorder();
            }}
            disabled={reordering}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="Pedir de nuevo"
            accessibilityState={{ busy: !!reordering, disabled: !!reordering }}
          >
            <Ionicons name="refresh-outline" size={14} color={colors.primary} />
            <Text style={styles.reorderText}>
              {reordering ? 'Agregando…' : 'Pedir de nuevo'}
            </Text>
          </Pressable>
        ) : null}
      </View>
      <View style={styles.right}>
        <Text style={styles.total}>{formatCurrency(item.total)}</Text>
        <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
      </View>
    </Pressable>
  );
}

function ShipmentCard({
  item,
  onPress,
}: {
  item: Shipment;
  onPress: () => void;
}) {
  const isMandado = item.kind === 'mandado';
  const isActive = ACTIVE_SHIPMENT_STATUSES.includes(item.status);
  const isLive = item.status === 'on_the_way';
  const accent = statusColors[item.status] ?? (isMandado ? '#16A34A' : colors.shipmentStart);

  return (
    <Pressable
      style={({ pressed }) => [
        styles.card,
        isActive && styles.cardActive,
        isActive && { borderLeftColor: accent },
        isLive && styles.cardLive,
        pressed && styles.cardPressed,
      ]}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${isMandado ? 'Mandado' : 'Envío'} #${item.id}, ${item.status_display}`}
    >
      <View style={[styles.imageWrap, styles.shipmentIconWrap, isLive && styles.imageWrapLive]}>
        <Ionicons
          name={isMandado ? 'basket' : 'cube'}
          size={22}
          color={isMandado ? '#16A34A' : colors.shipmentStart}
        />
      </View>
      <View style={styles.content}>
        <Text style={styles.restaurant}>
          {isMandado ? 'Mandado' : 'Envío'} #{item.id}
        </Text>
        <Text style={styles.orderId} numberOfLines={1}>
          {item.description}
        </Text>
        <View style={styles.badgeRow}>
          {isLive ? (
            <LiveBadge label="En camino" />
          ) : (
            <OrderStatusBadge status={item.status} label={item.status_display} />
          )}
        </View>
        <Text style={styles.date}>
          {new Date(item.created_at).toLocaleDateString('es-MX', {
            day: 'numeric',
            month: 'short',
            hour: '2-digit',
            minute: '2-digit',
          })}
        </Text>
      </View>
      <View style={styles.right}>
        <Text style={styles.total}>{formatCurrency(item.total)}</Text>
        <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
      </View>
    </Pressable>
  );
}

export default function MyOrdersScreen({ navigation }: MyOrdersScreenProps) {
  const { insets, listPaddingBottom } = useTabScreenInsets();
  const { replaceCart } = useCart();
  const [reorderingId, setReorderingId] = useState<number | null>(null);
  const [shipments, setShipments] = useState<Shipment[]>([]);

  const fetchPage = useCallback(async (page: number) => {
    const { data } = await orderApi.list(page);
    return data;
  }, []);

  const {
    items: orders,
    loading,
    refreshing,
    loadingMore,
    error,
    hasMore,
    refresh: refreshOrders,
    loadMore,
  } = usePaginatedList(fetchPage, [fetchPage], 'No se pudieron cargar los pedidos');

  const loadShipments = useCallback(async () => {
    try {
      const { data } = await shipmentApi.list(1);
      setShipments(data.results ?? []);
    } catch {
      // Pedidos de comida siguen visibles aunque fallen los envíos
    }
  }, []);

  const refresh = useCallback(async () => {
    await Promise.all([refreshOrders(), loadShipments()]);
  }, [refreshOrders, loadShipments]);

  useEffect(() => {
    void loadShipments();
  }, [loadShipments]);

  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      void refresh();
    });
    return unsubscribe;
  }, [navigation, refresh]);

  const feed = useMemo((): FeedItem[] => {
    const items: FeedItem[] = [
      ...orders.map((order) => ({
        kind: 'order' as const,
        id: `order-${order.id}`,
        order,
        createdAt: order.created_at,
      })),
      ...shipments.map((shipment) => ({
        kind: 'shipment' as const,
        id: `shipment-${shipment.id}`,
        shipment,
        createdAt: shipment.created_at,
      })),
    ];
    return items.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }, [orders, shipments]);

  const activeCount = useMemo(
    () =>
      orders.filter((o) => ACTIVE_ORDER_STATUSES.includes(o.status)).length
      + shipments.filter((s) => ACTIVE_SHIPMENT_STATUSES.includes(s.status)).length,
    [orders, shipments],
  );

  const handleReorder = useCallback(
    async (order: Order) => {
      if (reorderingId) return;
      setReorderingId(order.id);
      trackEvent('reorder_clicked', { order_id: order.id, source: 'orders' });
      try {
        const { data } = await orderApi.reorderPreview(order.id);
        if (!data.ok || data.items.length === 0) {
          appAlert(
            'Pedir de nuevo',
            [data.detail || 'Ningún platillo está disponible. Abre el menú del restaurante.', reorderUnavailableMessage(data)]
              .filter(Boolean)
              .join('\n\n'),
            [
              { text: 'Cancelar', style: 'cancel' },
              {
                text: 'Ver menú',
                onPress: () =>
                  navigation.navigate('Menu', {
                    restaurantId: data.restaurant_id ?? order.restaurant,
                    restaurantName: data.restaurant_name,
                  }),
              },
            ],
          );
          return;
        }
        replaceCart(previewToCartItems(data));
        const skipped = reorderUnavailableMessage(data);
        if (skipped) {
          appAlert('Revisa tu carrito', `Usamos los precios actuales.\n\n${skipped}`);
        }
        navigation.navigate('Carrito');
      } catch (err) {
        appAlert('Error', getApiErrorMessage(err, 'No se pudo reordenar.'));
      } finally {
        setReorderingId(null);
      }
    },
    [reorderingId, replaceCart, navigation],
  );

  const renderItem = useCallback(
    ({ item }: { item: FeedItem }) => {
      if (item.kind === 'shipment') {
        return (
          <ShipmentCard
            item={item.shipment}
            onPress={() =>
              navigation.navigate('ShipmentDetail', { shipmentId: item.shipment.id })
            }
          />
        );
      }
      return (
        <OrderCard
          item={item.order}
          onPress={() => navigation.navigate('OrderDetail', { orderId: item.order.id })}
          onReorder={
            item.order.status === 'delivered'
              ? () => {
                  void handleReorder(item.order);
                }
              : undefined
          }
          reordering={reorderingId === item.order.id}
        />
      );
    },
    [navigation, handleReorder, reorderingId],
  );

  const header = useMemo(
    () => (
      <CustomerOrdersHero
        topInset={insets.top}
        activeCount={activeCount}
        totalLoaded={feed.length}
      />
    ),
    [activeCount, insets.top, feed.length],
  );

  return (
    <ScreenContainer
      loading={loading && feed.length === 0}
      loadingSkeleton={
        <View style={[styles.skeletonWrap, listPaddingBottom()]}>
          <ListSkeleton count={4} variant="order" />
        </View>
      }
      error={error && feed.length === 0 ? error : null}
      onRetry={refresh}
    >
      <FlatList
        data={feed}
        keyExtractor={(item) => item.id}
        contentContainerStyle={[styles.list, listPaddingBottom()]}
        onRefresh={() => {
          void refresh();
        }}
        refreshing={refreshing}
        onEndReached={loadMore}
        onEndReachedThreshold={0.3}
        ListHeaderComponent={header}
        ListFooterComponent={
          <ListFooter loadingMore={loadingMore} hasMore={hasMore} itemCount={orders.length} />
        }
        renderItem={renderItem}
        ListEmptyComponent={
          !loading ? (
            <EmptyState
              emoji="📋"
              title="Sin pedidos aún"
              subtitle="Aquí verás comida, envíos y mandados con seguimiento en vivo"
              actionLabel="Explorar restaurantes"
              onAction={() => navigation.navigate('Inicio')}
            />
          ) : null
        }
        {...FLATLIST_TUNING}
      />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  list: { padding: spacing.screen, flexGrow: 1 },
  skeletonWrap: { flex: 1, padding: spacing.screen },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: 18,
    padding: 16,
    marginBottom: 12,
    gap: 14,
    borderLeftWidth: 3,
    borderLeftColor: 'transparent',
    borderWidth: 1,
    borderColor: colors.borderLight,
    ...cardShadow,
  },
  cardActive: {},
  cardLive: {},
  cardPressed: { opacity: 0.94 },
  imageWrap: {
    borderRadius: 14,
    overflow: 'hidden',
  },
  shipmentIconWrap: {
    width: 48,
    height: 48,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  imageWrapLive: {
    borderWidth: 2,
    borderColor: colors.primary + '55',
  },
  content: { flex: 1, minWidth: 0, gap: 4 },
  restaurant: { fontSize: 15, fontWeight: '800', color: colors.text },
  orderId: { fontSize: 13, fontWeight: '600', color: colors.textSecondary },
  badgeRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  date: { fontSize: 12, color: colors.textMuted },
  trackHint: { fontSize: 12, fontWeight: '600', color: colors.primary },
  reorderBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
  },
  reorderText: { fontSize: 12, fontWeight: '700', color: colors.primary },
  right: { alignItems: 'flex-end', gap: 8 },
  total: { fontSize: 15, fontWeight: '800', color: colors.text },
});
