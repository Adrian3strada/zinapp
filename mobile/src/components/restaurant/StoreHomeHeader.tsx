import Ionicons from '@expo/vector-icons/Ionicons';
import { useNavigation } from '@react-navigation/native';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import SlideAction from '../driver/SlideAction';
import type { RestaurantTabParamList } from '../../navigation/types';
import { colors } from '../../theme/colors';
import { HIT_SLOP } from '../../theme/spacing';
import { cardShadow } from '../../theme/shadows';
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
  onToggleOpen: (open: boolean) => void;
}

/** Home del negocio: abrir/cerrar + resumen del día + atajos. */
export default function StoreHomeHeader({
  topInset,
  restaurant,
  today,
  kitchenCount,
  readyCount,
  deliveryCount,
  toggling,
  onToggleOpen,
}: Props) {
  const navigation = useNavigation<BottomTabNavigationProp<RestaurantTabParamList>>();
  const isActive = !!restaurant?.is_active;
  const isOpen = isActive && restaurant?.accepting_orders !== false;

  return (
    <View style={[styles.wrap, { paddingTop: topInset + 12 }]}>
      <View style={styles.titleRow}>
        <View style={styles.titleBlock}>
          <Text style={styles.eyebrow}>Tu negocio</Text>
          <Text style={styles.title} numberOfLines={1}>
            {restaurant?.name?.trim() || 'Pedidos'}
          </Text>
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
          <DayMetric
            label="Activos"
            value={String(today?.orders_active ?? kitchenCount + readyCount + deliveryCount)}
            accent={colors.primary}
          />
        </View>
        <View style={styles.pipeline}>
          <PipeChip icon="flame-outline" label="Cocina" count={kitchenCount} />
          <PipeChip icon="bag-check-outline" label="Listos" count={readyCount} />
          <PipeChip icon="bicycle-outline" label="Camino" count={deliveryCount} />
        </View>
      </View>

      <View style={styles.shortcuts}>
        <Pressable
          style={styles.shortcut}
          onPress={() => navigation.navigate('MiNegocio')}
          hitSlop={HIT_SLOP}
        >
          <Ionicons name="restaurant-outline" size={18} color={colors.primaryDark} />
          <Text style={styles.shortcutText}>Menú</Text>
        </Pressable>
        <Pressable
          style={[styles.shortcut, styles.shortcutPrimary]}
          onPress={() => navigation.navigate('Perfil')}
          hitSlop={HIT_SLOP}
        >
          <Ionicons name="settings-outline" size={18} color="#FFF" />
          <Text style={[styles.shortcutText, styles.shortcutTextPrimary]}>Negocio</Text>
        </Pressable>
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

function PipeChip({
  icon,
  label,
  count,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  count: number;
}) {
  return (
    <View style={styles.pipeChip}>
      <Ionicons name={icon} size={14} color={colors.primaryDark} />
      <Text style={styles.pipeLabel}>{label}</Text>
      <View style={styles.pipeBadge}>
        <Text style={styles.pipeCount}>{count}</Text>
      </View>
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
  eyebrow: {
    fontSize: 11,
    fontWeight: '800',
    color: colors.primaryDark,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  title: { fontSize: 24, fontWeight: '900', color: colors.text, letterSpacing: -0.4 },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 20,
  },
  statusOn: { backgroundColor: colors.success + '18' },
  statusOff: { backgroundColor: colors.background },
  dot: { width: 7, height: 7, borderRadius: 4 },
  statusText: { fontSize: 11, fontWeight: '800' },
  openCard: {
    backgroundColor: colors.surface,
    borderRadius: 20,
    padding: 14,
    gap: 10,
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  openHint: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textSecondary,
    textAlign: 'center',
  },
  dayCard: {
    backgroundColor: colors.primaryLight,
    borderRadius: 18,
    padding: 14,
    gap: 12,
    borderWidth: 1,
    borderColor: colors.primary + '33',
  },
  dayTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: colors.primaryDark,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  dayMetrics: { flexDirection: 'row', alignItems: 'center' },
  dayMetric: { flex: 1, alignItems: 'center', gap: 2 },
  dayValue: { fontSize: 16, fontWeight: '900' },
  dayLabel: { fontSize: 10, fontWeight: '700', color: colors.textMuted },
  dayDivider: { width: 1, height: 28, backgroundColor: colors.primary + '44' },
  pipeline: { flexDirection: 'row', gap: 8 },
  pipeChip: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    backgroundColor: colors.surface,
    borderRadius: 12,
    paddingVertical: 8,
    paddingHorizontal: 6,
  },
  pipeLabel: { fontSize: 11, fontWeight: '700', color: colors.text },
  pipeBadge: {
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  pipeCount: { fontSize: 10, fontWeight: '900', color: '#FFF' },
  shortcuts: { flexDirection: 'row', gap: 10 },
  shortcut: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    borderRadius: 14,
    backgroundColor: colors.primaryLight,
    borderWidth: 1,
    borderColor: colors.primary + '55',
  },
  shortcutPrimary: { backgroundColor: colors.primary, borderColor: colors.primary },
  shortcutText: { fontSize: 13, fontWeight: '800', color: colors.primaryDark },
  shortcutTextPrimary: { color: '#FFF' },
});
