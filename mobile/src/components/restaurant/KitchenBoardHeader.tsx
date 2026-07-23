import Ionicons from '@expo/vector-icons/Ionicons';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { colors } from '../../theme/colors';

interface Props {
  topInset: number;
  restaurantName?: string | null;
  isOpen: boolean;
  counts: {
    kitchen: number;
    ready: number;
    delivery: number;
  };
}

/** Header compacto para la cola de cocina (sin hero marketing). */
export default function KitchenBoardHeader({
  topInset,
  restaurantName,
  isOpen,
  counts,
}: Props) {
  return (
    <View style={[styles.wrap, { paddingTop: topInset + 12 }]}>
      <View style={styles.titleRow}>
        <View style={styles.titleBlock}>
          <Text style={styles.eyebrow}>Cocina</Text>
          <Text style={styles.title} numberOfLines={1}>
            {restaurantName?.trim() || 'Pedidos'}
          </Text>
        </View>
        <View style={[styles.statusPill, isOpen ? styles.statusOn : styles.statusOff]}>
          <View
            style={[
              styles.dot,
              { backgroundColor: isOpen ? colors.success : colors.textMuted },
            ]}
          />
          <Text
            style={[styles.statusText, { color: isOpen ? colors.success : colors.textMuted }]}
          >
            {isOpen ? 'Abierto' : 'Cerrado'}
          </Text>
        </View>
      </View>

      <View style={styles.metrics}>
        <Metric icon="flame-outline" value={counts.kitchen} label="Cocina" accent={colors.accent} />
        <View style={styles.divider} />
        <Metric icon="bag-check-outline" value={counts.ready} label="Listos" accent={colors.success} />
        <View style={styles.divider} />
        <Metric icon="bicycle-outline" value={counts.delivery} label="En camino" accent={colors.primary} />
      </View>
    </View>
  );
}

function Metric({
  icon,
  value,
  label,
  accent,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  value: number;
  label: string;
  accent: string;
}) {
  return (
    <View style={styles.metric}>
      <Ionicons name={icon} size={16} color={accent} />
      <Text style={styles.metricValue}>{value}</Text>
      <Text style={styles.metricLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginBottom: 8, gap: 14 },
  titleRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 },
  titleBlock: { flex: 1, minWidth: 0, gap: 2 },
  eyebrow: {
    fontSize: 11,
    fontWeight: '800',
    color: colors.accentDark,
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
  metrics: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: 18,
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  metric: { flex: 1, alignItems: 'center', gap: 2 },
  metricValue: { fontSize: 18, fontWeight: '900', color: colors.text },
  metricLabel: { fontSize: 10, fontWeight: '700', color: colors.textMuted },
  divider: { width: 1, height: 28, backgroundColor: colors.border },
});
