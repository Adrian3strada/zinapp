import React, { useCallback } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';

import EmptyState from '../../components/EmptyState';
import ListFooter from '../../components/ListFooter';
import LiveBadge from '../../components/LiveBadge';
import OrderStatusBadge from '../../components/OrderStatusBadge';
import ScreenContainer from '../../components/ScreenContainer';
import SectionHeader from '../../components/SectionHeader';
import { usePaginatedList } from '../../hooks/usePaginatedList';
import type { AdminOrdersScreenProps } from '../../navigation/types';
import { orderApi } from '../../services/api';
import { colors } from '../../theme/colors';
import { cardShadow } from '../../theme/shadows';
import { formatCurrency } from '../../utils/format';

export default function AdminOrdersScreen({ navigation }: AdminOrdersScreenProps) {
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

  return (
    <ScreenContainer loading={loading && orders.length === 0} error={error} onRetry={refresh}>
      <FlatList
        data={orders}
        keyExtractor={(o) => String(o.id)}
        contentContainerStyle={styles.list}
        onRefresh={refresh}
        refreshing={refreshing}
        onEndReached={loadMore}
        onEndReachedThreshold={0.3}
        ListHeaderComponent={
          <SectionHeader title="Todos los pedidos" subtitle={`${orders.length} cargados`} />
        }
        ListEmptyComponent={
          !loading ? (
            <EmptyState emoji="📋" title="Sin pedidos" subtitle="Aún no hay pedidos en la plataforma." />
          ) : null
        }
        ListFooterComponent={
          <ListFooter loadingMore={loadingMore} hasMore={hasMore} itemCount={orders.length} />
        }
        renderItem={({ item }) => {
          const customerName =
            item.customer_detail?.first_name
            || item.customer_detail?.username
            || 'Cliente';
          const isLive = item.status === 'on_the_way';

          return (
            <Pressable
              style={styles.card}
              onPress={() => navigation.navigate('OrderDetail', { orderId: item.id })}
            >
              <View style={styles.row}>
                <Text style={styles.id}>#{item.id}</Text>
                <View style={styles.badges}>
                  {isLive && <LiveBadge compact label="En camino" />}
                  <OrderStatusBadge status={item.status} label={item.status_display} />
                </View>
              </View>
              <Text style={styles.rest}>{item.restaurant_detail?.name}</Text>
              <Text style={styles.meta}>
                {customerName} ·{' '}
                {new Date(item.created_at).toLocaleDateString('es-MX', {
                  day: 'numeric',
                  month: 'short',
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </Text>
              <Text style={styles.total}>{formatCurrency(item.total)}</Text>
            </Pressable>
          );
        }}
      />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  list: { padding: 16, paddingBottom: 32 },
  card: { backgroundColor: colors.surface, borderRadius: 14, padding: 14, marginBottom: 10, ...cardShadow },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
  badges: { flexDirection: 'row', alignItems: 'center', gap: 6, flexShrink: 1 },
  id: { fontWeight: '800', fontSize: 16, color: colors.text },
  rest: { color: colors.text, fontWeight: '600', marginTop: 6 },
  meta: { color: colors.textSecondary, marginTop: 4, fontSize: 13 },
  total: { color: colors.primary, fontWeight: '700', marginTop: 6, fontSize: 16 },
});
