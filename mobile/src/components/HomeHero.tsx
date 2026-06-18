import Ionicons from '@expo/vector-icons/Ionicons';
import { LinearGradient } from 'expo-linear-gradient';
import React from 'react';
import { Pressable, StyleSheet, Text, View, ViewStyle } from 'react-native';

import { BrandMark } from './BrandLogo';
import { colors } from '../theme/colors';
import { spacing } from '../theme/spacing';

interface Props {
  firstName?: string | null;
  subtitle?: string;
  onProfilePress?: () => void;
  topInset: number;
  style?: ViewStyle;
  children?: React.ReactNode;
}

function initials(name?: string | null): string {
  const n = (name ?? 'Z').trim();
  return n.charAt(0).toUpperCase() || 'Z';
}

export default function HomeHero({
  firstName,
  subtitle = 'Zinapécuaro, Mich.',
  onProfilePress,
  topInset,
  style,
  children,
}: Props) {
  const greeting = firstName?.trim() ? `Hola, ${firstName}` : 'Hola';

  return (
    <LinearGradient
      colors={[colors.gradientStart, colors.gradientMid, colors.gradientEnd]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={[styles.hero, { paddingTop: topInset + spacing.lg }, style]}
    >
      <View style={styles.decorA} />
      <View style={styles.decorB} />

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
            accessibilityLabel="Ir a mi perfil"
          >
            <Text style={styles.avatarText}>{initials(firstName)}</Text>
          </Pressable>
        ) : null}
      </View>

      {children}
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  hero: {
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.xxl + 4,
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
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(255,255,255,0.22)',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { color: '#FFF', fontSize: 20, fontWeight: '800' },
});
