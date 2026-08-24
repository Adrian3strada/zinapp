import Ionicons from '@expo/vector-icons/Ionicons';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import FavoriteHeart from './FavoriteHeart';
import FoodImage from './FoodImage';
import { colors } from '../theme/colors';
import { radii } from '../theme/radii';
import { cardShadow } from '../theme/shadows';
import { spacing } from '../theme/spacing';
import type { HomeRestaurant } from '../types';
import { getRestaurantVisual } from '../utils/foodVisuals';
import { resolveMediaUrl } from '../utils/media';
import { formatDeliveryFeeLabel, formatRatingLabel } from '../utils/restaurantMeta';
import { categoryEmoji } from '../utils/restaurantCategories';

interface Props {
  restaurant: HomeRestaurant;
  onPress: () => void;
  onToggleFavorite?: () => void;
  showFavorite?: boolean;
}

export default function HomeRestaurantCard({
  restaurant,
  onPress,
  onToggleFavorite,
  showFavorite,
}: Props) {
  const visual = getRestaurantVisual(restaurant.name);
  const imageUri = resolveMediaUrl(restaurant.image_url);
  const isOpen = restaurant.is_open !== false;
  const rating = formatRatingLabel(restaurant);
  const fee = formatDeliveryFeeLabel().replace(/^Envío\s+/i, '');
  const categoryLabel = restaurant.category_display
    || restaurant.category
    || '';

  return (
    <Pressable
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${restaurant.name}${isOpen ? ', abierto' : ', cerrado'}`}
    >
      <View style={styles.imageWrap}>
        <FoodImage
          emoji={visual.emoji}
          color={visual.color}
          size="md"
          imageUri={imageUri}
          style={styles.image}
        />
        {isOpen ? (
          <View style={styles.openBadge}>
            <Text style={styles.openBadgeText}>Abierto</Text>
          </View>
        ) : (
          <View style={[styles.openBadge, styles.closedBadge]}>
            <Text style={styles.openBadgeText}>Cerrado</Text>
          </View>
        )}
        {restaurant.has_active_promo ? (
          <View style={styles.promoBadge}>
            <Text style={styles.promoBadgeText}>Promo</Text>
          </View>
        ) : null}
        {showFavorite && onToggleFavorite ? (
          <View style={styles.heart}>
            <FavoriteHeart
              favorited={restaurant.is_favorited === true}
              onPress={onToggleFavorite}
            />
          </View>
        ) : null}
      </View>
      <Text style={styles.name} numberOfLines={2}>{restaurant.name}</Text>
      {categoryLabel ? (
        <Text style={styles.meta} numberOfLines={1}>
          {categoryEmoji(restaurant.category)} {categoryLabel}
        </Text>
      ) : null}
      <View style={styles.signals}>
        {rating ? (
          <View style={styles.signal}>
            <Ionicons name="star" size={12} color={colors.warning} />
            <Text style={styles.signalStrong}>{rating}</Text>
          </View>
        ) : null}
        <View style={styles.signal}>
          <Ionicons name="bicycle-outline" size={12} color={colors.accentDark} />
          <Text style={styles.signalText}>{fee}</Text>
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    width: 168,
    backgroundColor: colors.surface,
    borderRadius: radii.card,
    padding: spacing.sm,
    gap: 6,
    borderWidth: 1,
    borderColor: colors.borderLight,
    ...cardShadow,
  },
  pressed: { opacity: 0.92 },
  imageWrap: {
    position: 'relative',
    borderRadius: radii.lg,
    overflow: 'hidden',
  },
  image: {
    width: '100%',
    height: 104,
    borderRadius: radii.lg,
  },
  openBadge: {
    position: 'absolute',
    left: 6,
    bottom: 6,
    backgroundColor: colors.success,
    borderRadius: 8,
    paddingHorizontal: 7,
    paddingVertical: 3,
  },
  closedBadge: { backgroundColor: 'rgba(15,23,42,0.72)' },
  openBadgeText: { fontSize: 11, fontWeight: '800', color: '#FFF' },
  promoBadge: {
    position: 'absolute',
    left: 6,
    top: 6,
    backgroundColor: colors.accent,
    borderRadius: 8,
    paddingHorizontal: 7,
    paddingVertical: 3,
  },
  promoBadgeText: { fontSize: 11, fontWeight: '800', color: '#FFF' },
  heart: {
    position: 'absolute',
    right: 0,
    top: 0,
  },
  name: {
    fontSize: 14,
    fontWeight: '800',
    color: colors.text,
    lineHeight: 18,
    minHeight: 36,
  },
  meta: { fontSize: 12, fontWeight: '600', color: colors.textSecondary },
  signals: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  signal: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  signalStrong: { fontSize: 12, fontWeight: '700', color: colors.text },
  signalText: { fontSize: 12, fontWeight: '600', color: colors.textSecondary },
});
