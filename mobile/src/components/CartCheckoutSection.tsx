import Ionicons from '@expo/vector-icons/Ionicons';
import { LinearGradient } from 'expo-linear-gradient';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { DELIVERY_FEE } from '../config/delivery';
import type { TransferInfo } from '../config/payments';
import DeliveryLocationStatus from './DeliveryLocationStatus';
import DeliveryPinPicker from './DeliveryPinPicker';
import CoverageZoneHint from './CoverageZoneHint';
import FormField from './FormField';
import RoutePreviewMap from './RoutePreviewMap';
import StripeEmbeddedCheckout from './StripeEmbeddedCheckout';
import { colors } from '../theme/colors';
import { HIT_SLOP, spacing } from '../theme/spacing';
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
  tipAmount: number;
  scheduleKey: ScheduleKey;
  transferInfo: TransferInfo;
  onAddressChange: (text: string) => void;
  onNotesChange: (text: string) => void;
  onlinePaymentsEnabled?: boolean;
  stripeClientSecret?: string | null;
  stripePublishableKey?: string;
  showCheckoutButton?: boolean;
  onPaymentMethodChange: (method: 'cash' | 'transfer' | 'online') => void;
  onCouponChange: (text: string) => void;
  onApplyCoupon: () => void;
  onBrowseOffers?: () => void;
  onUseLocation: () => void;
  onGeocode: () => void;
  onPinChange: (coord: { latitude: number; longitude: number }) => void;
  onCheckout: () => void;
  onTipChange: (amount: number) => void;
  onScheduleChange: (key: ScheduleKey) => void;
}

export type ScheduleKey = 'asap' | '30m' | '1h' | '2h' | 'tomorrow_noon';

export const TIP_PRESETS = [0, 10, 15, 20, 30] as const;

export const SCHEDULE_OPTIONS: { key: ScheduleKey; label: string }[] = [
  { key: 'asap', label: 'Lo antes posible' },
  { key: '30m', label: 'En ~30 min' },
  { key: '1h', label: 'En 1 hora' },
  { key: '2h', label: 'En 2 horas' },
  { key: 'tomorrow_noon', label: 'Mañana mediodía' },
];

export function scheduleKeyToIso(key: ScheduleKey): string | undefined {
  if (key === 'asap') return undefined;
  const d = new Date();
  if (key === '30m') d.setMinutes(d.getMinutes() + 35);
  else if (key === '1h') d.setMinutes(d.getMinutes() + 60);
  else if (key === '2h') d.setMinutes(d.getMinutes() + 120);
  else if (key === 'tomorrow_noon') {
    d.setDate(d.getDate() + 1);
    d.setHours(12, 0, 0, 0);
  }
  return d.toISOString();
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
  tipAmount,
  scheduleKey,
  transferInfo,
  onlinePaymentsEnabled = false,
  stripeClientSecret = null,
  stripePublishableKey = '',
  showCheckoutButton = true,
  onAddressChange,
  onNotesChange,
  onPaymentMethodChange,
  onCouponChange,
  onApplyCoupon,
  onBrowseOffers,
  onUseLocation,
  onGeocode,
  onPinChange,
  onCheckout,
  onTipChange,
  onScheduleChange,
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
          hint="Calle y número. Al confirmar se valida la ubicación automáticamente."
        />
        <Pressable style={styles.locationBtn} onPress={onUseLocation} hitSlop={HIT_SLOP}>
          <Ionicons name="navigate" size={18} color={colors.primary} />
          <Text style={styles.locationBtnText}>
            {locating ? 'Obteniendo ubicación...' : 'Usar mi ubicación GPS'}
          </Text>
        </Pressable>
        <Pressable style={styles.locationLink} onPress={onGeocode} hitSlop={HIT_SLOP}>
          <Text style={styles.locationLinkText}>
            {geocoding ? 'Buscando…' : 'Buscar esta dirección en el mapa'}
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
        <View style={styles.couponHeader}>
          <Text style={styles.cardTitle}>Cupón de descuento</Text>
          {onBrowseOffers ? (
            <Pressable onPress={onBrowseOffers} hitSlop={HIT_SLOP}>
              <Text style={styles.offersLink}>Ver ofertas</Text>
            </Pressable>
          ) : null}
        </View>
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
              error={couponError ?? undefined}
              style={styles.couponFormField}
            />
          </View>
          <Pressable
            style={[styles.couponBtn, couponValidating && styles.couponBtnDisabled]}
            onPress={onApplyCoupon}
            disabled={couponValidating || !couponCode.trim()}
            hitSlop={HIT_SLOP}
            accessibilityState={{ disabled: couponValidating || !couponCode.trim(), busy: couponValidating }}
          >
            <Text style={styles.couponBtnText}>{couponValidating ? '…' : 'Aplicar'}</Text>
          </Pressable>
        </View>
        {couponApplied && discount > 0 && (
          <Text style={styles.couponOk}>
            ✓ Cupón activo — descuento {formatCurrency(discount)} (se actualiza al cambiar el carrito)
          </Text>
        )}
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
            <Text style={styles.transferTitle}>Datos ZinApp para transferencia</Text>
            <Text style={styles.transferLine}>Banco: {transferInfo.bank}</Text>
            <Text style={styles.transferLine}>Titular: {transferInfo.holder}</Text>
            <Text style={styles.transferClabe}>CLABE: {transferInfo.clabe}</Text>
            <Text style={styles.transferNote}>
              {transferInfo.whatsapp
                ? `WhatsApp: ${transferInfo.whatsapp} — ${transferInfo.note}`
                : transferInfo.note}
            </Text>
          </View>
        )}
        {!onlinePaymentsEnabled && (
          <Text style={styles.onlineHint}>
            Pago con tarjeta estará disponible pronto. Usa efectivo o transferencia.
          </Text>
        )}
        {paymentMethod === 'online' && stripeClientSecret && stripePublishableKey ? (
          <View style={styles.stripeEmbed}>
            <StripeEmbeddedCheckout
              clientSecret={stripeClientSecret}
              publishableKey={stripePublishableKey}
            />
          </View>
        ) : null}
      </View>

      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <Ionicons name="time-outline" size={20} color={colors.primary} />
          <Text style={styles.cardTitle}>¿Cuándo lo quieres?</Text>
        </View>
        <View style={styles.chipRow}>
          {SCHEDULE_OPTIONS.map((opt) => (
            <Pressable
              key={opt.key}
              style={[styles.chip, scheduleKey === opt.key && styles.chipActive]}
              onPress={() => onScheduleChange(opt.key)}
              hitSlop={HIT_SLOP}
            >
              <Text style={[styles.chipText, scheduleKey === opt.key && styles.chipTextActive]}>
                {opt.label}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>

      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <Ionicons name="heart-outline" size={20} color={colors.primary} />
          <Text style={styles.cardTitle}>Propina al repartidor</Text>
        </View>
        <View style={styles.chipRow}>
          {TIP_PRESETS.map((preset) => (
            <Pressable
              key={preset}
              style={[styles.chip, tipAmount === preset && styles.chipActive]}
              onPress={() => onTipChange(preset)}
              hitSlop={HIT_SLOP}
            >
              <Text style={[styles.chipText, tipAmount === preset && styles.chipTextActive]}>
                {preset === 0 ? 'Sin propina' : `$${preset}`}
              </Text>
            </Pressable>
          ))}
        </View>
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
        {tipAmount > 0 && (
          <View style={styles.row}>
            <Text style={styles.rowLabel}>Propina</Text>
            <Text style={styles.rowValue}>{formatCurrency(tipAmount)}</Text>
          </View>
        )}
        <View style={[styles.row, styles.totalRow]}>
          <Text style={styles.totalLabel}>Total</Text>
          <Text style={styles.totalValue}>{formatCurrency(grandTotal)}</Text>
        </View>
      </View>

      {!stripeClientSecret && showCheckoutButton ? (
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
          <LinearGradient
            colors={[colors.primary, colors.primaryDark]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.checkoutBtn}
          >
            <Text style={styles.checkoutText} numberOfLines={1}>
              {loading
                ? 'Procesando...'
                : couponValidating
                  ? 'Actualizando cupón...'
                  : paymentMethod === 'online'
                    ? 'Confirmar y pagar'
                    : 'Confirmar pedido'}
            </Text>
            <View style={styles.checkoutTotalPill}>
              <Text style={styles.checkoutTotal} numberOfLines={1}>
                {formatCurrency(grandTotal)}
              </Text>
            </View>
          </LinearGradient>
        </Pressable>
      ) : null}
    </View>
  );
}

export default CartCheckoutSection;

const styles = StyleSheet.create({
  footer: { marginTop: spacing.sm, gap: spacing.md },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 18,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.borderLight,
    ...cardShadow,
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 14 },
  cardTitle: { fontSize: 17, fontWeight: '800', color: colors.text, letterSpacing: -0.2, marginBottom: 4 },
  couponRow: { flexDirection: 'row', gap: 8, alignItems: 'flex-end' },
  couponHeader: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    marginBottom: 4,
  },
  offersLink: { fontSize: 13, fontWeight: '800', color: colors.primary },
  couponField: { flex: 1, minWidth: 0 },
  couponFormField: { marginBottom: 0 },
  locationBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
    paddingVertical: 12,
    paddingHorizontal: 12,
    minHeight: 48,
    borderRadius: 14,
    backgroundColor: colors.primaryLight,
  },
  locationBtnText: { color: colors.primary, fontWeight: '700', fontSize: 14 },
  locationLink: {
    alignSelf: 'flex-start',
    paddingVertical: 8,
    marginBottom: 8,
    minHeight: 40,
    justifyContent: 'center',
  },
  locationLinkText: { color: colors.primary, fontWeight: '600', fontSize: 13 },
  coordsHint: { color: colors.success, fontSize: 12, marginBottom: 10, fontWeight: '500' },
  outOfCoverage: { color: colors.error },
  couponBtn: {
    backgroundColor: colors.primaryLight,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 14,
    minHeight: 52,
    justifyContent: 'center',
  },
  couponBtnDisabled: { opacity: 0.55 },
  couponBtnText: { color: colors.primary, fontWeight: '800', fontSize: 14 },
  couponOk: { color: colors.success, fontSize: 12, marginTop: 8, fontWeight: '500' },
  couponErr: { color: colors.error, fontSize: 12, marginTop: 8 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 11,
    minHeight: 44,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
    justifyContent: 'center',
  },
  chipActive: {
    borderColor: colors.primary,
    backgroundColor: colors.primaryLight,
  },
  chipText: { fontSize: 13, fontWeight: '700', color: colors.textSecondary },
  chipTextActive: { color: colors.primary },
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
  stripeEmbed: { marginTop: 14 },
  paymentRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 },
  payOption: {
    flexGrow: 1,
    flexBasis: '30%',
    minWidth: 96,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    paddingVertical: 12,
    paddingHorizontal: 10,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 8,
    minHeight: 52,
  },
  payActive: { borderColor: colors.primary, backgroundColor: colors.primaryLight },
  payText: { fontSize: 13, fontWeight: '600', color: colors.textMuted, textAlign: 'center' },
  payTextActive: { color: colors.primary },
  summary: { gap: 8 },
  row: { flexDirection: 'row', justifyContent: 'space-between', gap: 12 },
  rowLabel: { color: colors.textSecondary, fontSize: 15, flexShrink: 1 },
  rowValue: { fontWeight: '600', color: colors.text, flexShrink: 0 },
  totalRow: { marginTop: 8, paddingTop: 12, borderTopWidth: 1, borderTopColor: colors.border },
  totalLabel: { fontSize: 18, fontWeight: '800', color: colors.text },
  totalValue: { fontSize: 18, fontWeight: '800', color: colors.primary },
  checkoutWrap: { borderRadius: 18, marginTop: 4, overflow: 'hidden' },
  checkoutPressed: { opacity: 0.92 },
  checkoutDisabled: { opacity: 0.55 },
  checkoutBtn: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 10,
    minHeight: 56,
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderRadius: 18,
  },
  checkoutText: { color: '#FFF', fontSize: 16, fontWeight: '800', flex: 1, minWidth: 0 },
  checkoutTotalPill: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    flexShrink: 0,
  },
  checkoutTotal: { color: '#FFF', fontSize: 15, fontWeight: '800' },
});
