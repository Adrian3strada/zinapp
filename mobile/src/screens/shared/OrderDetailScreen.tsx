import Ionicons from '@expo/vector-icons/Ionicons';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useCallback, useEffect, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, View } from 'react-native';

import Button from '../../components/Button';
import ContactWhatsAppButton from '../../components/ContactWhatsAppButton';
import DeliveryEtaBanner from '../../components/DeliveryEtaBanner';
import DriverNearbyBanner from '../../components/DriverNearbyBanner';
import LiveBadge from '../../components/LiveBadge';
import OrderMap from '../../components/OrderMap';
import OrderStatusBadge from '../../components/OrderStatusBadge';
import OrderTimeline from '../../components/OrderTimeline';
import ReviewForm from '../../components/ReviewForm';
import ScreenContainer from '../../components/ScreenContainer';
import TransferPaymentCard from '../../components/TransferPaymentCard';
import { resolveTransferInfo } from '../../config/payments';
import { useAuth } from '../../context/AuthContext';
import type { DriverStackParamList, OrderDetailScreenProps } from '../../navigation/types';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { orderApi } from '../../services/api';
import { colors } from '../../theme/colors';
import { cardShadow } from '../../theme/shadows';
import type { Order, OrderStatus } from '../../types';
import { getApiErrorMessage } from '../../utils/apiErrors';
import { formatCurrency } from '../../utils/format';
import {
  customerContactMessage,
  driverContactMessage,
} from '../../utils/whatsapp';
import { getRestaurantVisual } from '../../utils/foodVisuals';
import { toCoordinate } from '../../utils/maps';
import FoodImage from '../../components/FoodImage';

const ACTIVE_STATUSES = ['pending', 'accepted', 'preparing', 'ready', 'on_the_way'];
const CUSTOMER_CANCELLABLE = ['pending', 'accepted', 'preparing'];
const STATUS_HINTS: Partial<Record<OrderStatus, string>> = {
  pending: 'Esperando confirmación del restaurante',
  accepted: 'El restaurante confirmó tu pedido',
  preparing: 'Tu pedido se está preparando',
  ready: 'Listo para recoger — buscando repartidor',
  on_the_way: 'Tu repartidor va en camino',
  delivered: 'Pedido entregado',
  cancelled: 'Pedido cancelado',
};
const TRACKING_POLL_MS = 2000;
const DEFAULT_POLL_MS = 6000;

const RESTAURANT_NEXT_STATUS: Record<string, { status: string; label: string }> = {
  accepted: { status: 'preparing', label: 'Marcar preparando' },
  preparing: { status: 'ready', label: 'Listo para recoger' },
};

export default function OrderDetailScreen({ route, navigation }: OrderDetailScreenProps) {
  const { orderId } = route.params;
  const promptReview = 'promptReview' in route.params ? route.params.promptReview : false;
  const { user } = useAuth();
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (isMounted: () => boolean) => {
    try {
      const { data } = await orderApi.get(orderId);
      if (isMounted()) {
        setOrder(data);
        setError(null);
      }
    } catch (err) {
      if (isMounted()) {
        setError(getApiErrorMessage(err, 'No se pudo cargar el pedido'));
      }
    } finally {
      if (isMounted()) setLoading(false);
    }
  }, [orderId]);

  const isLiveTracking = order?.status === 'on_the_way' && !!order.driver;
  const pollMs = isLiveTracking ? TRACKING_POLL_MS : DEFAULT_POLL_MS;

  useEffect(() => {
    let mounted = true;
    const isMounted = () => mounted;

    load(isMounted);
    const interval = setInterval(() => {
      if (!order || ACTIVE_STATUSES.includes(order.status)) {
        load(isMounted);
      }
    }, pollMs);

    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, [load, order?.status, pollMs]);

  const handleCancel = useCallback(() => {
    if (!order) return;
    Alert.alert(
      'Cancelar pedido',
      '¿Seguro que quieres cancelar? Solo puedes hacerlo antes de que esté listo para recoger.',
      [
        { text: 'No', style: 'cancel' },
        {
          text: 'Sí, cancelar',
          style: 'destructive',
          onPress: async () => {
            try {
              const { data } = await orderApi.cancel(order.id);
              setOrder(data);
            } catch (err) {
              Alert.alert('Error', getApiErrorMessage(err, 'No se pudo cancelar el pedido.'));
            }
          },
        },
      ],
    );
  }, [order]);

  const reloadOrder = useCallback(() => {
    load(() => true);
  }, [load]);

  const handleRestaurantAccept = useCallback(async () => {
    if (!order) return;
    try {
      await orderApi.accept(order.id);
      reloadOrder();
    } catch (err) {
      Alert.alert('Error', getApiErrorMessage(err, 'No se pudo aceptar'));
    }
  }, [order, reloadOrder]);

  const handleRestaurantReject = useCallback(() => {
    if (!order) return;
    Alert.alert('Rechazar pedido', '¿Seguro que quieres rechazar este pedido?', [
      { text: 'No', style: 'cancel' },
      {
        text: 'Rechazar',
        style: 'destructive',
        onPress: async () => {
          try {
            await orderApi.reject(order.id);
            reloadOrder();
          } catch (err) {
            Alert.alert('Error', getApiErrorMessage(err, 'No se pudo rechazar'));
          }
        },
      },
    ]);
  }, [order, reloadOrder]);

  const handleRestaurantAdvance = useCallback(async () => {
    if (!order) return;
    const next = RESTAURANT_NEXT_STATUS[order.status];
    if (!next) return;
    try {
      await orderApi.updateStatus(order.id, next.status);
      reloadOrder();
    } catch (err) {
      Alert.alert('Error', getApiErrorMessage(err, 'No se pudo actualizar'));
    }
  }, [order, reloadOrder]);

  if (!order && !loading && !error) return null;

  const visual = getRestaurantVisual(order?.restaurant_detail?.name ?? '');

  return (
    <ScreenContainer
      loading={loading}
      error={error}
      onRetry={() => {
        setLoading(true);
        load(() => true);
      }}
    >
      {order && (
        <ScrollView contentContainerStyle={styles.container}>
          <LinearGradient
            colors={[colors.gradientStart, colors.gradientEnd]}
            style={styles.hero}
          >
            <Text style={styles.heroRestaurant}>{order.restaurant_detail?.name}</Text>
            <Text style={styles.heroTitle}>Pedido #{order.id}</Text>
            <View style={styles.heroBadges}>
              <OrderStatusBadge
                status={order.status}
                label={order.status_display}
                large
              />
              {isLiveTracking && <LiveBadge />}
            </View>
            {STATUS_HINTS[order.status] && (
              <Text style={styles.heroEta}>{STATUS_HINTS[order.status]}</Text>
            )}
          </LinearGradient>

          {user?.role === 'customer' && isLiveTracking && (
            <View style={styles.inlineBanner}>
              <DriverNearbyBanner
                driver={toCoordinate(order.driver_latitude, order.driver_longitude)}
                destination={toCoordinate(order.delivery_latitude, order.delivery_longitude)}
              />
              <DeliveryEtaBanner
                from={toCoordinate(order.driver_latitude, order.driver_longitude)}
                to={toCoordinate(order.delivery_latitude, order.delivery_longitude)}
                label="Llegada estimada"
              />
            </View>
          )}

          <View style={[styles.card, styles.timelineCard]}>
            <Text style={styles.section}>Seguimiento</Text>
            <OrderTimeline currentStatus={order.status} />
          </View>

          {user?.role === 'customer' &&
            order.payment_method === 'transfer' &&
            order.status !== 'delivered' &&
            order.status !== 'cancelled' && (
              <View style={styles.card}>
                <TransferPaymentCard
                  orderId={order.id}
                  total={order.total}
                  transferInfo={resolveTransferInfo(order.restaurant_detail)}
                />
              </View>
            )}

          <View style={styles.card}>
            <Text style={styles.section}>Mapa del pedido</Text>
            <OrderMap
              order={order}
              trackDriver={user?.role === 'customer' || user?.role === 'admin'}
            />
          </View>

          <View style={styles.card}>
            <View style={styles.restaurantRow}>
              <FoodImage emoji={visual.emoji} color={visual.color} size="sm" />
              <View>
                <Text style={styles.label}>Restaurante</Text>
                <Text style={styles.value}>{order.restaurant_detail?.name}</Text>
              </View>
            </View>
            {order.delivery_notes ? (
              <View style={styles.infoRow}>
                <Ionicons name="chatbubble-outline" size={18} color={colors.primary} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.label}>Notas</Text>
                  <Text style={styles.value}>{order.delivery_notes}</Text>
                </View>
              </View>
            ) : null}
            <View style={styles.infoRow}>
              <Ionicons name="location-outline" size={18} color={colors.primary} />
              <View style={{ flex: 1 }}>
                <Text style={styles.label}>Dirección</Text>
                <Text style={styles.value}>{order.delivery_address}</Text>
              </View>
            </View>
            <View style={styles.infoRow}>
              <Ionicons name="wallet-outline" size={18} color={colors.primary} />
              <View>
                <Text style={styles.label}>Pago</Text>
                <Text style={styles.value}>{order.payment_method_display}</Text>
              </View>
            </View>
          </View>

          <View style={styles.card}>
            <Text style={styles.section}>Resumen</Text>
            {order.items.map((item) => (
              <View key={item.id} style={styles.item}>
                <Text style={styles.itemName}>
                  {item.quantity}x {item.product_detail.name}
                </Text>
                <Text style={styles.itemPrice}>{formatCurrency(item.subtotal)}</Text>
              </View>
            ))}
            <View style={styles.row}>
              <Text style={styles.rowLabel}>Subtotal</Text>
              <Text>{formatCurrency(order.subtotal)}</Text>
            </View>
            <View style={styles.row}>
              <Text style={styles.rowLabel}>Envío</Text>
              <Text>{formatCurrency(order.delivery_fee)}</Text>
            </View>
            {order.discount_amount && parseFloat(order.discount_amount) > 0 && (
              <View style={styles.row}>
                <Text style={styles.rowLabel}>Descuento</Text>
                <Text style={{ color: colors.success }}>-{formatCurrency(order.discount_amount)}</Text>
              </View>
            )}
            <View style={[styles.row, styles.totalRow]}>
              <Text style={styles.totalLabel}>Total</Text>
              <Text style={styles.totalValue}>{formatCurrency(order.total)}</Text>
            </View>
          </View>

          {user?.role === 'restaurant' && ['pending', 'accepted', 'preparing'].includes(order.status) && (
            <View style={styles.card}>
              <Text style={styles.section}>Gestionar pedido</Text>
              {order.status === 'pending' && (
                <View style={styles.restaurantActions}>
                  <Button title="Aceptar pedido" onPress={handleRestaurantAccept} style={styles.restaurantBtn} />
                  <Button title="Rechazar" variant="danger" onPress={handleRestaurantReject} style={styles.restaurantBtn} />
                </View>
              )}
              {RESTAURANT_NEXT_STATUS[order.status] && (
                <Button
                  title={RESTAURANT_NEXT_STATUS[order.status].label}
                  onPress={handleRestaurantAdvance}
                />
              )}
            </View>
          )}

          {user?.role === 'customer' && CUSTOMER_CANCELLABLE.includes(order.status) && (
            <View style={styles.card}>
              <Button title="Cancelar pedido" variant="danger" onPress={handleCancel} />
            </View>
          )}

          {user?.role === 'driver' && order.status === 'on_the_way' && (
            <View style={styles.card}>
              <Button
                title="Abrir mapa de navegación"
                onPress={() => {
                  const driverNav = navigation as NativeStackNavigationProp<DriverStackParamList>;
                  driverNav.navigate('DriverMap', { orderId: order.id });
                }}
              />
            </View>
          )}

          {user?.role === 'customer' && order.status === 'delivered' && !order.review && (
            <View style={styles.card}>
              {promptReview && (
                <Text style={styles.reviewPrompt}>¡Gracias! Cuéntanos cómo estuvo tu experiencia.</Text>
              )}
              <ReviewForm
                orderId={order.id}
                hasDriver={!!order.driver}
                onSubmitted={() => load(() => true)}
              />
            </View>
          )}

          {user?.role === 'customer' && order.status === 'on_the_way' && order.driver_detail?.phone && (
            <View style={styles.card}>
              <ContactWhatsAppButton
                phone={order.driver_detail.phone}
                message={driverContactMessage(order.id, order.restaurant_detail?.name ?? 'restaurante')}
                label="WhatsApp al repartidor"
              />
            </View>
          )}

          {user?.role === 'driver' && order.status === 'on_the_way' && order.customer_detail?.phone && (
            <View style={styles.card}>
              <ContactWhatsAppButton
                phone={order.customer_detail.phone}
                message={customerContactMessage(order.id)}
                label="WhatsApp al cliente"
              />
            </View>
          )}
        </ScrollView>
      )}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  container: { paddingBottom: 32 },
  hero: { padding: 24, gap: 10 },
  heroRestaurant: { fontSize: 14, fontWeight: '600', color: 'rgba(255,255,255,0.85)' },
  heroTitle: { fontSize: 26, fontWeight: '800', color: '#FFF' },
  heroBadges: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, alignItems: 'center' },
  heroEta: { fontSize: 13, color: 'rgba(255,255,255,0.9)', fontWeight: '500' },
  inlineBanner: { marginHorizontal: 16, marginTop: 12 },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 16,
    marginHorizontal: 16,
    marginTop: 16,
    ...cardShadow,
  },
  timelineCard: { marginTop: -12 },
  section: { fontSize: 17, fontWeight: '800', color: colors.text, marginBottom: 12 },
  restaurantRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 16 },
  infoRow: { flexDirection: 'row', gap: 12, marginBottom: 14 },
  label: { fontSize: 11, color: colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.5 },
  value: { fontSize: 15, color: colors.text, fontWeight: '600', marginTop: 2 },
  item: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  itemName: { fontSize: 15, color: colors.text },
  itemPrice: { fontWeight: '600', color: colors.text },
  row: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 },
  rowLabel: { color: colors.textSecondary },
  totalRow: { marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: colors.border },
  totalLabel: { fontSize: 18, fontWeight: '800' },
  totalValue: { fontSize: 18, fontWeight: '800', color: colors.primary },
  restaurantActions: { flexDirection: 'row', gap: 10, marginBottom: 12 },
  restaurantBtn: { flex: 1 },
  reviewPrompt: { fontSize: 14, color: colors.textSecondary, marginBottom: 12, lineHeight: 20 },
});
