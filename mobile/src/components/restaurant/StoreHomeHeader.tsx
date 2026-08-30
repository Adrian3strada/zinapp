import Ionicons from '@expo/vector-icons/Ionicons';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import SlideAction from '../driver/SlideAction';
import { colors } from '../../theme/colors';
import { radii } from '../../theme/radii';
import { cardShadow } from '../../theme/shadows';
import { HIT_SLOP } from '../../theme/spacing';
import type { Restaurant } from '../../types';
import { formatCurrency } from '../../utils/format';

export type RestaurantTodaySummary = {
  orders_created: number;
  orders_active: number;
  orders_delivered: number;
  orders_cancelled: number;
  net_sales: string;
};

interface Props {
  topInset: number;
  restaurant: Restaurant | null;
  today: RestaurantTodaySummary | null;
  kitchenCount: number;
  readyCount: number;
  deliveryCount: number;
  toggling: boolean;
  onToggleOpen: (open: boolean) => void | Promise<void>;
  canSwitch?: boolean;
  onPressRestaurant?: () => void;
  canAdd?: boolean;
  onPressAdd?: () => void;
}

/** Home del negocio: abrir/cerrar + resumen del día. */
export default function StoreHomeHeader({
  topInset,
  restaurant,
  today,
  kitchenCount,
  readyCount,
  deliveryCount,
  toggling,
  onToggleOpen,
  canSwitch,
  onPressRestaurant,
  canAdd,
  onPressAdd,
}: Props) {
  const isActive = !!restaurant?.is_active;
  const isOpen = isActive && restaurant?.accepting_orders !== false;
  const activeOrders = today?.orders_active ?? kitchenCount + readyCount + deliveryCount;

  return (
    <View style={[styles.wrap, { paddingTop: topInset + 12 }]}>
      <View style={styles.titleRow}>
        <View style={styles.titleBlock}>
          <Text style={styles.eyebrow}>{canSwitch ? 'Tu local' : 'Tu negocio'}</Text>
          <Pressable
            style={styles.titleLine}
            onPress={canSwitch ? onPressRestaurant : undefined}
            disabled={!canSwitch}
            hitSlop={HIT_SLOP}
            accessibilityRole={canSwitch ? 'button' : undefined}
            accessibilityLabel={canSwitch ? 'Cambiar de local' : undefined}
          >
            <Text style={styles.title} numberOfLines={1}>
              {restaurant?.name?.trim() || 'Pedidos'}
            </Text>
            {canSwitch ? (
              <Ionicons name="chevron-down" size={20} color={colors.text} />
            ) : null}
          </Pressable>
          {canAdd && onPressAdd ? (
            <Pressable
              onPress={onPressAdd}
              hitSlop={HIT_SLOP}
              accessibilityRole="button"
              accessibilityLabel="Agregar otro local"
            >
              <Text style={styles.addLink}>Agregar otro local</Text>
            </Pressable>
          ) : null}
        </View>
        <View style={[styles.statusPill, isOpen ? styles.statusOn : styles.statusOff]}>
          <View
            style={[styles.dot, { backgroundColor: isOpen ? colors.success : colors.textMuted }]}
          />
          <Text style={[styles.statusText, { color: isOpen ? colors.success : colors.textMuted }]}>
            {!isActive ? 'Pendiente' : isOpen ? 'Abierto' : 'Cerrado'}
          </Text>
        </View>
      </View>

      <View style={[styles.openCard, cardShadow]}>
        <Text style={styles.openHint}>
          {!isActive
            ? 'Tu local aún no está activo en ZinApp'
            : isOpen
              ? 'Los clientes pueden pedir ahora'
              : 'Tu local aparece como cerrado'}
        </Text>
        <SlideAction
          label={isOpen ? 'Desliza para cerrar' : 'Desliza para abrir'}
          completeLabel={isOpen ? 'Cerrando…' : 'Abriendo…'}
          icon={isOpen ? 'pause' : 'storefront'}
          color={isOpen ? colors.textSecondary : colors.primary}
          disabled={!isActive || toggling}
          loading={toggling}
          onComplete={() => onToggleOpen(!isOpen)}
        />
      </View>

      <View style={styles.dayCard}>
        <Text style={styles.dayTitle}>Hoy</Text>
        <View style={styles.dayMetrics}>
          <DayMetric
            label="Ventas"
            value={formatCurrency(today?.net_sales ?? '0')}
            accent={colors.primaryDark}
          />
          <View style={styles.dayDivider} />
          <DayMetric
            label="Entregados"
            value={String(today?.orders_delivered ?? 0)}
            accent={colors.success}
          />
          <View style={styles.dayDivider} />
          <DayMetric label="Activos" value={String(activeOrders)} accent={colors.primary} />
        </View>
      </View>
    </View>
  );
}

function DayMetric({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent: string;
}) {
  return (
    <View style={styles.dayMetric}>
      <Text style={[styles.dayValue, { color: accent }]} numberOfLines={1}>
        {value}
      </Text>
      <Text style={styles.dayLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginBottom: 8, gap: 12 },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
  },
  titleBlock: { flex: 1, minWidth: 0, gap: 2 },
  titleLine: { flexDirection: 'row', alignItems: 'center', gap: 4, minWidth: 0 },
  eyebrow: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.primaryDark,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  title: { flexShrink: 1, fontSize: 24, fontWeight: '700', color: colors.text, letterSpacing: -0.4 },
  addLink: { fontSize: 13, fontWeight: '700', color: colors.primary, marginTop: 2 },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radii.pill,
  },
  statusOn: { backgroundColor: colors.success + '18' },
  statusOff: { backgroundColor: colors.background },
  dot: { width: 7, height: 7, borderRadius: 4 },
  statusText: { fontSize: 12, fontWeight: '700' },
  openCard: {
    backgroundColor: colors.surface,
    borderRadius: radii.card,
    padding: 14,
    gap: 10,
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  openHint: {
    fontSize: 13,
    fontWeight: '500',
    color: colors.textSecondary,
    textAlign: 'center',
  },
  dayCard: {
    backgroundColor: colors.surface,
    borderRadius: radii.card,
    padding: 14,
    gap: 10,
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  dayTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  dayMetrics: { flexDirection: 'row', alignItems: 'center' },
  dayMetric: { flex: 1, alignItems: 'center', gap: 2 },
  dayValue: { fontSize: 16, fontWeight: '700' },
  dayLabel: { fontSize: 12, fontWeight: '500', color: colors.textMuted },
  dayDivider: { width: StyleSheet.hairlineWidth, height: 28, backgroundColor: colors.border },
});
