import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { colors } from '../theme/colors';

interface Props {
  label?: string;
  suffix?: string | null;
  compact?: boolean;
}

export default function LiveBadge({ label = 'En vivo', suffix, compact = false }: Props) {
  return (
    <View style={[styles.badge, compact && styles.badgeCompact]}>
      <View style={[styles.dot, compact && styles.dotCompact]} />
      <Text style={[styles.text, compact && styles.textCompact]}>{label}</Text>
      {suffix ? <Text style={[styles.suffix, compact && styles.textCompact]}>· {suffix}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: colors.success + '18',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 20,
    gap: 6,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.success,
  },
  text: { fontSize: 12, fontWeight: '700', color: colors.success },
  suffix: { fontSize: 12, color: colors.textSecondary },
  badgeCompact: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 14, gap: 4 },
  dotCompact: { width: 6, height: 6, borderRadius: 3 },
  textCompact: { fontSize: 10 },
});
