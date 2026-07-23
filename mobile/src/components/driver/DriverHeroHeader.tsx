import Ionicons from '@expo/vector-icons/Ionicons';
import { LinearGradient } from 'expo-linear-gradient';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { colors } from '../../theme/colors';
import { spacing } from '../../theme/spacing';

export interface DriverStatItem {
  label: string;
  value: string | number;
  icon: keyof typeof Ionicons.glyphMap;
}

interface Props {
  topInset: number;
  firstName?: string | null;
  eyebrow?: string;
  title?: string;
  subtitle?: string;
  isAvailable?: boolean;
  stats?: DriverStatItem[];
  children?: React.ReactNode;
}

export default function DriverHeroHeader({
  topInset,
  firstName,
  eyebrow = 'Panel repartidor',
  title,
  subtitle,
  isAvailable,
  stats,
  children,
}: Props) {
  const greeting = firstName?.trim() ? `Hola, ${firstName}` : 'Hola, repartidor';
  const displayTitle = title ?? greeting;
  const status = isAvailable === undefined
    ? null
    : isAvailable
      ? { label: 'En línea · recibiendo pedidos', icon: 'radio-button-on' as const, tone: 'online' as const }
      : { label: 'Fuera de línea', icon: 'moon-outline' as const, tone: 'offline' as const };

  return (
    <LinearGradient
      colors={[colors.primary, colors.primaryDark, colors.gradientEnd]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={[styles.hero, { paddingTop: topInset + spacing.md }]}
    >
      <View style={styles.decorA} />
      <View style={styles.decorB} />

      <Text style={styles.eyebrow}>{eyebrow}</Text>

      <View style={styles.mainRow}>
        <View style={styles.iconWrap}>
          <Ionicons name="bicycle" size={30} color="#FFF" />
        </View>
        <View style={styles.textBlock}>
          <Text style={styles.title} numberOfLines={2}>
            {displayTitle}
          </Text>
          {subtitle ? (
            <Text style={styles.subtitle} numberOfLines={2}>
              {subtitle}
            </Text>
          ) : null}
          {status ? (
            <View style={[styles.statusPill, status.tone === 'online' ? styles.statusOnline : styles.statusOffline]}>
              <Ionicons name={status.icon} size={12} color="#FFF" />
              <Text style={styles.statusText}>{status.label}</Text>
            </View>
          ) : null}
        </View>
      </View>

      {stats && stats.length > 0 ? (
        <View style={styles.statsRow}>
          {stats.map((stat) => (
            <View key={stat.label} style={styles.statBox}>
              <Ionicons name={stat.icon} size={18} color="rgba(255,255,255,0.92)" />
              <Text style={styles.statValue}>{stat.value}</Text>
              <Text style={styles.statLabel}>{stat.label}</Text>
            </View>
          ))}
        </View>
      ) : null}

      {children}
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
    width: 150,
    height: 150,
    borderRadius: 75,
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
    bottom: 20,
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
  mainRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md },
  iconWrap: {
    width: 58,
    height: 58,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.18)',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.28)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  textBlock: { flex: 1, minWidth: 0, gap: 4 },
  title: { fontSize: 22, fontWeight: '800', color: '#FFF', letterSpacing: -0.3 },
  subtitle: { fontSize: 13, color: 'rgba(255,255,255,0.88)', lineHeight: 18, fontWeight: '500' },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 5,
    marginTop: 6,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
  },
  statusOnline: { backgroundColor: 'rgba(16, 185, 129, 0.35)' },
  statusOffline: { backgroundColor: 'rgba(255,255,255,0.16)' },
  statusText: { fontSize: 11, fontWeight: '700', color: '#FFF' },
  statsRow: { flexDirection: 'row', gap: 10, marginTop: spacing.lg },
  statBox: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.14)',
    borderRadius: 16,
    paddingVertical: 12,
    paddingHorizontal: 8,
    alignItems: 'center',
    gap: 2,
  },
  statValue: { fontSize: 20, fontWeight: '800', color: '#FFF', marginTop: 2 },
  statLabel: {
    fontSize: 10,
    color: 'rgba(255,255,255,0.82)',
    fontWeight: '600',
    textAlign: 'center',
  },
});
