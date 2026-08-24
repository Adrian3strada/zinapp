import Ionicons from '@expo/vector-icons/Ionicons';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';
import { appAlert } from '../../utils/appAlert';
import { formatOrderLabel } from '../../utils/orderDisplay';

import DriverAvailabilityBanner from '../../components/DriverAvailabilityBanner';
import DriverHeroHeader from '../../components/driver/DriverHeroHeader';
import DriverJobCard from '../../components/DriverJobCard';
import EmptyState from '../../components/EmptyState';
import ListSkeleton from '../../components/ListSkeleton';
import ScreenContainer from '../../components/ScreenContainer';
import SectionHeader from '../../components/SectionHeader';
import { useAuth } from '../../context/AuthContext';
import { useDriverProfileContext } from '../../context/DriverProfileContext';
import { useDriverActiveDeliveries } from '../../hooks/useDriverHasActiveDelivery';
import { useRealtimeEvent } from '../../hooks/useRealtime';
import { useTabScreenInsets } from '../../hooks/useTabScreenInsets';
import type { AvailableOrdersScreenProps } from '../../navigation/types';
import { deliveryApi, orderApi, shipmentApi } from '../../services/api';
import { colors } from '../../theme/colors';
import type { Order, Shipment } from '../../types';
import { getApiErrorMessage } from '../../utils/apiErrors';
import * as Location from 'expo-location';

type AvailableItem =
  | { kind: 'order'; id: string; order: Order; updatedAt: string }
  | { kind: 'shipment'; id: string; shipment: Shipment; updatedAt: string };

async function syncDriverLocation() {
  try {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') return;
    const position = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.High,
    });
    await deliveryApi.updateLocation(
      position.coords.latitude,
      position.coords.longitude,
    );
  } catch {
    // El GPS se sincronizará en segundo plano
  }
}

export default function AvailableOrdersScreen({ navigation }: AvailableOrdersScreenProps) {
  const { user } = useAuth();
  const { insets, listPaddingBottom } = useTabScreenInsets();
  const { isAvailable, profile, updating, toggleAvailability } = useDriverProfileContext();
  const isApproved = profile?.verification_status === 'approved';
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
      const [ordersRes, shipmentsRes] = await Promise.all([
        orderApi.available(),
        shipmentApi.available(),
      ]);
      const merged: AvailableItem[] = [
        ...ordersRes.data.map((order) => ({
          kind: 'order' as const,
          id: `order-${order.id}`,
          order,
          updatedAt: order.updated_at,
        })),
        ...shipmentsRes.data.map((shipment) => ({
          kind: 'shipment' as const,
          id: `shipment-${shipment.id}`,
          shipment,
          updatedAt: shipment.updated_at,
        })),
      ].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
      setItems(merged);
    } catch (err) {
      setError(getApiErrorMessage(err, 'No se pudieron cargar pedidos'));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
    const interval = setInterval(() => load(true), 45000);
    return () => clearInterval(interval);
  }, [load]);

  useRealtimeEvent(
    'drivers.job',
    useCallback(() => {
      void load(true);
    }, [load]),
  );
  useRealtimeEvent(
    'order.updated',
    useCallback(() => {
      void load(true);
    }, [load]),
  );

  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => load(true));
    return unsubscribe;
  }, [navigation, load]);

  const countLabel = useMemo(() => {
    const count = items.length;
    if (!count) return 'Sin trabajos listos por ahora';
    return `${count} trabajo${count === 1 ? '' : 's'} disponible${count === 1 ? '' : 's'}`;
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
      if (item.kind === 'order') {
        await orderApi.acceptDelivery(item.order.id);
        appAlert('¡Listo!', 'Pedido aceptado');
      } else {
        await shipmentApi.acceptDelivery(item.shipment.id);
        appAlert(
          '¡Listo!',
          item.shipment.kind === 'mandado' ? 'Mandado aceptado' : 'Envío aceptado',
        );
      }
      await syncDriverLocation();
      load(true);
      navigation.navigate('Entregas');
    } catch (err) {
      appAlert('Error', getApiErrorMessage(err, 'No se pudo aceptar'));
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
      error={error && items.length === 0 ? error : null}
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
            <DriverHeroHeader
              topInset={insets.top}
              firstName={user?.first_name}
              eyebrow="Trabajos disponibles"
              subtitle={
                !isApproved
                  ? 'Completa tu validación para recibir pedidos'
                  : isAvailable
                    ? countLabel
                    : 'Activa tu disponibilidad para ver pedidos'
              }
              isAvailable={isAvailable}
            />
            <DriverAvailabilityBanner
              isAvailable={isAvailable}
              isApproved={isApproved}
              updating={updating}
              onToggle={toggleAvailability}
            />
            {hasActiveDelivery ? (
              <View style={styles.activeBanner}>
                <Ionicons name="navigate-circle" size={22} color={colors.shipmentStart} />
                <View style={styles.activeBannerTextWrap}>
                  <Text style={styles.activeBannerTitle}>Tienes una entrega activa</Text>
                  <Text style={styles.activeBannerText}>
                    Continúala en Mis entregas antes de aceptar otra.
                  </Text>
                </View>
              </View>
            ) : null}
            {!isApproved ? (
              <View style={styles.tipBox}>
                <Ionicons name="shield-checkmark-outline" size={20} color={colors.shipmentStart} />
                <Text style={styles.tipText}>
                  Tu cuenta está pendiente de aprobación. Completa foto de perfil e INE en Mi perfil.
                </Text>
              </View>
            ) : !isAvailable ? (
              <View style={styles.tipBox}>
                <Ionicons name="information-circle-outline" size={20} color={colors.shipmentStart} />
                <Text style={styles.tipText}>
                  Pon el interruptor en verde para recibir pedidos y compartir tu ubicación.
                </Text>
              </View>
            ) : null}
            {items.length > 0 ? (
              <SectionHeader title="Cerca de ti" subtitle="Toca una tarjeta para ver detalles" />
            ) : null}
          </>
        }
        renderItem={({ item }) => {
          if (item.kind === 'shipment') {
            const s = item.shipment;
            const isMandado = s.kind === 'mandado';
            return (
              <DriverJobCard
                kind="shipment"
                id={s.id}
                title={isMandado ? `Mandado #${s.id}` : `Envío #${s.id}`}
                subtitle={isMandado ? 'Compra en tienda' : s.size_display}
                lines={[
                  { icon: 'storefront-outline', text: s.pickup_address },
                  { icon: 'location', text: s.delivery_address },
                  ...(s.payment_method === 'cash'
                    ? [{ icon: 'cash-outline' as const, text: 'Cobrar servicio: efectivo' }]
                    : []),
                ]}
                total={s.delivery_fee || s.total}
                onPress={() => navigation.navigate('ShipmentDetail', { shipmentId: s.id })}
                onAccept={() => handleAccept(item)}
                acceptLabel={hasActiveDelivery ? 'Entrega en curso' : isMandado ? 'Aceptar mandado' : 'Aceptar envío'}
                acceptDisabled={!isApproved || !isAvailable || hasActiveDelivery}
                acceptLoading={acceptingId === item.id}
              />
            );
          }
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
                  ? [{ icon: 'cash-outline' as const, text: 'Cobrar: efectivo al entregar' }]
                  : []),
              ]}
              total={order.total}
              onPress={() => navigation.navigate('OrderDetail', { orderId: order.id })}
              onAccept={() => handleAccept(item)}
              acceptLabel={hasActiveDelivery ? 'Entrega en curso' : 'Aceptar pedido'}
              acceptDisabled={!isApproved || !isAvailable || hasActiveDelivery}
              acceptLoading={acceptingId === item.id}
            />
          );
        }}
        ListEmptyComponent={
          !loading ? (
            <EmptyState
              emoji={isAvailable ? '📭' : '⏸️'}
              title={isAvailable ? 'No hay trabajos disponibles' : 'Estás fuera de línea'}
              subtitle={
                isAvailable
                  ? 'Pedidos, envíos y mandados aparecerán aquí automáticamente.'
                  : 'Activa tu disponibilidad para ver trabajos cerca de ti.'
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
  activeBanner: {
    flexDirection: 'row',
    gap: 12,
    backgroundColor: colors.primaryLight,
    borderRadius: 16,
    padding: 14,
    marginBottom: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.primary + '44',
  },
  activeBannerTextWrap: { flex: 1, gap: 2 },
  activeBannerTitle: { fontSize: 14, fontWeight: '800', color: colors.primaryDark },
  activeBannerText: { fontSize: 12, color: colors.textSecondary, lineHeight: 17 },
  tipBox: {
    flexDirection: 'row',
    gap: 10,
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 14,
    marginBottom: 12,
    alignItems: 'flex-start',
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  tipText: { flex: 1, fontSize: 13, color: colors.textSecondary, lineHeight: 18 },
});
