import Ionicons from '@expo/vector-icons/Ionicons';
import { LinearGradient } from 'expo-linear-gradient';
import React from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';

import { colors } from '../../theme/colors';
import { radii } from '../../theme/radii';
import { HIT_SLOP, spacing } from '../../theme/spacing';
import type { Restaurant } from '../../types';
import { formatRestaurantSchedule } from '../../utils/restaurantMeta';
import { resolveMediaUrl } from '../../utils/media';

export interface RestaurantStatItem {
  label: string;
  value: string | number;
  icon: keyof typeof Ionicons.glyphMap;
}

interface Props {
  restaurant: Restaurant | null;
  topInset: number;
  eyebrow?: string;
  title?: string;
  subtitle?: string;
  stats?: RestaurantStatItem[];
  actionIcon?: keyof typeof Ionicons.glyphMap;
  actionLabel?: string;
  onActionPress?: () => void;
  canSwitch?: boolean;
  onTitlePress?: () => void;
  children?: React.ReactNode;
}

function storeStatus(restaurant: Restaurant | null): {
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  tone: 'success' | 'warning' | 'muted';
} {
  if (!restaurant) {
    return { label: 'Sin local', icon: 'storefront-outline', tone: 'muted' };
  }
  if (!restaurant.is_active) {
    return { label: 'Pendiente de activación', icon: 'hourglass-outline', tone: 'warning' };
  }
  if (restaurant.accepting_orders === false || restaurant.is_open === false) {
    return { label: 'Cerrado a pedidos', icon: 'moon-outline', tone: 'muted' };
  }
  return { label: 'Recibiendo pedidos', icon: 'radio-button-on', tone: 'success' };
}

export default function RestaurantHeroHeader({
  restaurant,
  topInset,
  eyebrow = 'Panel del negocio',
  title,
  subtitle,
  stats,
  actionIcon = 'add',
  actionLabel = 'Acción principal',
  onActionPress,
  canSwitch,
  onTitlePress,
  children,
}: Props) {
  const status = storeStatus(restaurant);
  const hours = restaurant ? formatRestaurantSchedule(restaurant) : null;
  const displayTitle = title ?? restaurant?.name ?? 'Tu restaurante';
  const imageUri = resolveMediaUrl(restaurant?.image_url ?? restaurant?.image);

  const toneStyles = {
    success: styles.statusSuccess,
    warning: styles.statusWarning,
    muted: styles.statusMuted,
  }[status.tone];

  return (
    <LinearGradient
      colors={[colors.gradientStart, colors.gradientMid, colors.gradientEnd]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={[styles.hero, { paddingTop: topInset + spacing.md }]}
    >
      <Text style={styles.eyebrow}>{eyebrow}</Text>

      <View style={styles.mainRow}>
        <View style={styles.logoWrap}>
          {imageUri ? (
            <Image source={{ uri: imageUri }} style={styles.logoImage} />
          ) : (
            <View style={styles.logoPlaceholder}>
              <Ionicons name="storefront" size={28} color="#FFF" />
            </View>
          )}
        </View>

        <View style={styles.textBlock}>
          <Pressable
            style={styles.titlePress}
            onPress={canSwitch ? onTitlePress : undefined}
            disabled={!canSwitch}
            accessibilityRole={canSwitch ? 'button' : undefined}
            accessibilityLabel={canSwitch ? 'Cambiar de local' : undefined}
          >
            <Text style={styles.title} numberOfLines={2}>
              {displayTitle}
            </Text>
            {canSwitch ? (
              <Ionicons name="chevron-down" size={18} color="#FFF" />
            ) : null}
          </Pressable>
          {subtitle ? (
            <Text style={styles.subtitle} numberOfLines={2}>
              {subtitle}
            </Text>
          ) : hours ? (
            <View style={styles.metaRow}>
              <Ionicons name="time-outline" size={14} color="rgba(255,255,255,0.85)" />
              <Text style={styles.metaText}>{hours}</Text>
            </View>
          ) : null}
          <View style={[styles.statusPill, toneStyles]}>
            <Ionicons name={status.icon} size={12} color="#FFF" />
            <Text style={styles.statusText}>{status.label}</Text>
          </View>
        </View>

        {onActionPress ? (
          <Pressable
            style={styles.actionBtn}
            onPress={onActionPress}
            hitSlop={HIT_SLOP}
            accessibilityRole="button"
            accessibilityLabel={actionLabel}
          >
            <Ionicons name={actionIcon} size={22} color={colors.primary} />
          </Pressable>
        ) : null}
      </View>

      {stats && stats.length > 0 ? (
        <View style={styles.statsRow}>
          {stats.map((stat) => (
            <View key={stat.label} style={styles.statBox}>
              <Ionicons name={stat.icon} size={18} color="rgba(255,255,255,0.9)" />
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
    marginBottom: spacing.lg,
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
  mainRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
  },
  logoWrap: {
    width: 56,
    height: 56,
    borderRadius: radii.card,
    overflow: 'hidden',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.3)',
    backgroundColor: 'rgba(255,255,255,0.15)',
  },
  logoImage: { width: '100%', height: '100%', resizeMode: 'cover' },
  logoPlaceholder: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  textBlock: { flex: 1, minWidth: 0, gap: 4 },
  titlePress: { flexDirection: 'row', alignItems: 'flex-start', gap: 6, minWidth: 0 },
  title: {
    flex: 1,
    fontSize: 22,
    fontWeight: '700',
    color: '#FFF',
    letterSpacing: -0.3,
  },
  subtitle: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.88)',
    lineHeight: 18,
    fontWeight: '500',
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
    minWidth: 0,
  },
  metaText: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.85)',
    fontWeight: '500',
    flex: 1,
    minWidth: 0,
    flexShrink: 1,
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 5,
    marginTop: 6,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radii.pill,
  },
  statusSuccess: { backgroundColor: 'rgba(16, 185, 129, 0.35)' },
  statusWarning: { backgroundColor: 'rgba(245, 158, 11, 0.4)' },
  statusMuted: { backgroundColor: 'rgba(255,255,255,0.18)' },
  statusText: { fontSize: 12, fontWeight: '600', color: '#FFF' },
  actionBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#FFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  statsRow: { flexDirection: 'row', gap: 10, marginTop: spacing.md },
  statBox: {
    flex: 1,
    minWidth: 0,
    backgroundColor: 'rgba(255,255,255,0.14)',
    borderRadius: radii.xl,
    paddingVertical: 10,
    paddingHorizontal: 8,
    alignItems: 'center',
    gap: 2,
  },
  statValue: { fontSize: 18, fontWeight: '700', color: '#FFF', marginTop: 2 },
  statLabel: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.82)',
    fontWeight: '500',
    textAlign: 'center',
  },
});
