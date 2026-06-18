import Ionicons from '@expo/vector-icons/Ionicons';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors } from '../theme/colors';
import { spacing } from '../theme/spacing';
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
      <View style={styles.imageWrap}>
        <FoodImage
          emoji={visual.emoji}
          color={visual.color}
          size="lg"
          imageUri={imageUri}
          style={styles.coverImage}
        />
        <LinearGradient
          colors={['transparent', 'rgba(15,23,42,0.55)']}
          style={styles.imageGradient}
        />
        <View style={styles.imageBadge}>
          {isOpen ? (
            <View style={styles.openBadge}>
              <View style={styles.openDot} />
              <Text style={styles.openText}>Abierto</Text>
            </View>
          ) : (
            <Text style={styles.closedBadge}>Cerrado</Text>
          )}
        </View>
        <View style={styles.emojiBadge}>
          <Text style={styles.emoji}>{visual.emoji}</Text>
        </View>
      </View>

      <View style={styles.body}>
        <Text style={styles.name} numberOfLines={1}>
          {restaurant.name}
        </Text>
        <Text style={styles.desc} numberOfLines={2}>
          {restaurant.description || 'Comida local en Zinapécuaro'}
        </Text>
        {metaChips.length > 0 && (
          <View style={styles.meta}>
            {metaChips.slice(0, 3).map((chip) => (
              <View key={`${chip.icon}-${chip.text}`} style={styles.metaChip}>
                <Ionicons
                  name={chip.icon}
                  size={12}
                  color={chip.icon === 'star' ? colors.warning : colors.primary}
                />
                <Text style={styles.metaText}>{chip.text}</Text>
              </View>
            ))}
          </View>
        )}
        <View style={styles.footer}>
          <Ionicons name="location-outline" size={14} color={colors.primary} />
          <Text style={styles.address} numberOfLines={1}>
            {restaurant.address}
          </Text>
          <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
        </View>
      </View>
    </Pressable>
  );
}

export default React.memo(RestaurantCard);

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: 22,
    marginBottom: spacing.lg,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.borderLight,
    ...cardShadow,
  },
  pressed: { opacity: 0.96 },
  closed: { opacity: 0.72 },
  imageWrap: {
    height: 148,
    backgroundColor: colors.primaryLight,
    position: 'relative',
  },
  coverImage: {
    width: '100%',
    height: 148,
    borderRadius: 0,
  },
  imageGradient: {
    ...StyleSheet.absoluteFillObject,
  },
  imageBadge: {
    position: 'absolute',
    top: 12,
    right: 12,
  },
  emojiBadge: {
    position: 'absolute',
    bottom: 12,
    left: 12,
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.92)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  emoji: { fontSize: 22 },
  openBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(255,255,255,0.95)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
  },
  openDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: colors.success },
  openText: { fontSize: 11, fontWeight: '800', color: colors.success },
  closedBadge: {
    fontSize: 11,
    fontWeight: '800',
    color: colors.error,
    backgroundColor: 'rgba(255,255,255,0.95)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
  },
  body: { padding: spacing.lg },
  name: { fontSize: 18, fontWeight: '800', color: colors.text, letterSpacing: -0.2 },
  desc: { fontSize: 13, color: colors.textSecondary, marginTop: 6, lineHeight: 19 },
  meta: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 },
  metaChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.background,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 10,
  },
  metaText: { fontSize: 11, color: colors.textSecondary, fontWeight: '700' },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: colors.borderLight,
  },
  address: { flex: 1, fontSize: 12, color: colors.textMuted, fontWeight: '500' },
});
