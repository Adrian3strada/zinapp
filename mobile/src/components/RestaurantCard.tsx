import Ionicons from '@expo/vector-icons/Ionicons';
import React, { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors } from '../theme/colors';
import { cardShadow } from '../theme/shadows';
import type { Restaurant } from '../types';
import { getRestaurantVisual } from '../utils/foodVisuals';
import { resolveMediaUrl } from '../utils/media';
import { buildRestaurantMetaChips } from '../utils/restaurantMeta';
import FoodImage from './FoodImage';

interface Props {
  restaurant: Restaurant;
  onPress: () => void;
}

function RestaurantCard({ restaurant, onPress }: Props) {
  const visual = getRestaurantVisual(restaurant.name);
  const imageUri = resolveMediaUrl(restaurant.image_url ?? restaurant.image);
  const isOpen = restaurant.is_open !== false;
  const metaChips = useMemo(() => buildRestaurantMetaChips(restaurant), [restaurant]);

  return (
    <Pressable
      style={({ pressed }) => [
        styles.card,
        !isOpen && styles.closed,
        pressed && isOpen && styles.pressed,
      ]}
      onPress={onPress}
      disabled={!isOpen}
    >
      <FoodImage emoji={visual.emoji} color={visual.color} size="lg" imageUri={imageUri} />
      <View style={styles.content}>
        <View style={styles.nameRow}>
          <Text style={styles.name}>{restaurant.name}</Text>
          {isOpen ? (
            <View style={styles.openBadge}>
              <View style={styles.openDot} />
              <Text style={styles.openText}>Abierto</Text>
            </View>
          ) : (
            <Text style={styles.closedBadge}>Cerrado</Text>
          )}
        </View>
        <Text style={styles.desc} numberOfLines={2}>
          {restaurant.description || 'Comida local en Zinapécuaro'}
        </Text>
        <View style={styles.meta}>
          {metaChips.map((chip) => (
            <View key={`${chip.icon}-${chip.text}`} style={styles.metaChip}>
              <Ionicons
                name={chip.icon}
                size={13}
                color={chip.icon === 'star' ? colors.warning : colors.primary}
              />
              <Text style={styles.metaText}>{chip.text}</Text>
            </View>
          ))}
        </View>
        <Text style={styles.address} numberOfLines={1}>
          <Ionicons name="location-outline" size={12} color={colors.primary} />{' '}
          {restaurant.address}
        </Text>
      </View>
      <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
    </Pressable>
  );
}

export default React.memo(RestaurantCard);

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: 18,
    padding: 14,
    marginBottom: 14,
    gap: 14,
    borderWidth: 1,
    borderColor: colors.border,
    ...cardShadow,
  },
  pressed: { opacity: 0.94 },
  closed: { opacity: 0.65 },
  content: { flex: 1 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  name: { fontSize: 17, fontWeight: '700', color: colors.text, flex: 1 },
  openBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.success + '16',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  openDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.success },
  openText: { fontSize: 10, fontWeight: '700', color: colors.success },
  closedBadge: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.error,
    backgroundColor: colors.error + '18',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  desc: { fontSize: 13, color: colors.textSecondary, marginTop: 4, lineHeight: 18 },
  meta: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10 },
  metaChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.background,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  metaText: { fontSize: 11, color: colors.textSecondary, fontWeight: '600' },
  address: { fontSize: 11, color: colors.textMuted, marginTop: 8 },
});
