import Ionicons from '@expo/vector-icons/Ionicons';
import React from 'react';
import { Pressable, StyleSheet, Text, View, ViewStyle } from 'react-native';

import { BrandMark } from './BrandLogo';
import HeroBackground from './HeroBackground';
import ProfileAvatarDisplay from './ProfileAvatarDisplay';
import { colors } from '../theme/colors';
import { spacing } from '../theme/spacing';

interface Props {
  firstName?: string | null;
  avatarUrl?: string | null;
  subtitle?: string;
  onProfilePress?: () => void;
  topInset: number;
  style?: ViewStyle;
  children?: React.ReactNode;
  stats?: { label: string; value: string | number; icon: keyof typeof Ionicons.glyphMap }[];
}

function initials(name?: string | null): string {
  const n = (name ?? 'Z').trim();
  return n.charAt(0).toUpperCase() || 'Z';
}

export default function HomeHero({
  firstName,
  avatarUrl,
  subtitle = 'Zinapécuaro, Mich.',
  onProfilePress,
  topInset,
  style,
  children,
  stats,
}: Props) {
  const greeting = firstName?.trim() ? `Hola, ${firstName}` : 'Hola';

  return (
    <HeroBackground
      colors={[colors.gradientStart, colors.gradientMid, colors.gradientEnd]}
      style={[styles.hero, { paddingTop: topInset + spacing.lg }, style]}
    >
      <View style={styles.decorA} pointerEvents="none" />
      <View style={styles.decorB} pointerEvents="none" />

      <View style={styles.row}>
        <View style={styles.textBlock}>
          <View style={styles.brandRow}>
            <BrandMark size={32} variant="light" />
            <Text style={styles.brandLabel}>ZinApp</Text>
          </View>
          <Text style={styles.greeting}>{greeting}</Text>
          <View style={styles.locationRow}>
            <View style={styles.locationPill}>
              <Ionicons name="location" size={14} color="#FFF" />
              <Text style={styles.location}>{subtitle}</Text>
            </View>
          </View>
        </View>
        {onProfilePress ? (
          <Pressable
            onPress={onProfilePress}
            style={styles.avatarBtn}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="Ir a mi perfil"
          >
            <ProfileAvatarDisplay
              remoteUrl={avatarUrl}
              fallbackLetter={initials(firstName)}
              size={44}
              variant="hero"
            />
          </Pressable>
        ) : null}
      </View>

      {stats && stats.length > 0 ? (
        <View style={styles.statsRow}>
          {stats.map((stat) => (
            <View key={stat.label} style={styles.statBox}>
              <Ionicons name={stat.icon} size={16} color="rgba(255,255,255,0.92)" />
              <Text style={styles.statValue}>{stat.value}</Text>
              <Text style={styles.statLabel}>{stat.label}</Text>
            </View>
          ))}
        </View>
      ) : null}

      {children}
    </HeroBackground>
  );
}

const styles = StyleSheet.create({
  hero: {
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.xl,
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
    overflow: 'hidden',
  },
  decorA: {
    position: 'absolute',
    width: 180,
    height: 180,
    borderRadius: 90,
    backgroundColor: 'rgba(255,255,255,0.08)',
    top: -40,
    right: -50,
  },
  decorB: {
    position: 'absolute',
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: 'rgba(255,255,255,0.06)',
    bottom: 20,
    left: -30,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  textBlock: { flex: 1, paddingRight: spacing.md },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: spacing.sm,
  },
  brandLabel: {
    fontSize: 15,
    fontWeight: '800',
    color: 'rgba(255,255,255,0.92)',
    letterSpacing: 0.4,
  },
  greeting: {
    fontSize: 26,
    fontWeight: '800',
    color: '#FFF',
    letterSpacing: -0.5,
    marginTop: 2,
  },
  locationRow: { marginTop: spacing.sm },
  locationPill: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 6,
    backgroundColor: 'rgba(255,255,255,0.16)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  location: { color: 'rgba(255,255,255,0.95)', fontSize: 13, fontWeight: '600' },
  avatarBtn: {
    borderRadius: 24,
    overflow: 'hidden',
  },
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
