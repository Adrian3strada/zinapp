import Ionicons from '@expo/vector-icons/Ionicons';
import { LinearGradient } from 'expo-linear-gradient';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { colors } from '../../theme/colors';
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
      <View style={styles.decorA} />
      <View style={styles.decorB} />
      <Text style={styles.eyebrow}>Tus pedidos</Text>
      <Text style={styles.title}>Historial y seguimiento</Text>
      <Text style={styles.sub}>
        {activeCount > 0
          ? `${activeCount} pedido${activeCount === 1 ? '' : 's'} en curso ahora mismo`
          : 'Revisa el estado de tus pedidos anteriores'}
      </Text>
      <View style={styles.statsRow}>
        <View style={styles.statBox}>
          <Ionicons name="pulse-outline" size={16} color="rgba(255,255,255,0.92)" />
          <Text style={styles.statValue}>{activeCount}</Text>
          <Text style={styles.statLabel}>Activos</Text>
        </View>
        <View style={styles.statBox}>
          <Ionicons name="receipt-outline" size={16} color="rgba(255,255,255,0.92)" />
          <Text style={styles.statValue}>{totalLoaded}</Text>
          <Text style={styles.statLabel}>Recientes</Text>
        </View>
        <View style={styles.statBox}>
          <Ionicons name="map-outline" size={16} color="rgba(255,255,255,0.92)" />
          <Text style={styles.statValue}>Live</Text>
          <Text style={styles.statLabel}>Mapa</Text>
        </View>
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  hero: {
    marginHorizontal: -spacing.screen,
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.lg,
    marginBottom: spacing.md,
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
    overflow: 'hidden',
  },
  decorA: {
    position: 'absolute',
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: 'rgba(255,255,255,0.08)',
    top: -40,
    right: -30,
  },
  decorB: {
    position: 'absolute',
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(255,255,255,0.06)',
    bottom: 16,
    left: -20,
  },
  eyebrow: {
    fontSize: 11,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.75)',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: spacing.sm,
  },
  title: { fontSize: 22, fontWeight: '800', color: '#FFF', letterSpacing: -0.3 },
  sub: { fontSize: 13, color: 'rgba(255,255,255,0.88)', marginTop: 6, lineHeight: 18, fontWeight: '500' },
  statsRow: { flexDirection: 'row', gap: 10, marginTop: spacing.lg },
  statBox: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.14)',
    borderRadius: 16,
    paddingVertical: 10,
    paddingHorizontal: 6,
    alignItems: 'center',
    gap: 2,
  },
  statValue: { fontSize: 18, fontWeight: '800', color: '#FFF', marginTop: 2 },
  statLabel: {
    fontSize: 10,
    color: 'rgba(255,255,255,0.82)',
    fontWeight: '600',
    textAlign: 'center',
  },
});
