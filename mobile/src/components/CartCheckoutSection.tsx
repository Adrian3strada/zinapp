import Ionicons from '@expo/vector-icons/Ionicons';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { DELIVERY_FEE } from '../config/delivery';
import type { TransferInfo } from '../config/payments';
import DeliveryLocationStatus from './DeliveryLocationStatus';
import DeliveryPinPicker from './DeliveryPinPicker';
import CoverageZoneHint from './CoverageZoneHint';
import FormField from './FormField';
import RoutePreviewMap from './RoutePreviewMap';
import { colors } from '../theme/colors';
import { HIT_SLOP } from '../theme/spacing';
import { cardShadow } from '../theme/shadows';
import { formatCurrency } from '../utils/format';

interface Props {
  address: string;
  notes: string;
  paymentMethod: 'cash' | 'transfer' | 'online';
  couponCode: string;
  couponApplied: boolean;
  couponError: string | null;
  discount: number;
  deliveryCoords: { latitude: number; longitude: number } | null;
  routePreview?: {
    from: { latitude: number; longitude: number };
    to: { latitude: number; longitude: number };
    fromTitle?: string;
  } | null;
  coverageOk: boolean | null;
  addressApproximate?: boolean;
  locating: boolean;
  geocoding: boolean;
  loading: boolean;
  couponValidating: boolean;
  total: number;
  grandTotal: number;
  transferInfo: TransferInfo;
  transferFromRestaurant?: boolean;
  onAddressChange: (text: string) => void;
  onNotesChange: (text: string) => void;
  onlinePaymentsEnabled?: boolean;
  onPaymentMethodChange: (method: 'cash' | 'transfer' | 'online') => void;
  onCouponChange: (text: string) => void;
  onApplyCoupon: () => void;
  onUseLocation: () => void;
  onGeocode: () => void;
  onPinChange: (coord: { latitude: number; longitude: number }) => void;
  onCheckout: () => void;
}

function CartCheckoutSection({
  address,
  notes,
  paymentMethod,
  couponCode,
  couponApplied,
  couponError,
  discount,
  deliveryCoords,
  routePreview,
  coverageOk,
  addressApproximate,
  locating,
  geocoding,
  loading,
  couponValidating,
  total,
  grandTotal,
  transferInfo,
  transferFromRestaurant = false,
  onlinePaymentsEnabled = false,
  onAddressChange,
  onNotesChange,
  onPaymentMethodChange,
  onCouponChange,
  onApplyCoupon,
  onUseLocation,
  onGeocode,
  onPinChange,
  onCheckout,
}: Props) {
  return (
    <View style={styles.footer}>
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <Ionicons name="location" size={20} color={colors.primary} />
          <Text style={styles.cardTitle}>Entrega</Text>
        </View>
        <CoverageZoneHint />
        <FormField
          label="Dirección de entrega"
          value={address}
          onChangeText={onAddressChange}
          icon="location-outline"
          placeholder="Ej. Sirani 11 o Colonia Felix Ireta"
          embedded
          required
          hint="Escribe calle y número. Si no encuentra el número exacto, usa la calle o «Usar mi ubicación»."
        />
        <Pressable style={styles.locationBtn} onPress={onUseLocation} hitSlop={HIT_SLOP}>
          <Ionicons name="navigate" size={18} color={colors.primary} />
          <Text style={styles.locationBtnText}>
            {locating ? 'Obteniendo ubicación...' : 'Usar mi ubicación GPS'}
          </Text>
        </Pressable>
        <Pressable style={styles.locationBtn} onPress={onGeocode} hitSlop={HIT_SLOP}>
          <Ionicons name="search" size={18} color={colors.primary} />
          <Text style={styles.locationBtnText}>
            {geocoding ? 'Buscando dirección...' : 'Buscar dirección'}
          </Text>
        </Pressable>
        <DeliveryPinPicker coordinate={deliveryCoords} onCoordinateChange={onPinChange} />
        {routePreview && (
          <RoutePreviewMap
            from={routePreview.from}
            to={routePreview.to}
            title="Ruta de entrega"
            statsLabel="Ruta restaurante → entrega"
            fromMarker={{
              title: routePreview.fromTitle ?? 'Restaurante',
              pinType: 'restaurant',
            }}
            toMarker={{ title: 'Entrega', pinType: 'delivery' }}
          />
        )}
        <DeliveryLocationStatus
          coordinate={deliveryCoords}
          coverageOk={coverageOk}
          addressApproximate={addressApproximate}
        />
        <FormField
          label="Notas para el repartidor"
          value={notes}
          onChangeText={onNotesChange}
          icon="chatbubble-outline"
          placeholder="Ej. Portón azul, timbre 2"
          embedded
          multiline
        />
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Cupón de descuento</Text>
        <View style={styles.couponRow}>
          <View style={styles.couponField}>
            <FormField
              label="Código"
              value={couponCode}
              onChangeText={onCouponChange}
              icon="pricetag-outline"
              placeholder="Ej. ZINA10"
              embedded
              autoCapitalize="characters"
              style={styles.couponFormField}
            />
          </View>
          <Pressable style={styles.couponBtn} onPress={onApplyCoupon} hitSlop={HIT_SLOP}>
            <Text style={styles.couponBtnText}>Aplicar</Text>
          </Pressable>
        </View>
        {couponApplied && discount > 0 && (
          <Text style={styles.couponOk}>
            ✓ Cupón activo — descuento {formatCurrency(discount)} (se actualiza al cambiar el carrito)
          </Text>
        )}
        {couponError && <Text style={styles.couponErr}>{couponError}</Text>}
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Método de pago</Text>
        <View style={styles.paymentRow}>
          {([
            { key: 'cash', label: 'Efectivo', icon: 'cash-outline' },
            { key: 'transfer', label: 'Transferencia', icon: 'card-outline' },
            ...(onlinePaymentsEnabled
              ? [{ key: 'online' as const, label: 'En línea', icon: 'phone-portrait-outline' as const }]
              : []),
          ] as const).map((opt) => (
            <Pressable
              key={opt.key}
              style={[styles.payOption, paymentMethod === opt.key && styles.payActive]}
              onPress={() => onPaymentMethodChange(opt.key)}
              hitSlop={HIT_SLOP}
            >
              <Ionicons
                name={opt.icon}
                size={22}
                color={paymentMethod === opt.key ? colors.primary : colors.textMuted}
              />
              <Text style={[styles.payText, paymentMethod === opt.key && styles.payTextActive]}>
                {opt.label}
              </Text>
            </Pressable>
          ))}
        </View>
        {paymentMethod === 'transfer' && (
          <View style={styles.transferBox}>
            <Text style={styles.transferTitle}>
              {transferFromRestaurant ? 'Datos del local para transferencia' : 'Datos para transferencia'}
            </Text>
            <Text style={styles.transferLine}>Banco: {transferInfo.bank}</Text>
            <Text style={styles.transferLine}>Titular: {transferInfo.holder}</Text>
            <Text style={styles.transferClabe}>CLABE: {transferInfo.clabe}</Text>
            {transferInfo.whatsapp ? (
              <Text style={styles.transferNote}>
                WhatsApp: {transferInfo.whatsapp} — {transferInfo.note}
              </Text>
            ) : (
              <Text style={styles.transferNote}>{transferInfo.note}</Text>
            )}
          </View>
        )}
        {!onlinePaymentsEnabled && (
          <Text style={styles.onlineHint}>
            Pago en línea (Mercado Pago) estará disponible pronto. Usa efectivo o transferencia.
          </Text>
        )}
        {paymentMethod === 'online' && onlinePaymentsEnabled && (
          <Text style={styles.onlineHint}>
            Pago en línea con Mercado Pago (tarjeta, OXXO, etc.).
          </Text>
        )}
      </View>

      <View style={[styles.card, styles.summary]}>
        <View style={styles.row}>
          <Text style={styles.rowLabel}>Subtotal</Text>
          <Text style={styles.rowValue}>{formatCurrency(total)}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.rowLabel}>Envío</Text>
          <Text style={styles.rowValue}>{formatCurrency(DELIVERY_FEE)}</Text>
        </View>
        {discount > 0 && (
          <View style={styles.row}>
            <Text style={styles.rowLabel}>Descuento</Text>
            <Text style={[styles.rowValue, { color: colors.success }]}>
              -{formatCurrency(discount)}
            </Text>
          </View>
        )}
        <View style={[styles.row, styles.totalRow]}>
          <Text style={styles.totalLabel}>Total</Text>
          <Text style={styles.totalValue}>{formatCurrency(grandTotal)}</Text>
        </View>
      </View>

      <Pressable
        onPress={onCheckout}
        disabled={loading || couponValidating}
        hitSlop={HIT_SLOP}
        style={({ pressed }) => [
          styles.checkoutWrap,
          (loading || couponValidating) && styles.checkoutDisabled,
          pressed && !loading && !couponValidating && styles.checkoutPressed,
        ]}
      >
        <View style={styles.checkoutBtn}>
          <Text style={styles.checkoutText}>
            {loading ? 'Procesando...' : couponValidating ? 'Actualizando cupón...' : 'Confirmar pedido'}
          </Text>
          <Text style={styles.checkoutTotal}>{formatCurrency(grandTotal)}</Text>
        </View>
      </Pressable>
    </View>
  );
}

export default CartCheckoutSection;

const styles = StyleSheet.create({
  footer: { marginTop: 8, gap: 14 },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 16,
    ...cardShadow,
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  cardTitle: { fontSize: 16, fontWeight: '700', color: colors.text },
  couponRow: { flexDirection: 'row', gap: 8, alignItems: 'flex-end' },
  couponField: { flex: 1 },
  couponFormField: { marginBottom: 0 },
  locationBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
    paddingVertical: 10,
    minHeight: 44,
  },
  locationBtnText: { color: colors.primary, fontWeight: '600', fontSize: 14 },
  coordsHint: { color: colors.success, fontSize: 12, marginBottom: 10, fontWeight: '500' },
  outOfCoverage: { color: colors.error },
  couponBtn: {
    backgroundColor: colors.primaryLight,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 12,
  },
  couponBtnText: { color: colors.primary, fontWeight: '700' },
  couponOk: { color: colors.success, fontSize: 12, marginTop: 8, fontWeight: '500' },
  couponErr: { color: colors.error, fontSize: 12, marginTop: 8 },
  transferBox: {
    marginTop: 12,
    backgroundColor: colors.primaryLight,
    borderRadius: 12,
    padding: 14,
    gap: 4,
  },
  transferTitle: { fontWeight: '800', color: colors.primary, marginBottom: 4 },
  transferLine: { fontSize: 14, color: colors.text },
  transferClabe: { fontSize: 15, fontWeight: '700', color: colors.text, letterSpacing: 0.5 },
  transferNote: { fontSize: 12, color: colors.textSecondary, marginTop: 6, lineHeight: 18 },
  onlineHint: { fontSize: 12, color: colors.textMuted, marginTop: 10, lineHeight: 18 },
  paymentRow: { flexDirection: 'row', gap: 8, marginTop: 12 },
  payOption: {
    flex: 1,
    alignItems: 'center',
    padding: 16,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: colors.border,
    gap: 8,
  },
  payActive: { borderColor: colors.primary, backgroundColor: colors.primaryLight },
  payText: { fontSize: 14, fontWeight: '600', color: colors.textMuted },
  payTextActive: { color: colors.primary },
  summary: { gap: 8 },
  row: { flexDirection: 'row', justifyContent: 'space-between' },
  rowLabel: { color: colors.textSecondary, fontSize: 15 },
  rowValue: { fontWeight: '600', color: colors.text },
  totalRow: { marginTop: 8, paddingTop: 12, borderTopWidth: 1, borderTopColor: colors.border },
  totalLabel: { fontSize: 18, fontWeight: '800', color: colors.text },
  totalValue: { fontSize: 18, fontWeight: '800', color: colors.primary },
  checkoutWrap: { borderRadius: 16, marginTop: 4, overflow: 'hidden' },
  checkoutPressed: { opacity: 0.92 },
  checkoutDisabled: { opacity: 0.55 },
  checkoutBtn: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 18,
    borderRadius: 16,
    backgroundColor: colors.primary,
  },
  checkoutText: { color: '#FFF', fontSize: 17, fontWeight: '800' },
  checkoutTotal: { color: '#FFF', fontSize: 17, fontWeight: '800' },
});
