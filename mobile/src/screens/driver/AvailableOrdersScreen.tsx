import Ionicons from '@expo/vector-icons/Ionicons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Location from 'expo-location';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';
import { appAlert } from '../../utils/appAlert';
import { formatOrderLabel } from '../../utils/orderDisplay';

import DriverAvailabilityBanner from '../../components/DriverAvailabilityBanner';
import DriverJobCard from '../../components/DriverJobCard';
import EmptyState from '../../components/EmptyState';
import ListSkeleton from '../../components/ListSkeleton';
import ScreenContainer from '../../components/ScreenContainer';
import { useAuth } from '../../context/AuthContext';
import { useDriverProfileContext } from '../../context/DriverProfileContext';
import { useDriverActiveDeliveries } from '../../hooks/useDriverHasActiveDelivery';
import { useTabScreenInsets } from '../../hooks/useTabScreenInsets';
import type { AvailableOrdersScreenProps } from '../../navigation/types';
import { deliveryApi, orderApi } from '../../services/api';
import { colors } from '../../theme/colors';
import type { Order } from '../../types';
import { getApiErrorMessage } from '../../utils/apiErrors';

type AvailableItem = { kind: 'order'; id: string; order: Order };

export default function AvailableOrdersScreen({ navigation }: AvailableOrdersScreenProps) {
  const { user } = useAuth();
  const { listPaddingBottom } = useTabScreenInsets();
  const { isAvailable, updating, toggleAvailability } = useDriverProfileContext();
  const { hasActiveDelivery } = useDriverActiveDeliveries();
  const [items, setItems] = useState<AvailableItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [acceptingId, setAcceptingId] = useState<string | null>(null);

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    else setRefreshing(true);
    setError(null);
    try {
      const { data } = await orderApi.available();
      setItems(
        data.map((order) => ({
          kind: 'order' as const,
          id: `order-${order.id}`,
          order,
        })),
      );
    } catch (err) {
      setError(getApiErrorMessage(err, 'No se pudieron cargar pedidos'));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
    const interval = setInterval(() => load(true), 15000);
    return () => clearInterval(interval);
  }, [load]);

  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => load(true));
    return unsubscribe;
  }, [navigation, load]);

  const countLabel = useMemo(() => {
    const count = items.length;
    if (!count) return 'Nada por ahora';
    return `${count} pedido${count === 1 ? '' : 's'}`;
  }, [items]);

  const handleAccept = async (item: AvailableItem) => {
    if (acceptingId || hasActiveDelivery) {
      if (hasActiveDelivery) {
        appAlert('Entrega en curso', 'Termina tu entrega actual antes de aceptar otra.');
        navigation.navigate('Entregas');
      }
      return;
    }
    setAcceptingId(item.id);
    try {
      await orderApi.acceptDelivery(item.order.id);
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status === 'granted') {
          const position = await Location.getCurrentPositionAsync({
            accuracy: Location.Accuracy.High,
          });
          await deliveryApi.updateLocation(
            position.coords.latitude,
            position.coords.longitude,
          );
        }
      } catch {
        // El GPS se sincronizará en segundo plano
      }
      appAlert('¡Listo!', 'Pedido aceptado');
      load(true);
      navigation.navigate('Entregas');
    } catch (err) {
      appAlert('Error', getApiErrorMessage(err, 'No se pudo aceptar el pedido'));
    } finally {
      setAcceptingId(null);
    }
  };

  const initialLoading = loading && items.length === 0;

  return (
    <ScreenContainer
      loading={initialLoading}
      loadingSkeleton={
        <View style={[styles.skeletonWrap, listPaddingBottom()]}>
          <ListSkeleton count={4} variant="job" />
        </View>
      }
      error={error}
      onRetry={() => load()}
    >
      <FlatList
        data={items}
        keyExtractor={(item) => item.id}
        contentContainerStyle={[styles.list, listPaddingBottom()]}
        onRefresh={() => load(true)}
        refreshing={refreshing}
        ListHeaderComponent={
          <>
            <LinearGradient colors={[colors.gradientStart, colors.gradientEnd]} style={styles.banner}>
              <View style={styles.bannerIcon}>
                <Ionicons name="bicycle" size={28} color="#FFF" />
              </View>
              <View style={styles.bannerText}>
                <Text style={styles.bannerTitle}>Hola, {user?.first_name || 'Repartidor'}</Text>
                <Text style={styles.bannerSub}>
                  {isAvailable ? countLabel : 'Activa disponibilidad para recibir pedidos'}
                </Text>
              </View>
            </LinearGradient>
            <DriverAvailabilityBanner
              isAvailable={isAvailable}
              updating={updating}
              onToggle={toggleAvailability}
            />
            {hasActiveDelivery && (
              <View style={styles.activeBanner}>
                <Ionicons name="navigate-circle" size={20} color={colors.primary} />
                <Text style={styles.activeBannerText}>
                  Tienes una entrega activa. Termínala en Mis entregas.
                </Text>
              </View>
            )}
            {!isAvailable && (
              <View style={styles.tipBox}>
                <Ionicons name="information-circle-outline" size={20} color={colors.primary} />
                <Text style={styles.tipText}>
                  Activa el interruptor para recibir pedidos de comida.
                </Text>
              </View>
            )}
          </>
        }
        renderItem={({ item }) => {
          const order = item.order;
          return (
            <DriverJobCard
              kind="order"
              id={order.id}
              title={formatOrderLabel(order)}
              subtitle={order.restaurant_detail?.name}
              restaurantName={order.restaurant_detail?.name}
              lines={[
                { icon: 'location', text: order.delivery_address },
                ...(order.payment_method === 'cash'
                  ? [{ icon: 'cash-outline' as const, text: 'Cobrar: efectivo' }]
                  : []),
              ]}
              total={order.total}
              onPress={() => navigation.navigate('OrderDetail', { orderId: order.id })}
              onAccept={() => handleAccept(item)}
              acceptLabel={hasActiveDelivery ? 'Entrega en curso' : 'Aceptar pedido'}
              acceptDisabled={!isAvailable || hasActiveDelivery}
              acceptLoading={acceptingId === item.id}
            />
          );
        }}
        ListEmptyComponent={
          !loading ? (
            <EmptyState
              emoji={isAvailable ? '📭' : '⏸️'}
              title={isAvailable ? 'No hay pedidos disponibles' : 'Estás fuera de línea'}
              subtitle={
                isAvailable
                  ? 'Los pedidos listos aparecerán aquí automáticamente.'
                  : 'Activa tu disponibilidad para ver pedidos cerca de ti.'
              }
            />
          ) : null
        }
      />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  list: { padding: 16, flexGrow: 1 },
  skeletonWrap: { flex: 1, padding: 16, paddingTop: 16 },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    padding: 18,
    borderRadius: 22,
    marginBottom: 16,
  },
  bannerIcon: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  bannerText: { flex: 1 },
  bannerTitle: { fontSize: 18, fontWeight: '800', color: '#FFF' },
  bannerSub: { fontSize: 13, color: 'rgba(255,255,255,0.9)', marginTop: 2 },
  activeBanner: {
    flexDirection: 'row',
    gap: 10,
    backgroundColor: colors.primaryLight,
    borderRadius: 14,
    padding: 12,
    marginBottom: 12,
    alignItems: 'center',
  },
  activeBannerText: { flex: 1, fontSize: 13, color: colors.primary, fontWeight: '600', lineHeight: 18 },
  tipBox: {
    flexDirection: 'row',
    gap: 10,
    backgroundColor: colors.background,
    borderRadius: 14,
    padding: 12,
    marginBottom: 12,
    alignItems: 'flex-start',
    borderWidth: 1,
    borderColor: colors.border,
  },
  tipText: { flex: 1, fontSize: 13, color: colors.textSecondary, lineHeight: 18 },
});
