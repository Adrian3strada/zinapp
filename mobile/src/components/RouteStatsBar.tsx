import Ionicons from '@expo/vector-icons/Ionicons';
import React from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { colors } from '../theme/colors';
import { formatRouteSummary } from '../utils/format';
import type { StreetRouteStats } from '../utils/routing';

interface RouteStatItem {
  label: string;
  stats: StreetRouteStats | null | undefined;
  icon?: keyof typeof Ionicons.glyphMap;
}

interface Props {
  items: RouteStatItem[];
  loading?: boolean;
}

function hasStats(stats: StreetRouteStats | null | undefined): stats is StreetRouteStats {
  return (
    stats != null
    && stats.distanceMeters != null
    && stats.durationSeconds != null
    && stats.distanceMeters > 0
  );
}

export default function RouteStatsBar({ items, loading = false }: Props) {
  const visible = items.filter((item) => hasStats(item.stats));

  if (loading && visible.length === 0) {
    return (
      <View style={styles.wrap}>
        <View style={styles.chip}>
          <ActivityIndicator size="small" color={colors.primary} />
          <Text style={styles.loadingText}>Calculando ruta…</Text>
        </View>
      </View>
    );
  }

  if (visible.length === 0) return null;

  return (
    <View style={styles.wrap}>
      {visible.map((item) => (
        <View key={item.label} style={styles.chip}>
          {item.icon && (
            <Ionicons name={item.icon} size={14} color={colors.primary} />
          )}
          <Text style={styles.label}>{item.label}</Text>
          <Text style={styles.value}>
            {item.stats!.isEstimated ? '~ ' : ''}
            {formatRouteSummary(item.stats!.distanceMeters!, item.stats!.durationSeconds!)}
          </Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: 8,
    marginTop: 10,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
    backgroundColor: colors.primaryLight,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  label: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textSecondary,
  },
  value: {
    fontSize: 12,
    fontWeight: '800',
    color: colors.text,
  },
  loadingText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textSecondary,
  },
});
