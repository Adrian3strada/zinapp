import Ionicons from '@expo/vector-icons/Ionicons';
import { LinearGradient } from 'expo-linear-gradient';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors } from '../theme/colors';
import { cardShadow } from '../theme/shadows';
import { HIT_SLOP, spacing } from '../theme/spacing';
import { formatCurrency } from '../utils/format';

interface Props {
  itemCount: number;
  total: number;
  onPress: () => void;
}

function FloatingCartBar({ itemCount, total, onPress }: Props) {
  const insets = useSafeAreaInsets();

  if (itemCount === 0) return null;

  return (
    <Pressable
      style={[styles.wrapper, { bottom: insets.bottom + spacing.lg }]}
      onPress={onPress}
      hitSlop={HIT_SLOP}
    >
      <LinearGradient
        pointerEvents="none"
        colors={[colors.gradientStart, colors.gradientEnd]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={[styles.bar, cardShadow]}
      >
        <View style={styles.left}>
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{itemCount}</Text>
          </View>
          <Text style={styles.label}>Ver carrito</Text>
        </View>
        <Text style={styles.total}>{formatCurrency(total)}</Text>
        <Ionicons name="chevron-forward" size={20} color="#FFF" />
      </LinearGradient>
    </Pressable>
  );
}

export default React.memo(FloatingCartBar);

const styles = StyleSheet.create({
  wrapper: {
    position: 'absolute',
    left: spacing.screen,
    right: spacing.screen,
  },
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderRadius: 16,
    gap: 12,
  },
  left: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 },
  badge: {
    backgroundColor: 'rgba(255,255,255,0.25)',
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: { color: '#FFF', fontWeight: '800', fontSize: 14 },
  label: { color: '#FFF', fontWeight: '700', fontSize: 16 },
  total: { color: '#FFF', fontWeight: '800', fontSize: 17 },
});
