import Ionicons from '@expo/vector-icons/Ionicons';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { appAlert } from '../../utils/appAlert';
import { useTabScreenInsets } from '../../hooks/useTabScreenInsets';
import Button from '../../components/Button';
import EmptyState from '../../components/EmptyState';
import FormField from '../../components/FormField';
import FormSection from '../../components/FormSection';
import RoutePreviewMap from '../../components/RoutePreviewMap';
import ShipmentAddressBlock from '../../components/ShipmentAddressBlock';
import ShipmentCard from '../../components/ShipmentCard';
import ScreenContainer from '../../components/ScreenContainer';
import TransferPaymentCard from '../../components/TransferPaymentCard';
import { useAuth } from '../../context/AuthContext';
import { getShipmentFee, MIN_SHIPMENT_FEE, SHIPMENT_SIZES } from '../../config/delivery';
import { useAppConfig } from '../../hooks/useAppConfig';
import { useLocation } from '../../hooks/useLocation';
import type { ShipmentsScreenProps } from '../../navigation/types';
import { restaurantApi, shipmentApi } from '../../services/api';
import { colors } from '../../theme/colors';
import { spacing } from '../../theme/spacing';
import { cardShadow } from '../../theme/shadows';
import type { Shipment, ShipmentSize } from '../../types';
import { dedupeById } from '../../hooks/usePaginatedList';
import { createIdempotencyKey } from '../../utils/idempotency';
import { runWithRetry } from '../../utils/runWithRetry';
import { formatCurrency } from '../../utils/format';
import { getApiErrorMessage } from '../../utils/apiErrors';

type AddressField = 'pickup' | 'delivery';

const PAYMENT_OPTIONS_BASE = [
  { key: 'cash' as const, label: 'Efectivo', icon: 'cash-outline' as const },
  { key: 'transfer' as const, label: 'Transferencia', icon: 'card-outline' as const },
];

export default function ShipmentsScreen({ navigation }: ShipmentsScreenProps) {
  const { scrollPaddingBottom } = useTabScreenInsets();
  const { user } = useAuth();
  const { config: appConfig } = useAppConfig();
  const { getCurrentPosition, loading: locating } = useLocation();

  const paymentOptions = useMemo(() => {
    if (appConfig.online_payments_enabled) {
      return [
        ...PAYMENT_OPTIONS_BASE,
        { key: 'online' as const, label: 'En línea', icon: 'phone-portrait-outline' as const },
      ];
    }
    return PAYMENT_OPTIONS_BASE;
  }, [appConfig.online_payments_enabled]);

  const [description, setDescription] = useState('');
  const [size, setSize] = useState<ShipmentSize>('medium');
  const [pickupAddress, setPickupAddress] = useState(user?.address ?? '');
  const [deliveryAddress, setDeliveryAddress] = useState('');
  const [pickupNotes, setPickupNotes] = useState('');
  const [deliveryNotes, setDeliveryNotes] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'transfer' | 'online'>('cash');
  const [pickupCoords, setPickupCoords] = useState<{ latitude: number; longitude: number } | null>(null);
  const [deliveryCoords, setDeliveryCoords] = useState<{ latitude: number; longitude: number } | null>(null);
  const [pickupCoverageOk, setPickupCoverageOk] = useState<boolean | null>(null);
  const [deliveryCoverageOk, setDeliveryCoverageOk] = useState<boolean | null>(null);
  const [pickupApproximate, setPickupApproximate] = useState(false);
  const [deliveryApproximate, setDeliveryApproximate] = useState(false);
  const [geocodingField, setGeocodingField] = useState<AddressField | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [shipments, setShipments] = useState<Shipment[]>([]);
  const [loadingList, setLoadingList] = useState(true);
  const [listError, setListError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const submitInFlight = useRef(false);
  const submitIdempotencyKey = useRef<string | null>(null);

  const shipmentFee = getShipmentFee(size);
  const activeShipments = useMemo(
    () => shipments.filter((s) => ['pending', 'picked_up', 'on_the_way'].includes(s.status)).length,
    [shipments],
  );

  const loadShipments = useCallback(async (silent = false) => {
    if (!silent) setLoadingList(true);
    try {
      const { data } = await shipmentApi.list();
      setShipments(dedupeById(data.results ?? []));
      setListError(null);
    } catch (err) {
      if (shipments.length === 0) {
        setShipments([]);
      }
      setListError(getApiErrorMessage(err, 'No se pudieron cargar tus envíos'));
    } finally {
      setLoadingList(false);
      setRefreshing(false);
    }
  }, [shipments.length]);

  useEffect(() => {
    loadShipments();
  }, [loadShipments]);

  useEffect(() => {
    if (!appConfig.online_payments_enabled && paymentMethod === 'online') {
      setPaymentMethod('cash');
    }
  }, [appConfig.online_payments_enabled, paymentMethod]);

  const handleAddressChange = (field: AddressField, text: string) => {
    if (field === 'pickup') {
      setPickupAddress(text);
      setPickupCoords(null);
      setPickupCoverageOk(null);
      setPickupApproximate(false);
    } else {
      setDeliveryAddress(text);
      setDeliveryCoords(null);
      setDeliveryCoverageOk(null);
      setDeliveryApproximate(false);
    }
  };

  const checkCoverage = async (
    coord: { latitude: number; longitude: number },
    field: AddressField,
  ) => {
    try {
      const { data } = await restaurantApi.checkCoverage(coord.latitude, coord.longitude);
      if (field === 'pickup') setPickupCoverageOk(data.in_coverage);
      else setDeliveryCoverageOk(data.in_coverage);
    } catch {
      if (field === 'pickup') setPickupCoverageOk(null);
      else setDeliveryCoverageOk(null);
    }
  };

  const handleGeocode = async (field: AddressField) => {
    const address = field === 'pickup' ? pickupAddress : deliveryAddress;
    if (!address.trim()) {
      appAlert('Dirección', 'Escribe una dirección primero.');
      return;
    }
    setGeocodingField(field);
    try {
      const { data } = await restaurantApi.geocode(address);
      const coord = { latitude: data.latitude, longitude: data.longitude };
      if (field === 'pickup') {
        setPickupCoords(coord);
        setPickupAddress(data.display_name);
        setPickupCoverageOk(data.in_coverage);
        setPickupApproximate(!!data.approximate);
      } else {
        setDeliveryCoords(coord);
        setDeliveryAddress(data.display_name);
        setDeliveryCoverageOk(data.in_coverage);
        setDeliveryApproximate(!!data.approximate);
      }
      if (data.approximate) {
        appAlert(
          'Ubicación aproximada',
          'Encontramos la calle o colonia, pero no el número exacto. Confirma que la dirección sea correcta, o usa «Mi ubicación».',
        );
      } else if (!data.in_coverage) {
        appAlert('Fuera de cobertura', 'Esta dirección está fuera de Zinapécuaro.');
      }
    } catch (err) {
      appAlert('Geocodificación', getApiErrorMessage(err, 'No se encontró la dirección.'));
    } finally {
      setGeocodingField(null);
    }
  };

  const handleUseLocation = async (field: AddressField) => {
    const coords = await getCurrentPosition();
    if (!coords) {
      appAlert('Ubicación', 'Activa el permiso de ubicación.');
      return;
    }
    if (field === 'pickup') {
      setPickupCoords(coords);
      setPickupApproximate(false);
      if (!pickupAddress.trim()) setPickupAddress('Mi ubicación (recogida)');
    } else {
      setDeliveryCoords(coords);
      setDeliveryApproximate(false);
      if (!deliveryAddress.trim()) setDeliveryAddress('Mi ubicación (entrega)');
    }
    await checkCoverage(coords, field);
  };

  const resolveCoords = async (field: AddressField, address: string) => {
    const { data } = await restaurantApi.geocode(address);
    const coord = { latitude: data.latitude, longitude: data.longitude };
    if (field === 'pickup') {
      setPickupCoords(coord);
      setPickupAddress(data.display_name);
      setPickupCoverageOk(data.in_coverage);
      setPickupApproximate(!!data.approximate);
    } else {
      setDeliveryCoords(coord);
      setDeliveryAddress(data.display_name);
      setDeliveryCoverageOk(data.in_coverage);
      setDeliveryApproximate(!!data.approximate);
    }
    return { coord, inCoverage: data.in_coverage, approximate: !!data.approximate };
  };

  const handleSubmit = async () => {
    if (submitInFlight.current || submitting) return;
    if (!description.trim()) {
      appAlert('Descripción', 'Indica qué vas a enviar.');
      return;
    }
    if (!pickupAddress.trim() || !deliveryAddress.trim()) {
      appAlert('Direcciones', 'Completa recogida y entrega.');
      return;
    }

    submitInFlight.current = true;
    setSubmitting(true);
    if (!submitIdempotencyKey.current) {
      submitIdempotencyKey.current = createIdempotencyKey();
    }
    try {
      let pickup = pickupCoords;
      let delivery = deliveryCoords;
      let pickupOk = pickupCoverageOk;
      let deliveryOk = deliveryCoverageOk;

      if (!pickup) {
        const result = await resolveCoords('pickup', pickupAddress);
        pickup = result.coord;
        pickupOk = result.inCoverage;
      }
      if (!delivery) {
        const result = await resolveCoords('delivery', deliveryAddress);
        delivery = result.coord;
        deliveryOk = result.inCoverage;
      }

      if (pickupOk === false || deliveryOk === false) {
        appAlert('Cobertura', 'Ambas direcciones deben estar dentro de Zinapécuaro.');
        return;
      }

      const { data } = await runWithRetry(() =>
        shipmentApi.create({
          description: description.trim(),
          size,
          pickup_address: pickupAddress,
          pickup_latitude: pickup!.latitude,
          pickup_longitude: pickup!.longitude,
          pickup_notes: pickupNotes.trim(),
          delivery_address: deliveryAddress,
          delivery_latitude: delivery!.latitude,
          delivery_longitude: delivery!.longitude,
          delivery_notes: deliveryNotes.trim(),
          payment_method: paymentMethod,
        }, { idempotencyKey: submitIdempotencyKey.current! }),
      );
      submitIdempotencyKey.current = null;
      appAlert('¡Listo!', `Envío #${data.id} registrado. Buscando repartidor…`);
      setDescription('');
      setDeliveryAddress('');
      setPickupNotes('');
      setDeliveryNotes('');
      setDeliveryCoords(null);
      setDeliveryCoverageOk(null);
      loadShipments(true);
      navigation.navigate('ShipmentDetail', { shipmentId: data.id });
    } catch (err) {
      appAlert('Error', getApiErrorMessage(err, 'No se pudo crear el envío. Verifica las direcciones.'));
    } finally {
      submitInFlight.current = false;
      setSubmitting(false);
    }
  };

  return (
    <ScreenContainer>
      <ScrollView
        contentContainerStyle={[
          styles.container,
          scrollPaddingBottom(),
        ]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              loadShipments(true);
            }}
            tintColor={colors.primary}
          />
        }
      >
        <LinearGradient
          colors={[colors.shipmentStart, colors.shipmentEnd]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.hero}
        >
          <View style={styles.heroIcon}>
            <Text style={styles.heroEmoji}>📦</Text>
          </View>
          <Text style={styles.heroTitle}>Envía desde tu casa</Text>
          <Text style={styles.heroSub}>
            Paquetes dentro de Zinapécuaro · desde {formatCurrency(MIN_SHIPMENT_FEE)}
          </Text>
          <View style={styles.pricePills}>
            {SHIPMENT_SIZES.map((s) => (
              <View key={s.key} style={styles.pricePill}>
                <Text style={styles.pricePillLabel}>{s.label}</Text>
                <Text style={styles.pricePillFee}>{formatCurrency(s.fee)}</Text>
              </View>
            ))}
          </View>
        </LinearGradient>

        <FormSection title="Tu paquete" hint="Describe qué envías y elige el tamaño">
          <FormField
            label="¿Qué envías?"
            value={description}
            onChangeText={setDescription}
            icon="cube-outline"
            embedded
            placeholder="Ej. Documentos, caja pequeña, regalo…"
          />
          <View style={styles.sizeList}>
            {SHIPMENT_SIZES.map((option) => {
              const selected = size === option.key;
              return (
                <Pressable
                  key={option.key}
                  style={[styles.sizeCard, selected && styles.sizeCardActive]}
                  onPress={() => setSize(option.key)}
                >
                  <Text style={styles.sizeEmoji}>{option.emoji}</Text>
                  <View style={styles.sizeInfo}>
                    <Text style={[styles.sizeLabel, selected && styles.sizeLabelActive]}>
                      {option.label}
                    </Text>
                    <Text style={styles.sizeHint}>{option.hint}</Text>
                  </View>
                  <Text style={[styles.sizeFee, selected && styles.sizeFeeActive]}>
                    {formatCurrency(option.fee)}
                  </Text>
                  {selected && (
                    <Ionicons name="checkmark-circle" size={22} color={colors.primary} />
                  )}
                </Pressable>
              );
            })}
          </View>
        </FormSection>

        <FormSection title="Ruta del envío" hint="Indica dónde recogemos y a dónde lo llevamos">
          <ShipmentAddressBlock
            title="Recoger en"
            fieldLabel="Dirección de recogida"
            icon="home-outline"
            placeholder="Calle, número, colonia"
            value={pickupAddress}
            onChangeText={(t) => handleAddressChange('pickup', t)}
            onGeocode={() => handleGeocode('pickup')}
            onUseLocation={() => handleUseLocation('pickup')}
            geocoding={geocodingField === 'pickup'}
            locating={locating}
            coverageOk={pickupCoverageOk}
            approximate={pickupApproximate}
          />

          <View style={styles.routeArrow}>
            <Ionicons name="arrow-down" size={20} color={colors.textMuted} />
          </View>

          <ShipmentAddressBlock
            title="Entregar en"
            fieldLabel="Dirección de entrega"
            icon="navigate-outline"
            placeholder="Destino del paquete"
            value={deliveryAddress}
            onChangeText={(t) => handleAddressChange('delivery', t)}
            onGeocode={() => handleGeocode('delivery')}
            onUseLocation={() => handleUseLocation('delivery')}
            geocoding={geocodingField === 'delivery'}
            locating={locating}
            coverageOk={deliveryCoverageOk}
            approximate={deliveryApproximate}
          />

          {pickupCoords && deliveryCoords && (
            <RoutePreviewMap from={pickupCoords} to={deliveryCoords} />
          )}

          <FormField
            label="Notas de recogida (opcional)"
            value={pickupNotes}
            onChangeText={setPickupNotes}
            icon="home-outline"
            embedded
            multiline
            placeholder="Referencias en el punto de recogida…"
          />
          <FormField
            label="Notas de entrega"
            value={deliveryNotes}
            onChangeText={setDeliveryNotes}
            icon="chatbubble-outline"
            embedded
            multiline
            placeholder="Referencias, timbre, horario…"
          />
        </FormSection>

        <FormSection title="Pago">
          <View style={styles.paymentRow}>
            {paymentOptions.map((method) => {
              const selected = paymentMethod === method.key;
              return (
                <Pressable
                  key={method.key}
                  style={[styles.paymentChip, selected && styles.paymentChipActive]}
                  onPress={() => setPaymentMethod(method.key)}
                >
                  <Ionicons
                    name={method.icon}
                    size={20}
                    color={selected ? colors.primary : colors.textMuted}
                  />
                  <Text style={[styles.paymentChipText, selected && styles.paymentChipTextActive]}>
                    {method.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
          {paymentMethod === 'transfer' && (
            <TransferPaymentCard orderId={0} total={String(shipmentFee)} compact kind="shipment" />
          )}

          <LinearGradient
            colors={[colors.primaryLight, colors.surface]}
            style={styles.totalBox}
          >
            <View>
              <Text style={styles.totalLabel}>Total del envío</Text>
              <Text style={styles.totalHint}>
                {SHIPMENT_SIZES.find((s) => s.key === size)?.label} · {description.trim() || 'Paquete'}
              </Text>
            </View>
            <Text style={styles.totalValue}>{formatCurrency(shipmentFee)}</Text>
          </LinearGradient>

          <Button title="Solicitar envío" onPress={handleSubmit} loading={submitting} />
        </FormSection>

        <View style={styles.listSection}>
          <View style={styles.listHeader}>
            <View>
              <Text style={styles.listTitle}>Mis envíos</Text>
              {activeShipments > 0 && (
                <Text style={styles.listSub}>
                  {activeShipments} en curso
                </Text>
              )}
            </View>
            <Pressable onPress={() => loadShipments()} hitSlop={12}>
              <Ionicons name="refresh" size={22} color={colors.primary} />
            </Pressable>
          </View>

          {listError && (
            <View style={styles.listErrorBox}>
              <Text style={styles.listErrorText}>{listError}</Text>
              <Pressable onPress={() => loadShipments()} hitSlop={8}>
                <Text style={styles.listErrorRetry}>Reintentar</Text>
              </Pressable>
            </View>
          )}

          {loadingList && shipments.length === 0 && !listError ? (
            <Text style={styles.listHint}>Cargando envíos…</Text>
          ) : shipments.length === 0 ? (
            <EmptyState
              emoji="📭"
              title="Sin envíos aún"
              subtitle="Cuando solicites uno, aparecerá aquí para que le des seguimiento."
            />
          ) : (
            shipments.map((item) => (
              <ShipmentCard
                key={item.id}
                item={item}
                onPress={() => navigation.navigate('ShipmentDetail', { shipmentId: item.id })}
              />
            ))
          )}
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    backgroundColor: colors.background,
    paddingHorizontal: spacing.screen,
  },
  hero: {
    marginHorizontal: -spacing.screen,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.xl + 4,
    alignItems: 'center',
    marginBottom: spacing.md,
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
    overflow: 'hidden',
  },
  heroIcon: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  heroEmoji: { fontSize: 34 },
  heroTitle: { fontSize: 24, fontWeight: '800', color: '#FFF', textAlign: 'center', letterSpacing: -0.3 },
  heroSub: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.9)',
    textAlign: 'center',
    marginTop: 6,
  },
  pricePills: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 16,
    flexWrap: 'wrap',
    justifyContent: 'center',
  },
  pricePill: {
    backgroundColor: 'rgba(255,255,255,0.18)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  pricePillLabel: { fontSize: 12, color: 'rgba(255,255,255,0.85)', fontWeight: '600' },
  pricePillFee: { fontSize: 12, color: '#FFF', fontWeight: '800' },
  sizeList: { gap: 8, marginTop: spacing.sm },
  sizeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 14,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: colors.borderLight,
    backgroundColor: colors.background,
  },
  sizeCardActive: {
    borderColor: colors.primary,
    backgroundColor: colors.primaryLight,
  },
  sizeEmoji: { fontSize: 26 },
  sizeInfo: { flex: 1 },
  sizeLabel: { fontSize: 15, fontWeight: '800', color: colors.text },
  sizeLabelActive: { color: colors.primary },
  sizeHint: { fontSize: 12, color: colors.textSecondary, marginTop: 2, lineHeight: 16 },
  sizeFee: { fontSize: 15, fontWeight: '800', color: colors.textSecondary },
  sizeFeeActive: { color: colors.primary },
  routeArrow: { alignItems: 'center', paddingVertical: 4 },
  paymentRow: { flexDirection: 'row', gap: 8, marginBottom: spacing.sm },
  paymentChip: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.background,
  },
  paymentChipActive: { borderColor: colors.primary, backgroundColor: colors.primaryLight },
  paymentChipText: { fontSize: 11, fontWeight: '700', color: colors.textSecondary },
  paymentChipTextActive: { color: colors.primary },
  totalBox: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderRadius: 14,
    marginVertical: spacing.md,
    borderWidth: 1,
    borderColor: colors.primary + '33',
  },
  totalLabel: { fontSize: 16, fontWeight: '800', color: colors.text },
  totalHint: { fontSize: 12, color: colors.textSecondary, marginTop: 2 },
  totalValue: { fontSize: 24, fontWeight: '800', color: colors.primary },
  listSection: { marginTop: spacing.sm, marginBottom: spacing.lg },
  listHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  listTitle: { fontSize: 18, fontWeight: '800', color: colors.text },
  listSub: { fontSize: 13, color: colors.primary, fontWeight: '600', marginTop: 2 },
  listHint: { fontSize: 13, color: colors.textSecondary, textAlign: 'center', paddingVertical: 24 },
  listErrorBox: {
    backgroundColor: colors.primaryLight,
    borderRadius: 12,
    padding: 12,
    marginBottom: spacing.md,
    gap: 6,
  },
  listErrorText: { fontSize: 13, color: colors.textSecondary },
  listErrorRetry: { fontSize: 13, fontWeight: '700', color: colors.primary },
});
