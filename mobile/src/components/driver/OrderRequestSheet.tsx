import Ionicons from '@expo/vector-icons/Ionicons';
import React, { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors } from '../../theme/colors';
import { cardShadow } from '../../theme/shadows';
import type { Order } from '../../types';
import { formatCurrency } from '../../utils/format';
import { formatOrderLabel } from '../../utils/orderDisplay';
import SlideAction from './SlideAction';

interface Props {
  order: Order;
  accepting?: boolean;
  acceptDisabled?: boolean;
  onAccept: () => void;
  onSkip: () => void;
  onDetails: () => void;
}

function earningLabel(order: Order): string {
  const fee = parseFloat(order.delivery_fee || '0');
  const tip = parseFloat(order.tip_amount || '0');
  const sum = (Number.isFinite(fee) ? fee : 0) + (Number.isFinite(tip) ? tip : 0);
  if (sum > 0) return formatCurrency(sum);
  return formatCurrency(order.total);
}

export default function OrderRequestSheet({
  order,
  accepting = false,
  acceptDisabled = false,
  onAccept,
  onSkip,
  onDetails,
}: Props) {
  const restaurant = order.restaurant_detail?.name ?? 'Restaurante';
  const pickup = order.restaurant_detail?.address ?? 'Recoger en el local';
  const earn = useMemo(() => earningLabel(order), [order]);
  const cash = order.payment_method === 'cash';

  return (
    <View style={[styles.sheet, cardShadow]}>
      <View style={styles.handle} />

      <View style={styles.topRow}>
        <View style={styles.badge}>
          <Ionicons name="fast-food" size={14} color={colors.primaryDark} />
          <Text style={styles.badgeText}>Nuevo pedido</Text>
        </View>
        <Pressable onPress={onSkip} hitSlop={12} accessibilityLabel="Omitir pedido">
          <Text style={styles.skip}>Ahora no</Text>
        </Pressable>
      </View>

      <Pressable onPress={onDetails} style={styles.headerPress}>
        <Text style={styles.orderLabel}>{formatOrderLabel(order)}</Text>
        <Text style={styles.restaurant} numberOfLines={1}>
          {restaurant}
        </Text>
      </Pressable>

      <View style={styles.earnRow}>
        <View>
          <Text style={styles.earnLabel}>Ganarás</Text>
          <Text style={styles.earnValue}>{earn}</Text>
        </View>
        {cash ? (
          <View style={styles.cashPill}>
            <Ionicons name="cash-outline" size={14} color={colors.success} />
            <Text style={styles.cashText}>Efectivo</Text>
          </View>
        ) : null}
      </View>

      <View style={styles.routeBlock}>
        <View style={styles.routeRow}>
          <View style={[styles.dot, styles.dotPickup]} />
          <View style={styles.routeText}>
            <Text style={styles.routeTitle}>Recoger</Text>
            <Text style={styles.routeSub} numberOfLines={2}>
              {pickup}
            </Text>
          </View>
        </View>
        <View style={styles.routeLine} />
        <View style={styles.routeRow}>
          <View style={[styles.dot, styles.dotDrop]} />
          <View style={styles.routeText}>
            <Text style={styles.routeTitle}>Entregar</Text>
            <Text style={styles.routeSub} numberOfLines={2}>
              {order.delivery_address}
            </Text>
          </View>
        </View>
      </View>

      <SlideAction
        label="Desliza para aceptar"
        completeLabel="¡Aceptando!"
        icon="bicycle"
        color={colors.primary}
        disabled={acceptDisabled}
        loading={accepting}
        onComplete={onAccept}
      />
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
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.primaryLight,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
  },
  badgeText: { fontSize: 12, fontWeight: '800', color: colors.primaryDark },
  skip: { fontSize: 13, fontWeight: '700', color: colors.textSecondary },
  headerPress: { gap: 2 },
  orderLabel: { fontSize: 12, fontWeight: '700', color: colors.textMuted, textTransform: 'uppercase' },
  restaurant: { fontSize: 20, fontWeight: '800', color: colors.text, letterSpacing: -0.3 },
  earnRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
  },
  earnLabel: { fontSize: 12, fontWeight: '600', color: colors.textSecondary },
  earnValue: { fontSize: 28, fontWeight: '900', color: colors.primaryDark, letterSpacing: -0.5 },
  cashPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#ECFDF5',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 14,
  },
  cashText: { fontSize: 12, fontWeight: '700', color: colors.success },
  routeBlock: { gap: 0 },
  routeRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  routeText: { flex: 1, gap: 2, paddingBottom: 10 },
  routeTitle: { fontSize: 12, fontWeight: '800', color: colors.textMuted, textTransform: 'uppercase' },
  routeSub: { fontSize: 14, fontWeight: '600', color: colors.text, lineHeight: 19 },
  dot: { width: 12, height: 12, borderRadius: 6, marginTop: 4 },
  dotPickup: { backgroundColor: colors.primary },
  dotDrop: { backgroundColor: colors.primary },
  routeLine: {
    width: 2,
    height: 14,
    backgroundColor: colors.border,
    marginLeft: 5,
    marginVertical: -2,
  },
});
