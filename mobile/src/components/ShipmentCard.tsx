import Ionicons from '@expo/vector-icons/Ionicons';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import LiveBadge from './LiveBadge';
import OrderStatusBadge from './OrderStatusBadge';
import { colors, statusColors } from '../theme/colors';
import { cardShadow } from '../theme/shadows';
import type { Shipment } from '../types';
import { formatCurrency } from '../utils/format';

const ACTIVE = ['pending', 'picked_up', 'on_the_way'];

interface Props {
  item: Shipment;
  onPress: () => void;
}

export default function ShipmentCard({ item, onPress }: Props) {
  const isActive = ACTIVE.includes(item.status);
  const isLive = item.status === 'on_the_way';
  const accent = statusColors[item.status] ?? colors.primary;

  return (
    <Pressable
      style={({ pressed }) => [
        styles.card,
        isActive && { borderLeftColor: accent },
        isLive && styles.cardLive,
        pressed && styles.pressed,
      ]}
      onPress={onPress}
    >
      <View style={styles.emojiBox}>
        <Text style={styles.emoji}>📦</Text>
      </View>
      <View style={styles.content}>
        <Text style={styles.title}>Envío #{item.id}</Text>
        <Text style={styles.meta}>
          {item.size_display} · {item.description}
        </Text>
        <View style={styles.badgeRow}>
          <OrderStatusBadge status={item.status} label={item.status_display} />
          {isLive && <LiveBadge label="En camino" />}
        </View>
        <Text style={styles.route} numberOfLines={2}>
          {item.pickup_address} → {item.delivery_address}
        </Text>
        <Text style={styles.date}>
          {new Date(item.created_at).toLocaleDateString('es-MX', {
            day: 'numeric',
            month: 'short',
            hour: '2-digit',
            minute: '2-digit',
          })}
        </Text>
      </View>
      <View style={styles.right}>
        <Text style={styles.total}>{formatCurrency(item.total)}</Text>
        <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: colors.surface,
    borderRadius: 22,
    padding: 16,
    marginBottom: 10,
    borderLeftWidth: 4,
    borderLeftColor: 'transparent',
    borderWidth: 1,
    borderColor: colors.borderLight,
    ...cardShadow,
  },
  cardLive: {
    borderColor: colors.success + '55',
    borderLeftColor: colors.success,
    backgroundColor: colors.primaryLight + '44',
  },
  pressed: { opacity: 0.92 },
  emojiBox: {
    width: 48,
    height: 48,
    borderRadius: 16,
    backgroundColor: colors.success + '18',
    alignItems: 'center',
    justifyContent: 'center',
  },
  emoji: { fontSize: 24 },
  content: { flex: 1 },
  title: { fontSize: 16, fontWeight: '800', color: colors.text, letterSpacing: -0.2 },
  meta: { fontSize: 13, color: colors.textSecondary, marginTop: 2 },
  badgeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 6 },
  route: { fontSize: 11, color: colors.textMuted, marginTop: 6, lineHeight: 16 },
  date: { fontSize: 11, color: colors.textMuted, marginTop: 4 },
  right: { alignItems: 'flex-end', gap: 8 },
  total: { fontSize: 16, fontWeight: '800', color: colors.primary },
});
