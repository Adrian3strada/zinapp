import Ionicons from '@expo/vector-icons/Ionicons';
import { LinearGradient } from 'expo-linear-gradient';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors } from '../theme/colors';
import { HIT_SLOP, spacing } from '../theme/spacing';
import { elevatedShadow } from '../theme/shadows';
import { formatCurrency } from '../utils/format';
import { webPassThroughPointerEvents } from '../utils/webPlatform';

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
      style={[styles.wrapper, { bottom: Math.max(insets.bottom, spacing.sm) + spacing.md }]}
      onPress={onPress}
      hitSlop={HIT_SLOP}
      accessibilityRole="button"
      accessibilityLabel={`Ver carrito, ${itemCount} productos`}
    >
      <LinearGradient
        colors={[colors.primary, colors.primaryDark]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        pointerEvents={webPassThroughPointerEvents()}
        style={styles.bar}
      >
        <View style={styles.left}>
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{itemCount}</Text>
          </View>
          <Text style={styles.label} numberOfLines={1}>
            Ver carrito
          </Text>
        </View>
        <Text style={styles.total} numberOfLines={1}>
          {formatCurrency(total)}
        </Text>
        <View style={styles.arrow}>
          <Ionicons name="arrow-forward" size={18} color={colors.primary} />
        </View>
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
    ...elevatedShadow,
    borderRadius: 18,
  },
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 58,
    paddingVertical: 15,
    paddingHorizontal: 18,
    borderRadius: 18,
    gap: 10,
  },
  left: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: 10 },
  badge: {
    backgroundColor: 'rgba(255,255,255,0.22)',
    minWidth: 30,
    height: 30,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
    flexShrink: 0,
  },
  badgeText: { color: '#FFF', fontWeight: '800', fontSize: 14 },
  label: { color: '#FFF', fontWeight: '700', fontSize: 16, flexShrink: 1 },
  total: { color: '#FFF', fontWeight: '800', fontSize: 17, flexShrink: 0 },
  arrow: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#FFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
