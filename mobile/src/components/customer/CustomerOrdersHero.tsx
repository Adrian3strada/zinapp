import { LinearGradient } from 'expo-linear-gradient';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { colors } from '../../theme/colors';
import { radii } from '../../theme/radii';
import { spacing } from '../../theme/spacing';

interface Props {
  topInset: number;
  activeCount: number;
  totalLoaded: number;
}

export default function CustomerOrdersHero({ topInset, activeCount, totalLoaded }: Props) {
  return (
    <LinearGradient
      colors={[colors.gradientStart, colors.gradientMid, colors.gradientEnd]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={[styles.hero, { paddingTop: topInset + spacing.md }]}
    >
      <Text style={styles.eyebrow}>Tus pedidos</Text>
      <Text style={styles.title}>Historial y seguimiento</Text>
      <Text style={styles.sub}>
        {activeCount > 0
          ? `${activeCount} pedido${activeCount === 1 ? '' : 's'} en curso`
          : 'Revisa el estado de tus pedidos anteriores'}
      </Text>
      {(activeCount > 0 || totalLoaded > 0) && (
        <View style={styles.metaRow}>
          {activeCount > 0 ? (
            <View style={styles.metaChip}>
              <Text style={styles.metaValue}>{activeCount}</Text>
              <Text style={styles.metaLabel}>activos</Text>
            </View>
          ) : null}
          <View style={styles.metaChip}>
            <Text style={styles.metaValue}>{totalLoaded}</Text>
            <Text style={styles.metaLabel}>recientes</Text>
          </View>
        </View>
      )}
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  hero: {
    marginHorizontal: -spacing.screen,
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.lg,
    marginBottom: spacing.md,
    borderBottomLeftRadius: radii.sheetLg,
    borderBottomRightRadius: radii.sheetLg,
    overflow: 'hidden',
  },
  eyebrow: {
    fontSize: 12,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.72)',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: spacing.xs,
  },
  title: { fontSize: 22, fontWeight: '700', color: '#FFF', letterSpacing: -0.3 },
  sub: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.88)',
    marginTop: 6,
    lineHeight: 20,
    fontWeight: '500',
  },
  metaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: spacing.md,
  },
  metaChip: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 5,
    backgroundColor: 'rgba(255,255,255,0.14)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radii.pill,
  },
  metaValue: { fontSize: 15, fontWeight: '700', color: '#FFF' },
  metaLabel: { fontSize: 12, fontWeight: '500', color: 'rgba(255,255,255,0.8)' },
});
