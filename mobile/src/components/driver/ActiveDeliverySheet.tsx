import Ionicons from '@expo/vector-icons/Ionicons';
import React from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';

import { colors } from '../../theme/colors';
import { cardShadow } from '../../theme/shadows';
import type { Order } from '../../types';
import { formatCurrency, formatRouteDistance, formatRouteDuration } from '../../utils/format';
import type { ActiveDeliveryStep } from '../../utils/driverDeliveryProgress';
import { formatOrderLabel } from '../../utils/orderDisplay';
import type { StreetRouteStats } from '../../utils/routing';
import SlideAction from './SlideAction';

interface Props {
  order: Order;
  step: ActiveDeliveryStep;
  delivering?: boolean;
  routeStats?: StreetRouteStats | null;
  onNavigate: () => void;
  onConfirmPickup: () => void;
  onMarkDelivered: () => void;
  onDetails: () => void;
}

export default function ActiveDeliverySheet({
  order,
  step,
  delivering = false,
  routeStats,
  onNavigate,
  onConfirmPickup,
  onMarkDelivered,
  onDetails,
}: Props) {
  const restaurant = order.restaurant_detail?.name ?? 'Restaurante';
  const isPickup = step === 'pickup';
  const targetTitle = isPickup ? 'Ve al restaurante' : 'Entrega el pedido';
  const targetAddress = isPickup
    ? (order.restaurant_detail?.address || restaurant)
    : order.delivery_address;
  const cash = order.payment_method === 'cash';
  const fee = parseFloat(order.delivery_fee || '0');
  const tip = parseFloat(order.tip_amount || '0');
  const earn = (Number.isFinite(fee) ? fee : 0) + (Number.isFinite(tip) ? tip : 0);

  return (
    <View style={[styles.sheet, cardShadow]}>
      <View style={styles.handle} />

      <View style={styles.steps}>
        <View style={[styles.step, isPickup && styles.stepActive]}>
          <View style={[styles.stepDot, isPickup ? styles.stepDotActive : styles.stepDotDone]}>
            <Text style={styles.stepNum}>{isPickup ? '1' : '✓'}</Text>
          </View>
          <Text style={[styles.stepLabel, isPickup && styles.stepLabelActive]}>Recoger</Text>
        </View>
        <View style={styles.stepLine} />
        <View style={[styles.step, !isPickup && styles.stepActive]}>
          <View style={[styles.stepDot, !isPickup ? styles.stepDotActive : styles.stepDotIdle]}>
            <Text style={styles.stepNum}>2</Text>
          </View>
          <Text style={[styles.stepLabel, !isPickup && styles.stepLabelActive]}>Entregar</Text>
        </View>
      </View>

      <Pressable onPress={onDetails} style={styles.header}>
        <Text style={styles.eyebrow}>{formatOrderLabel(order)} · {restaurant}</Text>
        <Text style={styles.title}>{targetTitle}</Text>
        <Text style={styles.address} numberOfLines={2}>
          {targetAddress}
        </Text>
      </Pressable>

      <View style={styles.metaRow}>
        {routeStats?.distanceMeters != null && routeStats.durationSeconds != null ? (
          <View style={styles.metaChip}>
            <Ionicons name="navigate-outline" size={14} color={colors.accentDark} />
            <Text style={styles.metaText}>
              {formatRouteDistance(routeStats.distanceMeters)} ·{' '}
              {formatRouteDuration(routeStats.durationSeconds)}
            </Text>
          </View>
        ) : null}
        {earn > 0 ? (
          <View style={styles.metaChip}>
            <Ionicons name="cash-outline" size={14} color={colors.success} />
            <Text style={styles.metaText}>{formatCurrency(earn)}</Text>
          </View>
        ) : null}
        {cash && !isPickup ? (
          <View style={styles.metaChip}>
            <Ionicons name="wallet-outline" size={14} color={colors.warning} />
            <Text style={styles.metaText}>Cobrar efectivo</Text>
          </View>
        ) : null}
      </View>

      <Pressable
        style={[styles.navBtn, Platform.OS === 'web' ? ({ cursor: 'pointer' } as object) : null]}
        onPress={onNavigate}
        accessibilityRole="button"
        accessibilityLabel={isPickup ? 'Navegar al restaurante' : 'Navegar a la entrega'}
      >
        <Ionicons name="navigate" size={20} color="#FFF" />
        <Text style={styles.navText}>
          {isPickup ? 'Navegar al restaurante' : 'Navegar a la entrega'}
        </Text>
      </Pressable>

      {isPickup ? (
        <SlideAction
          label="Desliza: ya recogí el pedido"
          completeLabel="¡Recogido!"
          icon="bag-check"
          color={colors.primary}
          onComplete={onConfirmPickup}
        />
      ) : (
        <SlideAction
          label="Desliza para marcar entregado"
          completeLabel="¡Entregando!"
          icon="checkmark"
          color={colors.success}
          loading={delivering}
          onComplete={onMarkDelivered}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 18,
    paddingTop: 10,
    paddingBottom: 14,
    gap: 14,
  },
  handle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.border,
    marginBottom: 2,
  },
  steps: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  step: { flexDirection: 'row', alignItems: 'center', gap: 6, opacity: 0.55 },
  stepActive: { opacity: 1 },
  stepDot: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepDotActive: { backgroundColor: colors.accent },
  stepDotDone: { backgroundColor: colors.success },
  stepDotIdle: { backgroundColor: colors.border },
  stepNum: { fontSize: 11, fontWeight: '800', color: '#FFF' },
  stepLabel: { fontSize: 13, fontWeight: '700', color: colors.textMuted },
  stepLabelActive: { color: colors.text },
  stepLine: { width: 28, height: 2, backgroundColor: colors.border, borderRadius: 1 },
  header: { gap: 4 },
  eyebrow: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  title: { fontSize: 20, fontWeight: '900', color: colors.text, letterSpacing: -0.3 },
  address: { fontSize: 14, fontWeight: '600', color: colors.textSecondary, lineHeight: 20 },
  metaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  metaChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: colors.background,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 14,
  },
  metaText: { fontSize: 12, fontWeight: '700', color: colors.text },
  navBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: colors.accent,
    borderRadius: 16,
    paddingVertical: 14,
  },
  navText: { fontSize: 15, fontWeight: '800', color: '#FFF' },
});
