import Ionicons from '@expo/vector-icons/Ionicons';
import React, { useCallback, useEffect, useMemo } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';

import EmptyState from '../../components/EmptyState';
import ListFooter from '../../components/ListFooter';
import ListSkeleton from '../../components/ListSkeleton';
import LiveBadge from '../../components/LiveBadge';
import OrderStatusBadge from '../../components/OrderStatusBadge';
import ScreenContainer from '../../components/ScreenContainer';
import SectionHeader from '../../components/SectionHeader';
import { usePaginatedList } from '../../hooks/usePaginatedList';
import { useTabScreenInsets } from '../../hooks/useTabScreenInsets';
import type { MyOrdersScreenProps } from '../../navigation/types';
import { formatOrderLabel } from '../../utils/orderDisplay';
import { orderApi } from '../../services/api';
import { colors, statusColors } from '../../theme/colors';
import { spacing } from '../../theme/spacing';
import { cardShadow } from '../../theme/shadows';
import type { Order } from '../../types';
import { formatCurrency } from '../../utils/format';
import { FLATLIST_TUNING } from '../../utils/responsive';
import { getRestaurantVisual } from '../../utils/foodVisuals';
import FoodImage from '../../components/FoodImage';

const ACTIVE_STATUSES = ['pending', 'accepted', 'preparing', 'ready', 'on_the_way'];

function OrderCard({
  item,
  onPress,
}: {
  item: Order;
  onPress: () => void;
}) {
  const visual = getRestaurantVisual(item.restaurant_detail?.name ?? '');
  const isActive = ACTIVE_STATUSES.includes(item.status);
  const isLive = item.status === 'on_the_way';
  const accent = statusColors[item.status] ?? colors.primary;

  return (
    <Pressable
      style={({ pressed }) => [
        styles.card,
        isActive && { borderLeftColor: accent },
        isLive && styles.cardLive,
        pressed && styles.cardPressed,
      ]}
      onPress={onPress}
    >
      <FoodImage emoji={visual.emoji} color={visual.color} size="sm" />
      <View style={styles.content}>
        <Text style={styles.restaurant}>{item.restaurant_detail?.name}</Text>
        <Text style={styles.orderId}>{formatOrderLabel(item)}</Text>
        <View style={styles.badgeRow}>
          <OrderStatusBadge status={item.status} label={item.status_display} />
          {isLive && <LiveBadge label="En camino" />}
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
      </View>
      <View style={styles.right}>
        <Text style={styles.total}>{formatCurrency(item.total)}</Text>
        <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
      </View>
    </Pressable>
  );
}

export default function MyOrdersScreen({ navigation }: MyOrdersScreenProps) {
  const { listPaddingBottom } = useTabScreenInsets();
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
    refresh,
    loadMore,
  } = usePaginatedList(fetchPage, [fetchPage], 'No se pudieron cargar los pedidos');

  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', refresh);
    return unsubscribe;
  }, [navigation, refresh]);

  const activeCount = useMemo(
    () => orders.filter((o) => ACTIVE_STATUSES.includes(o.status)).length,
    [orders],
  );

  const renderItem = useCallback(
    ({ item }: { item: Order }) => (
      <OrderCard
        item={item}
        onPress={() => navigation.navigate('OrderDetail', { orderId: item.id })}
      />
    ),
    [navigation],
  );

  const header = useMemo(
    () =>
      activeCount > 0 ? (
        <SectionHeader
          subtitle={`${activeCount} pedido${activeCount > 1 ? 's' : ''} en curso`}
        />
      ) : null,
    [activeCount],
  );

  return (
    <ScreenContainer
      loading={loading && orders.length === 0}
      loadingSkeleton={
        <View style={[styles.skeletonWrap, listPaddingBottom()]}>
          <ListSkeleton count={4} variant="order" />
        </View>
      }
      error={error}
      onRetry={refresh}
    >
      <FlatList
        data={orders}
        keyExtractor={(item) => String(item.id)}
        contentContainerStyle={[styles.list, listPaddingBottom()]}
        onRefresh={refresh}
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
              subtitle="Cuando pidas comida, aparecerá aquí con seguimiento en tiempo real"
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
    borderRadius: 22,
    padding: 16,
    marginBottom: 12,
    gap: 14,
    borderLeftWidth: 4,
    borderLeftColor: 'transparent',
    borderWidth: 1,
    borderColor: colors.borderLight,
    ...cardShadow,
  },
  cardLive: {
    backgroundColor: colors.primaryLight + '66',
    borderColor: colors.primary + '44',
  },
  cardPressed: { opacity: 0.94 },
  content: { flex: 1, gap: 5 },
  restaurant: { fontSize: 16, fontWeight: '800', color: colors.text, letterSpacing: -0.2 },
  orderId: { fontSize: 12, color: colors.textMuted, fontWeight: '500' },
  badgeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, alignItems: 'center' },
  date: { fontSize: 11, color: colors.textMuted, marginTop: 2 },
  trackHint: { fontSize: 11, color: colors.primary, fontWeight: '600', marginTop: 2 },
  right: { alignItems: 'flex-end', gap: 8 },
  total: { fontSize: 16, fontWeight: '800', color: colors.primary },
});
