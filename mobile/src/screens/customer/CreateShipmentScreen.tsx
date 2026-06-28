import Ionicons from '@expo/vector-icons/Ionicons';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  KeyboardAvoidingView,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { appAlert } from '../../utils/appAlert';

import AddressPinPicker from '../../components/AddressPinPicker';
import Button from '../../components/Button';
import CoverageZoneHint from '../../components/CoverageZoneHint';
import FormField from '../../components/FormField';
import RoutePreviewMap from '../../components/RoutePreviewMap';
import ScreenContainer from '../../components/ScreenContainer';
import { SHIPMENT_SIZES } from '../../config/delivery';
import { isInCoverage } from '../../utils/coverage';
import { useAuth } from '../../context/AuthContext';
import type { CreateShipmentScreenProps } from '../../navigation/types';
import { restaurantApi, shipmentApi } from '../../services/api';
import { colors } from '../../theme/colors';
import { spacing } from '../../theme/spacing';
import { cardShadow } from '../../theme/shadows';
import type { ShipmentSize } from '../../types';
import { getApiErrorMessage } from '../../utils/apiErrors';
import { formatCurrency } from '../../utils/format';
import { createIdempotencyKey } from '../../utils/idempotency';
import { useLocation } from '../../hooks/useLocation';
import { keyboardAvoidingBehavior } from '../../utils/webPlatform';
import { runWithRetry } from '../../services/apiWake';
import { HIT_SLOP } from '../../theme/spacing';

export default function CreateShipmentScreen({ navigation }: CreateShipmentScreenProps) {
  const { user } = useAuth();
  const { getCurrentPosition, loading: locating } = useLocation();
  const [description, setDescription] = useState('');
  const [size, setSize] = useState<ShipmentSize>('small');
  const [pickupAddress, setPickupAddress] = useState(user?.address ?? '');
  const [pickupNotes, setPickupNotes] = useState('');
  const [deliveryAddress, setDeliveryAddress] = useState('');
  const [deliveryNotes, setDeliveryNotes] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'transfer'>('cash');
  const [pickupCoords, setPickupCoords] = useState<{ latitude: number; longitude: number } | null>(null);
  const [deliveryCoords, setDeliveryCoords] = useState<{ latitude: number; longitude: number } | null>(null);
  const [pickupCoverageOk, setPickupCoverageOk] = useState<boolean | null>(null);
  const [deliveryCoverageOk, setDeliveryCoverageOk] = useState<boolean | null>(null);
  const [geocodingPickup, setGeocodingPickup] = useState(false);
  const [geocodingDelivery, setGeocodingDelivery] = useState(false);
  const [loading, setLoading] = useState(false);
  const [sizeOptions, setSizeOptions] = useState(SHIPMENT_SIZES);
  const idempotencyKey = useRef<string | null>(null);

  useEffect(() => {
    shipmentApi.sizes().then(({ data }) => {
      if (data.length > 0) {
        setSizeOptions(
          data.map((opt) => ({
            key: opt.key as ShipmentSize,
            label: opt.label,
            fee: parseFloat(opt.fee),
            hint: opt.hint,
            emoji: opt.key === 'small' ? '📄' : opt.key === 'medium' ? '📦' : '🧳',
          })),
        );
      }
    }).catch(() => {});
  }, []);

  const selectedSize = useMemo(
    () => sizeOptions.find((s) => s.key === size) ?? sizeOptions[0],
    [size, sizeOptions],
  );

  const routePreview = useMemo(() => {
    if (!pickupCoords || !deliveryCoords) return null;
    return { from: pickupCoords, to: deliveryCoords, fromTitle: 'Recogida' };
  }, [pickupCoords, deliveryCoords]);

  const geocode = async (
    address: string,
    target: 'pickup' | 'delivery',
  ) => {
    if (!address.trim()) {
      appAlert('Dirección', 'Escribe una dirección primero.');
      return;
    }
    const setGeocoding = target === 'pickup' ? setGeocodingPickup : setGeocodingDelivery;
    const setCoords = target === 'pickup' ? setPickupCoords : setDeliveryCoords;
    const setAddress = target === 'pickup' ? setPickupAddress : setDeliveryAddress;
    const setCoverage = target === 'pickup' ? setPickupCoverageOk : setDeliveryCoverageOk;

    setGeocoding(true);
    try {
      const { data } = await runWithRetry(() => restaurantApi.geocode(address));
      setCoords({ latitude: data.latitude, longitude: data.longitude });
      setAddress(data.display_name);
      setCoverage(data.in_coverage);
      if (!data.in_coverage) {
        appAlert('Fuera de cobertura', 'Esta dirección está fuera de Zinapécuaro.');
      }
    } catch (err) {
      appAlert('Geocodificación', getApiErrorMessage(err, 'No se encontró la dirección.'));
    } finally {
      setGeocoding(false);
    }
  };

  const useMyLocation = async (target: 'pickup' | 'delivery') => {
    const coords = await getCurrentPosition();
    if (!coords) {
      appAlert('Ubicación', 'Activa el permiso de ubicación.');
      return;
    }
    const ok = isInCoverage(coords.latitude, coords.longitude);
    if (target === 'pickup') {
      setPickupCoords(coords);
      setPickupCoverageOk(ok);
      if (!pickupAddress.trim()) setPickupAddress('Mi ubicación (recogida)');
    } else {
      setDeliveryCoords(coords);
      setDeliveryCoverageOk(ok);
      if (!deliveryAddress.trim()) setDeliveryAddress('Mi ubicación (entrega)');
    }
    if (!ok) {
      appAlert('Fuera de zona', 'Tu GPS no está en Zinapécuaro. Usa «Buscar dirección».');
    }
  };

  const handleSubmit = useCallback(async () => {
    if (loading) return;
    if (!description.trim()) {
      appAlert('Contenido', 'Describe qué vas a enviar.');
      return;
    }
    if (!pickupAddress.trim() || !deliveryAddress.trim()) {
      appAlert('Direcciones', 'Indica recogida y entrega.');
      return;
    }
    if (!pickupCoords || !deliveryCoords) {
      appAlert('Ubicación', 'Confirma ambas direcciones con «Buscar dirección» o GPS.');
      return;
    }
    if (pickupCoverageOk !== true || deliveryCoverageOk !== true) {
      appAlert('Cobertura', 'Ambas direcciones deben estar dentro de Zinapécuaro.');
      return;
    }

    if (!idempotencyKey.current) {
      idempotencyKey.current = createIdempotencyKey();
    }

    setLoading(true);
    try {
      const { data } = await shipmentApi.create(
        {
          description: description.trim(),
          size,
          pickup_address: pickupAddress,
          pickup_latitude: pickupCoords.latitude,
          pickup_longitude: pickupCoords.longitude,
          pickup_notes: pickupNotes,
          delivery_address: deliveryAddress,
          delivery_latitude: deliveryCoords.latitude,
          delivery_longitude: deliveryCoords.longitude,
          delivery_notes: deliveryNotes,
          payment_method: paymentMethod,
        },
        { idempotencyKey: idempotencyKey.current },
      );
      idempotencyKey.current = null;
      navigation.replace('ShipmentDetail', { shipmentId: data.id });
    } catch (err) {
      appAlert('Error', getApiErrorMessage(err, 'No se pudo crear el envío.'));
    } finally {
      setLoading(false);
    }
  }, [
    loading,
    description,
    pickupAddress,
    deliveryAddress,
    pickupCoords,
    deliveryCoords,
    pickupCoverageOk,
    deliveryCoverageOk,
    size,
    pickupNotes,
    deliveryNotes,
    paymentMethod,
    navigation,
  ]);

  return (
    <ScreenContainer>
      <KeyboardAvoidingView behavior={keyboardAvoidingBehavior()} style={{ flex: 1 }}>
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <CoverageZoneHint />

          <View style={styles.card}>
            <Text style={styles.cardTitle}>¿Qué envías?</Text>
            <FormField
              label="Descripción"
              value={description}
              onChangeText={setDescription}
              placeholder="Ej. documentos, ropa, regalo..."
              embedded
              required
            />
            <Text style={styles.label}>Tamaño</Text>
            <View style={styles.chipRow}>
              {sizeOptions.map((opt) => (
                <Pressable
                  key={opt.key}
                  style={[styles.chip, size === opt.key && styles.chipActive]}
                  onPress={() => setSize(opt.key)}
                  hitSlop={HIT_SLOP}
                >
                  <Text style={styles.chipEmoji}>{opt.emoji}</Text>
                  <Text style={[styles.chipText, size === opt.key && styles.chipTextActive]}>
                    {opt.label}
                  </Text>
                  <Text style={styles.chipFee}>{formatCurrency(opt.fee)}</Text>
                </Pressable>
              ))}
            </View>
            {selectedSize?.hint ? (
              <Text style={styles.hint}>{selectedSize.hint}</Text>
            ) : null}
          </View>

          <View style={styles.card}>
            <Text style={styles.cardTitle}>Recoger en</Text>
            <FormField
              label="Dirección de recogida"
              value={pickupAddress}
              onChangeText={(v) => {
                setPickupAddress(v);
                setPickupCoords(null);
                setPickupCoverageOk(null);
              }}
              icon="cube-outline"
              embedded
              required
            />
            <Pressable style={styles.locBtn} onPress={() => useMyLocation('pickup')} hitSlop={HIT_SLOP}>
              <Ionicons name="navigate" size={18} color={colors.primary} />
              <Text style={styles.locBtnText}>
                {locating ? 'Obteniendo...' : 'Usar mi ubicación'}
              </Text>
            </Pressable>
            <Pressable style={styles.locBtn} onPress={() => geocode(pickupAddress, 'pickup')} hitSlop={HIT_SLOP}>
              <Ionicons name="search" size={18} color={colors.primary} />
              <Text style={styles.locBtnText}>
                {geocodingPickup ? 'Buscando...' : 'Buscar dirección'}
              </Text>
            </Pressable>
            <AddressPinPicker
              title="Ajusta el punto de recogida"
              pinType="pickup"
              coordinate={pickupCoords}
              onCoordinateChange={(c) => {
                setPickupCoords(c);
                setPickupCoverageOk(isInCoverage(c.latitude, c.longitude));
              }}
            />
            <FormField
              label="Notas de recogida"
              value={pickupNotes}
              onChangeText={setPickupNotes}
              placeholder="Ej. casa blanca, timbre roto..."
              embedded
              multiline
            />
          </View>

          <View style={styles.card}>
            <Text style={styles.cardTitle}>Entregar en</Text>
            <FormField
              label="Dirección de entrega"
              value={deliveryAddress}
              onChangeText={(v) => {
                setDeliveryAddress(v);
                setDeliveryCoords(null);
                setDeliveryCoverageOk(null);
              }}
              icon="location-outline"
              embedded
              required
            />
            <Pressable style={styles.locBtn} onPress={() => useMyLocation('delivery')} hitSlop={HIT_SLOP}>
              <Ionicons name="navigate" size={18} color={colors.primary} />
              <Text style={styles.locBtnText}>
                {locating ? 'Obteniendo...' : 'Usar mi ubicación'}
              </Text>
            </Pressable>
            <Pressable style={styles.locBtn} onPress={() => geocode(deliveryAddress, 'delivery')} hitSlop={HIT_SLOP}>
              <Ionicons name="search" size={18} color={colors.primary} />
              <Text style={styles.locBtnText}>
                {geocodingDelivery ? 'Buscando...' : 'Buscar dirección'}
              </Text>
            </Pressable>
            <AddressPinPicker
              title="Ajusta el punto de entrega"
              pinType="delivery"
              coordinate={deliveryCoords}
              onCoordinateChange={(c) => {
                setDeliveryCoords(c);
                setDeliveryCoverageOk(isInCoverage(c.latitude, c.longitude));
              }}
            />
            <FormField
              label="Notas de entrega"
              value={deliveryNotes}
              onChangeText={setDeliveryNotes}
              embedded
              multiline
            />
          </View>

          {routePreview && (
            <View style={styles.card}>
              <RoutePreviewMap
                from={routePreview.from}
                to={routePreview.to}
                title="Vista previa de ruta"
                fromTitle={routePreview.fromTitle}
              />
            </View>
          )}

          <View style={styles.card}>
            <Text style={styles.cardTitle}>Pago</Text>
            <View style={styles.payRow}>
              {(['cash', 'transfer'] as const).map((method) => (
                <Pressable
                  key={method}
                  style={[styles.payChip, paymentMethod === method && styles.payChipActive]}
                  onPress={() => setPaymentMethod(method)}
                >
                  <Ionicons
                    name={method === 'cash' ? 'cash-outline' : 'card-outline'}
                    size={18}
                    color={paymentMethod === method ? colors.primary : colors.textSecondary}
                  />
                  <Text style={[styles.payText, paymentMethod === method && styles.payTextActive]}>
                    {method === 'cash' ? 'Efectivo' : 'Transferencia'}
                  </Text>
                </Pressable>
              ))}
            </View>
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>Total estimado</Text>
              <Text style={styles.totalValue}>{formatCurrency(selectedSize?.fee ?? 0)}</Text>
            </View>
          </View>

          <Button
            title={loading ? 'Creando envío...' : 'Confirmar envío'}
            onPress={handleSubmit}
            loading={loading}
            size="lg"
          />
        </ScrollView>
      </KeyboardAvoidingView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  scroll: { padding: spacing.screen, gap: 14, paddingBottom: 32 },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 22,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.borderLight,
    gap: 10,
    ...cardShadow,
  },
  cardTitle: { fontSize: 17, fontWeight: '800', color: colors.text, marginBottom: 4 },
  label: { fontSize: 13, fontWeight: '700', color: colors.textSecondary },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    flexBasis: '30%',
    flexGrow: 1,
    alignItems: 'center',
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
    gap: 4,
  },
  chipActive: { borderColor: colors.primary, backgroundColor: colors.primaryLight },
  chipEmoji: { fontSize: 22 },
  chipText: { fontSize: 13, fontWeight: '700', color: colors.textSecondary },
  chipTextActive: { color: colors.primary },
  chipFee: { fontSize: 12, color: colors.textMuted },
  hint: { fontSize: 12, color: colors.textMuted, lineHeight: 18 },
  locBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 8 },
  locBtnText: { color: colors.primary, fontWeight: '600', fontSize: 14 },
  payRow: { flexDirection: 'row', gap: 10 },
  payChip: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  payChipActive: { borderColor: colors.primary, backgroundColor: colors.primaryLight },
  payText: { fontWeight: '700', color: colors.textSecondary },
  payTextActive: { color: colors.primary },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: colors.borderLight,
  },
  totalLabel: { fontSize: 15, fontWeight: '700', color: colors.text },
  totalValue: { fontSize: 18, fontWeight: '800', color: colors.primary },
});
