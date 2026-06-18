import Ionicons from '@expo/vector-icons/Ionicons';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import LiveBadge from './LiveBadge';
import { colors } from '../theme/colors';
import { spacing } from '../theme/spacing';
import { cardShadow } from '../theme/shadows';
import type { ActiveDeliveryItem } from '../context/CustomerActiveDeliveriesContext';

interface Props {
  items: ActiveDeliveryItem[];
  onPress: (item: ActiveDeliveryItem) => void;
}

export default function ActiveDeliveryStrip({ items, onPress }: Props) {
  if (items.length === 0) return null;

  return (
    <View style={styles.wrap}>
      <Text style={styles.heading}>
        {items.some((i) => i.isLive) ? 'En camino ahora' : 'Activos'}
      </Text>
      {items.map((item) => (
        <Pressable
          key={`${item.kind}-${item.id}`}
          style={({ pressed }) => [
            styles.card,
            item.isLive && styles.cardLive,
            pressed && styles.pressed,
          ]}
          onPress={() => onPress(item)}
        >
          <View style={[styles.iconWrap, item.isLive && styles.iconWrapLive]}>
            <Text style={styles.emoji}>{item.emoji}</Text>
          </View>
          <View style={styles.body}>
            <View style={styles.titleRow}>
              <Text style={styles.title}>{item.title}</Text>
              {item.isLive && <LiveBadge compact />}
            </View>
            <Text style={styles.subtitle} numberOfLines={1}>
              {item.subtitle}
            </Text>
            <Text style={[styles.status, item.isLive && styles.statusLive]}>
              {item.statusDisplay}
            </Text>
          </View>
          <View style={styles.arrow}>
            <Ionicons name="arrow-forward" size={16} color={colors.primary} />
          </View>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.sm },
  heading: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.text,
    letterSpacing: -0.3,
    marginBottom: 2,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: 18,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.borderLight,
    ...cardShadow,
  },
  cardLive: {
    borderColor: colors.primary + '44',
    backgroundColor: colors.primaryLight + '88',
  },
  pressed: { opacity: 0.94, transform: [{ scale: 0.996 }] },
  iconWrap: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconWrapLive: { backgroundColor: colors.surface },
  emoji: { fontSize: 24 },
  body: { flex: 1, gap: 2 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  title: { fontSize: 15, fontWeight: '800', color: colors.text },
  subtitle: { fontSize: 13, color: colors.textSecondary, fontWeight: '500' },
  status: { fontSize: 12, color: colors.textMuted, fontWeight: '700', marginTop: 2 },
  statusLive: { color: colors.primary },
  arrow: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
});
