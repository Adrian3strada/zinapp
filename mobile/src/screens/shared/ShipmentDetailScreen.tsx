import Ionicons from '@expo/vector-icons/Ionicons';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useCallback, useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { appAlert } from '../../utils/appAlert';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import Button from '../../components/Button';
import ContactWhatsAppButton from '../../components/ContactWhatsAppButton';
import DeliveryEtaBanner from '../../components/DeliveryEtaBanner';
import DriverNearbyBanner from '../../components/DriverNearbyBanner';
import LiveBadge from '../../components/LiveBadge';
import OrderStatusBadge from '../../components/OrderStatusBadge';
import ScreenContainer from '../../components/ScreenContainer';
import ShipmentMap from '../../components/ShipmentMap';
import ShipmentTimeline from '../../components/ShipmentTimeline';
import TransferPaymentCard from '../../components/TransferPaymentCard';
import { useAuth } from '../../context/AuthContext';
import type { DriverStackParamList, ShipmentDetailScreenProps } from '../../navigation/types';
import { shipmentApi } from '../../services/api';
import { colors } from '../../theme/colors';
import { cardShadow } from '../../theme/shadows';
import type { Shipment } from '../../types';
import { getApiErrorMessage } from '../../utils/apiErrors';
import { formatCurrency } from '../../utils/format';
import {
  shipmentCustomerContactMessage,
  shipmentDriverContactMessage,
} from '../../utils/whatsapp';
import { toCoordinate } from '../../utils/maps';

const ACTIVE_STATUSES = ['pending', 'picked_up', 'on_the_way'];
const STATUS_HINTS: Record<string, string> = {
  pending: 'Buscando repartidor disponible',
  picked_up: 'El repartidor va a recoger tu paquete',
  on_the_way: 'Tu paquete va en camino',
  delivered: 'Envío entregado correctamente',
  cancelled: 'Este envío fue cancelado',
};

export default function ShipmentDetailScreen({ route, navigation }: ShipmentDetailScreenProps) {
  const { shipmentId } = route.params;
  const { user } = useAuth();
  const [shipment, setShipment] = useState<Shipment | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const isDriver = user?.role === 'driver';
  const isCustomer = user?.role === 'customer';
  const isLive = shipment?.status === 'on_the_way';
  const isPickupPhase = shipment?.status === 'picked_up';
  const driverCoord = shipment
    ? toCoordinate(shipment.driver_latitude, shipment.driver_longitude)
    : null;
  const deliveryCoord = shipment
    ? toCoordinate(shipment.delivery_latitude, shipment.delivery_longitude)
    : null;

  const load = useCallback(async () => {
    try {
      const { data } = await shipmentApi.get(shipmentId);
      setShipment(data);
      setError(null);
    } catch (err) {
      setError(getApiErrorMessage(err, 'No se pudo cargar el envío'));
    } finally {
      setLoading(false);
    }
  }, [shipmentId]);

  useEffect(() => {
    load();
    const interval = setInterval(() => {
      if (!shipment || ACTIVE_STATUSES.includes(shipment.status)) {
        load();
      }
    }, isLive ? 2000 : 6000);
    return () => clearInterval(interval);
  }, [load, shipment?.status, isLive]);

  const handleCancel = () => {
    if (!shipment) return;
    appAlert('Cancelar envío', '¿Seguro? Solo puedes cancelar mientras esté pendiente.', [
      { text: 'No', style: 'cancel' },
      {
        text: 'Sí, cancelar',
        style: 'destructive',
        onPress: async () => {
          try {
            const { data } = await shipmentApi.cancel(shipment.id);
            setShipment(data);
          } catch (err) {
            appAlert('Error', getApiErrorMessage(err, 'No se pudo cancelar.'));
          }
        },
      },
    ]);
  };

  const handleDelivered = async () => {
    if (!shipment) return;
    try {
      const { data } = await shipmentApi.markDelivered(shipment.id);
      setShipment(data);
    } catch (err) {
      appAlert('Error', getApiErrorMessage(err, 'No se pudo marcar entregado.'));
    }
  };

  const handlePickedUp = async () => {
    if (!shipment) return;
    try {
      const { data } = await shipmentApi.markPickedUp(shipment.id);
      setShipment(data);
    } catch (err) {
      appAlert('Error', getApiErrorMessage(err, 'No se pudo marcar recogido.'));
    }
  };

  const openDriverMap = () => {
    const driverNav = navigation as NativeStackNavigationProp<DriverStackParamList>;
    driverNav.navigate('DriverMap', { shipmentId: shipment!.id });
  };

  if (!shipment && !loading && !error) return null;

  return (
    <ScreenContainer loading={loading} error={error} onRetry={load}>
      {shipment && (
        <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
          <LinearGradient colors={['#2A9D8F', '#264653']} style={styles.hero}>
            <Text style={styles.heroSize}>{shipment.size_display}</Text>
            <Text style={styles.heroTitle}>Envío #{shipment.id}</Text>
            <Text style={styles.heroDesc}>{shipment.description}</Text>
            <View style={styles.heroBadges}>
              <OrderStatusBadge status={shipment.status} label={shipment.status_display} large />
              {isLive && <LiveBadge />}
            </View>
            {STATUS_HINTS[shipment.status] && (
              <Text style={styles.heroHint}>{STATUS_HINTS[shipment.status]}</Text>
            )}
          </LinearGradient>

          {isCustomer && isLive && shipment.driver_detail?.phone && (
            <View style={styles.inlineBanner}>
              <ContactWhatsAppButton
                phone={shipment.driver_detail.phone}
                message={shipmentDriverContactMessage(shipment.id)}
                label="WhatsApp al repartidor"
              />
            </View>
          )}

          {isCustomer && isLive && (
            <View style={styles.inlineBanner}>
              <DriverNearbyBanner driver={driverCoord} destination={deliveryCoord} />
              <DeliveryEtaBanner
                from={driverCoord}
                to={deliveryCoord}
                label="Llegada estimada"
              />
            </View>
          )}

          <View style={[styles.card, styles.timelineCard]}>
            <Text style={styles.section}>Seguimiento</Text>
            <ShipmentTimeline status={shipment.status} />
          </View>

          {shipment.status !== 'cancelled' && (
            <View style={styles.card}>
              <Text style={styles.section}>Mapa del envío</Text>
              <ShipmentMap
                shipment={shipment}
                followDriver={(isLive && (isCustomer || isDriver)) || (isPickupPhase && isDriver)}
              />
            </View>
          )}

          <View style={styles.card}>
            <Text style={styles.section}>Ruta</Text>
            <View style={styles.routeBlock}>
              <View style={styles.routeRow}>
                <View style={[styles.routeDot, { backgroundColor: '#E76F51' }]}>
                  <Ionicons name="cube" size={16} color="#FFF" />
                </View>
                <View style={styles.routeText}>
                  <Text style={styles.label}>Recoger en</Text>
                  <Text style={styles.value}>{shipment.pickup_address}</Text>
                  {!!shipment.pickup_notes && (
                    <Text style={styles.subValue}>{shipment.pickup_notes}</Text>
                  )}
                </View>
              </View>
              <View style={styles.routeLine} />
              <View style={styles.routeRow}>
                <View style={[styles.routeDot, { backgroundColor: colors.success }]}>
                  <Ionicons name="location" size={16} color="#FFF" />
                </View>
                <View style={styles.routeText}>
                  <Text style={styles.label}>Entregar en</Text>
                  <Text style={styles.value}>{shipment.delivery_address}</Text>
                </View>
              </View>
            </View>
            {!!shipment.delivery_notes && (
              <View style={styles.notesBox}>
                <Ionicons name="chatbubble-outline" size={16} color={colors.primary} />
                <Text style={styles.notesText}>{shipment.delivery_notes}</Text>
              </View>
            )}
          </View>

          <View style={styles.card}>
            <Text style={styles.section}>Resumen</Text>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Tamaño</Text>
              <Text style={styles.summaryValue}>{shipment.size_display}</Text>
            </View>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Contenido</Text>
              <Text style={styles.summaryValue}>{shipment.description}</Text>
            </View>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Pago</Text>
              <Text style={styles.summaryValue}>{shipment.payment_method_display}</Text>
            </View>
            <View style={[styles.summaryRow, styles.totalRow]}>
              <Text style={styles.totalLabel}>Total</Text>
              <Text style={styles.totalValue}>{formatCurrency(shipment.total)}</Text>
            </View>
            {shipment.payment_method === 'transfer' && shipment.status !== 'delivered' && (
              <TransferPaymentCard orderId={shipment.id} total={shipment.total} compact kind="shipment" />
            )}
          </View>

          {shipment.driver_detail && (
            <View style={styles.card}>
              <View style={styles.driverRow}>
                <View style={styles.driverAvatar}>
                  <Ionicons name="bicycle" size={22} color={colors.primary} />
                </View>
                <View>
                  <Text style={styles.label}>Repartidor</Text>
                  <Text style={styles.value}>
                    {shipment.driver_detail.first_name || shipment.driver_detail.username}
                  </Text>
                </View>
              </View>
            </View>
          )}

          {isDriver && (isLive || isPickupPhase) && shipment.customer_detail?.phone && (
            <View style={styles.card}>
              <ContactWhatsAppButton
                phone={shipment.customer_detail.phone}
                message={shipmentCustomerContactMessage(shipment.id)}
                label="WhatsApp al cliente"
              />
            </View>
          )}

          {isCustomer && shipment.status === 'pending' && (
            <View style={styles.card}>
              <Button title="Cancelar envío" variant="danger" onPress={handleCancel} />
            </View>
          )}

          {isDriver && shipment.status === 'picked_up' && shipment.driver === user?.id && (
            <View style={styles.card}>
              <Button title="Abrir mapa de navegación" variant="secondary" onPress={openDriverMap} />
              <Button title="Marcar recogido" onPress={handlePickedUp} />
            </View>
          )}

          {isDriver && shipment.status === 'on_the_way' && shipment.driver === user?.id && (
            <View style={styles.card}>
              <Button title="Abrir mapa de navegación" variant="secondary" onPress={openDriverMap} />
              <Button title="Marcar entregado" onPress={handleDelivered} />
            </View>
          )}
        </ScrollView>
      )}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  container: { paddingBottom: 32 },
  hero: { padding: 24, gap: 8 },
  heroSize: { fontSize: 13, fontWeight: '700', color: 'rgba(255,255,255,0.85)', textTransform: 'uppercase' },
  heroTitle: { fontSize: 26, fontWeight: '800', color: '#FFF' },
  heroDesc: { fontSize: 15, color: 'rgba(255,255,255,0.9)', fontWeight: '500' },
  heroBadges: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, alignItems: 'center', marginTop: 4 },
  heroHint: { fontSize: 13, color: 'rgba(255,255,255,0.9)', fontWeight: '500', marginTop: 4 },
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
  routeBlock: { gap: 0 },
  routeRow: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  routeDot: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  routeLine: {
    width: 2,
    height: 20,
    backgroundColor: colors.border,
    marginLeft: 15,
    marginVertical: 4,
  },
  routeText: { flex: 1, paddingBottom: 4 },
  label: { fontSize: 11, color: colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.5 },
  value: { fontSize: 15, color: colors.text, fontWeight: '600', marginTop: 2, lineHeight: 21 },
  subValue: { fontSize: 13, color: colors.textSecondary, marginTop: 4, lineHeight: 18 },
  notesBox: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
    padding: 12,
    backgroundColor: colors.primaryLight,
    borderRadius: 10,
  },
  notesText: { flex: 1, fontSize: 13, color: colors.textSecondary, lineHeight: 18 },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 8, gap: 12 },
  summaryLabel: { color: colors.textSecondary, flex: 1 },
  summaryValue: { fontWeight: '600', color: colors.text, flex: 1, textAlign: 'right' },
  totalRow: { marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: colors.border },
  totalLabel: { fontSize: 18, fontWeight: '800', color: colors.text },
  totalValue: { fontSize: 18, fontWeight: '800', color: colors.primary },
  driverRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  driverAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
