import Ionicons from '@expo/vector-icons/Ionicons';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { colors, statusColors } from '../theme/colors';

const STATUS_ICONS: Record<string, keyof typeof Ionicons.glyphMap> = {
  pending: 'time-outline',
  accepted: 'checkmark-circle-outline',
  preparing: 'flame-outline',
  ready: 'bag-check-outline',
  picked_up: 'cube-outline',
  on_the_way: 'bicycle-outline',
  delivered: 'happy-outline',
  cancelled: 'close-circle-outline',
};

interface Props {
  status: string;
  label: string;
  large?: boolean;
}

export default function OrderStatusBadge({ status, label, large }: Props) {
  const color = statusColors[status] ?? colors.primary;
  const icon = STATUS_ICONS[status] ?? 'ellipse-outline';

  return (
    <View style={[styles.badge, { backgroundColor: color + '18' }, large && styles.large]}>
      <Ionicons name={icon} size={large ? 22 : 16} color={color} />
      <Text style={[styles.text, { color }, large && styles.largeText]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  large: { paddingHorizontal: 16, paddingVertical: 10 },
  text: { fontSize: 13, fontWeight: '600' },
  largeText: { fontSize: 16 },
});
