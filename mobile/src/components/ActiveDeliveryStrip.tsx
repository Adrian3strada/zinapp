import Ionicons from '@expo/vector-icons/Ionicons';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import LiveBadge from './LiveBadge';
import { colors } from '../theme/colors';
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
        {items.some((i) => i.isLive) ? 'En camino ahora' : 'Pedidos y envíos activos'}
      </Text>
      {items.map((item) => (
        <Pressable
          key={`${item.kind}-${item.id}`}
          style={({ pressed }) => [styles.card, pressed && styles.pressed]}
          onPress={() => onPress(item)}
        >
          <View style={styles.iconWrap}>
            <Text style={styles.emoji}>{item.emoji}</Text>
          </View>
          <View style={styles.body}>
            <View style={styles.titleRow}>
              <Text style={styles.title}>{item.title}</Text>
              {item.isLive && <LiveBadge compact />}
            </View>
            <Text style={styles.subtitle} numberOfLines={1}>{item.subtitle}</Text>
            <Text style={styles.status}>{item.statusDisplay}</Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 10, marginBottom: 4 },
  heading: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.text,
    marginBottom: 2,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.border,
    ...cardShadow,
  },
  pressed: { opacity: 0.92 },
  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emoji: { fontSize: 22 },
  body: { flex: 1, gap: 2 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  title: { fontSize: 15, fontWeight: '800', color: colors.text },
  subtitle: { fontSize: 13, color: colors.textSecondary, fontWeight: '500' },
  status: { fontSize: 12, color: colors.primary, fontWeight: '700', marginTop: 2 },
});
