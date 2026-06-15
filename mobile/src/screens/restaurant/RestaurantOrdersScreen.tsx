import Ionicons from '@expo/vector-icons/Ionicons';
import React, { useCallback, useEffect, useState } from 'react';
import { Alert, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import Button from '../../components/Button';
import OrderStatusBadge from '../../components/OrderStatusBadge';
import ScreenContainer from '../../components/ScreenContainer';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import type { CompositeScreenProps } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
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
  const insets = useSafeAreaInsets();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
    try {
      await orderApi.accept(order.id);
      load();
    } catch (err) {
      Alert.alert('Error', getApiErrorMessage(err, 'No se pudo aceptar'));
    }
  };

  const handleReject = (order: Order) => {
    Alert.alert('Rechazar pedido', `¿Rechazar el pedido #${order.id}?`, [
      { text: 'No', style: 'cancel' },
      {
        text: 'Rechazar',
        style: 'destructive',
        onPress: async () => {
          try {
            await orderApi.reject(order.id);
            load();
          } catch (err) {
            Alert.alert('Error', getApiErrorMessage(err, 'No se pudo rechazar'));
          }
        },
      },
    ]);
  };

  const handleAdvance = async (order: Order) => {
    const next = NEXT_STATUS[order.status];
    if (!next) return;
    try {
      await orderApi.updateStatus(order.id, next.status);
      load();
    } catch (err) {
      Alert.alert('Error', getApiErrorMessage(err, 'No se pudo actualizar'));
    }
  };

  return (
    <ScreenContainer loading={loading && orders.length === 0} error={error} onRetry={load}>
      <FlatList
        data={orders}
        keyExtractor={(item) => String(item.id)}
        contentContainerStyle={[
          styles.list,
          {
            paddingTop: insets.top + spacing.sm,
            paddingBottom: insets.bottom + spacing.tabBar + spacing.lg,
          },
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
            style={styles.card}
            onPress={() => navigation.navigate('OrderDetail', { orderId: item.id })}
          >
            <View style={styles.cardTop}>
              <Text style={styles.orderId}>#{item.id}</Text>
              <OrderStatusBadge status={item.status} label={item.status_display} />
            </View>
            <Text style={styles.total}>{formatCurrency(item.total)}</Text>
            <Text style={styles.address} numberOfLines={1}>
              <Ionicons name="location-outline" size={12} color={colors.textMuted} />{' '}
              {item.delivery_address}
            </Text>

            {item.status === 'pending' && (
              <View style={styles.actions}>
                <Button title="Aceptar" onPress={() => handleAccept(item)} style={styles.btn} />
                <Button title="Rechazar" variant="danger" onPress={() => handleReject(item)} style={styles.btn} />
              </View>
            )}
            {NEXT_STATUS[item.status] && (
              <Button
                title={NEXT_STATUS[item.status].label}
                onPress={() => handleAdvance(item)}
                style={{ marginTop: 12 }}
              />
            )}
          </Pressable>
        )}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyEmoji}>✨</Text>
            <Text style={styles.emptyText}>Sin pedidos activos</Text>
          </View>
        }
      />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  list: { paddingHorizontal: spacing.screen },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  headerTitle: { fontSize: 22, fontWeight: '800', color: colors.text, flex: 1 },
  stats: { flexDirection: 'row', gap: 12, marginBottom: 16 },
  statBox: {
    flex: 1,
    backgroundColor: colors.primaryLight,
    borderRadius: 14,
    padding: 16,
    alignItems: 'center',
  },
  statNum: { fontSize: 28, fontWeight: '800', color: colors.primary },
  statLabel: { fontSize: 12, color: colors.textSecondary, fontWeight: '600', marginTop: 2 },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    ...cardShadow,
  },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  orderId: { fontSize: 18, fontWeight: '800', color: colors.text },
  total: { fontSize: 20, fontWeight: '800', color: colors.primary, marginTop: 8 },
  address: { fontSize: 13, color: colors.textSecondary, marginTop: 6 },
  actions: { flexDirection: 'row', gap: 10, marginTop: 14 },
  btn: { flex: 1 },
  empty: { alignItems: 'center', paddingTop: 60 },
  emptyEmoji: { fontSize: 48 },
  emptyText: { color: colors.textMuted, marginTop: 8, fontSize: 16 },
});
