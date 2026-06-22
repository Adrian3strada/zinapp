import Ionicons from '@expo/vector-icons/Ionicons';
import React, { useCallback, useEffect, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { appAlert, appConfirm } from '../../utils/appAlert';
import { formatOrderLabel, orderRef } from '../../utils/orderDisplay';

import Button from '../../components/Button';
import EmptyState from '../../components/EmptyState';
import ListSkeleton from '../../components/ListSkeleton';
import OrderStatusBadge from '../../components/OrderStatusBadge';
import ScreenContainer from '../../components/ScreenContainer';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import type { CompositeScreenProps } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useTabScreenInsets } from '../../hooks/useTabScreenInsets';
import type { RestaurantStackParamList, RestaurantTabParamList } from '../../navigation/types';
import { orderApi } from '../../services/api';
import { colors } from '../../theme/colors';
import { spacing } from '../../theme/spacing';
import { cardShadow } from '../../theme/shadows';
import type { Order } from '../../types';
import { getApiErrorMessage } from '../../utils/apiErrors';
import { formatCurrency } from '../../utils/format';

type Props = CompositeScreenProps<
  BottomTabScreenProps<RestaurantTabParamList, 'Pedidos'>,
  NativeStackScreenProps<RestaurantStackParamList>
>;

const NEXT_STATUS: Record<string, { status: string; label: string }> = {
  accepted: { status: 'preparing', label: 'Marcar preparando' },
  preparing: { status: 'ready', label: 'Listo para recoger' },
};

export default function RestaurantOrdersScreen({ navigation }: Props) {
  const { insets, listPaddingBottom } = useTabScreenInsets();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busyOrderId, setBusyOrderId] = useState<number | null>(null);

  const load = useCallback(async () => {
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

  useEffect(() => {
    load();
    const interval = setInterval(load, 15000);
    return () => clearInterval(interval);
  }, [load]);

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
          <View style={styles.headerRow}>
            <View style={styles.headerTitleBone} />
          </View>
          <View style={styles.stats}>
            <View style={styles.statBoxSkeleton} />
            <View style={styles.statBoxSkeleton} />
          </View>
          <ListSkeleton count={3} variant="order" />
        </View>
      }
      error={error}
      onRetry={load}
    >
      <FlatList
        data={orders}
        keyExtractor={(item) => String(item.id)}
        contentContainerStyle={[
          styles.list,
          { paddingTop: insets.top + spacing.sm },
          listPaddingBottom(),
        ]}
        onRefresh={load}
        refreshing={refreshing}
        keyboardShouldPersistTaps="handled"
        ListHeaderComponent={
          <>
            <View style={styles.headerRow}>
              <Text style={styles.headerTitle}>Pedidos activos</Text>
            </View>
            <View style={styles.stats}>
              <View style={styles.statBox}>
                <Text style={styles.statNum}>{orders.length}</Text>
                <Text style={styles.statLabel}>Activos</Text>
              </View>
              <View style={styles.statBox}>
                <Text style={styles.statNum}>
                  {orders.filter((o) => o.status === 'pending').length}
                </Text>
                <Text style={styles.statLabel}>Pendientes</Text>
              </View>
            </View>
          </>
        }
        renderItem={({ item }) => (
          <Pressable
            style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
            onPress={() => navigation.navigate('OrderDetail', { orderId: item.id })}
          >
            <View style={styles.cardTop}>
              <Text style={styles.orderId}>{orderRef(item)}</Text>
              <View style={styles.badgeRow}>
                {item.payment_method === 'online' && item.payment_status !== 'paid' && (
                  <View style={styles.paymentBadge}>
                    <Text style={styles.paymentBadgeText}>Pago pendiente</Text>
                  </View>
                )}
                <OrderStatusBadge status={item.status} label={item.status_display} />
              </View>
            </View>
            <Text style={styles.total}>{formatCurrency(item.total)}</Text>
            <Text style={styles.address} numberOfLines={1}>
              <Ionicons name="location-outline" size={12} color={colors.textMuted} />{' '}
              {item.delivery_address}
            </Text>

            {item.status === 'pending' && (
              <View style={styles.actions}>
                <Button
                  title="Aceptar"
                  onPress={() => handleAccept(item)}
                  loading={busyOrderId === item.id}
                  style={styles.btn}
                />
                <Button
                  title="Rechazar"
                  variant="danger"
                  onPress={() => handleReject(item)}
                  loading={busyOrderId === item.id}
                  style={styles.btn}
                />
              </View>
            )}
            {NEXT_STATUS[item.status] && (
              <Button
                title={NEXT_STATUS[item.status].label}
                onPress={() => handleAdvance(item)}
                loading={busyOrderId === item.id}
                style={{ marginTop: 12 }}
              />
            )}
          </Pressable>
        )}
        ListEmptyComponent={
          !loading ? (
            <EmptyState
              emoji="✨"
              title="Sin pedidos activos"
              subtitle="Cuando llegue un pedido nuevo, aparecerá aquí al instante."
            />
          ) : null
        }
      />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  list: { paddingHorizontal: spacing.screen, flexGrow: 1 },
  skeletonWrap: { flex: 1, paddingHorizontal: spacing.screen },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  headerTitle: { fontSize: 22, fontWeight: '800', color: colors.text, flex: 1 },
  headerTitleBone: {
    width: 180,
    height: 26,
    borderRadius: 8,
    backgroundColor: colors.borderLight,
  },
  stats: { flexDirection: 'row', gap: 12, marginBottom: 16 },
  statBox: {
    flex: 1,
    backgroundColor: colors.primaryLight,
    borderRadius: 14,
    padding: 16,
    alignItems: 'center',
  },
  statBoxSkeleton: {
    flex: 1,
    height: 80,
    borderRadius: 14,
    backgroundColor: colors.borderLight,
  },
  statNum: { fontSize: 28, fontWeight: '800', color: colors.primary },
  statLabel: { fontSize: 12, color: colors.textSecondary, fontWeight: '600', marginTop: 2 },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 22,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: colors.borderLight,
    ...cardShadow,
  },
  cardPressed: { opacity: 0.94 },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  badgeRow: { flexDirection: 'row', alignItems: 'center', gap: 6, flexShrink: 1 },
  paymentBadge: {
    backgroundColor: '#FFF3E0',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  paymentBadgeText: { fontSize: 10, fontWeight: '700', color: '#E65100' },
  orderId: { fontSize: 18, fontWeight: '800', color: colors.text },
  total: { fontSize: 20, fontWeight: '800', color: colors.primary, marginTop: 8 },
  address: { fontSize: 13, color: colors.textSecondary, marginTop: 6 },
  actions: { flexDirection: 'row', gap: 10, marginTop: 14 },
  btn: { flex: 1 },
});
