import Ionicons from '@expo/vector-icons/Ionicons';
import React, { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors } from '../theme/colors';
import { spacing } from '../theme/spacing';
import type { Restaurant } from '../types';
import { getRestaurantVisual } from '../utils/foodVisuals';
import { resolveMediaUrl } from '../utils/media';
import {
  estimateDeliveryEta,
  formatDeliveryFeeLabel,
  formatRatingLabel,
} from '../utils/restaurantMeta';
import FoodImage from './FoodImage';

interface Props {
  restaurant: Restaurant;
  onPress: () => void;
}

function RestaurantCard({ restaurant, onPress }: Props) {
  const visual = getRestaurantVisual(restaurant.name);
  const imageUri = resolveMediaUrl(restaurant.image_url ?? restaurant.image);
  const isOpen = restaurant.is_open !== false;
  const rating = formatRatingLabel(restaurant);
  const eta = useMemo(() => estimateDeliveryEta(restaurant), [restaurant]);
  const feeShort = formatDeliveryFeeLabel().replace(/^Envío\s+/i, '');

  return (
    <Pressable
      style={({ pressed }) => [
        styles.card,
        !isOpen && styles.closed,
        pressed && styles.pressed,
      ]}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${restaurant.name}, ${isOpen ? 'abierto' : 'cerrado'}, ${eta.label}, envío ${feeShort}${rating ? `, ${rating} estrellas` : ''}`}
    >
      <View style={styles.thumbWrap}>
        <FoodImage
          emoji={visual.emoji}
          color={visual.color}
          size="md"
          imageUri={imageUri}
          style={styles.thumb}
        />
        {!isOpen ? (
          <View style={styles.thumbOverlay}>
            <Text style={styles.thumbOverlayText}>Cerrado</Text>
          </View>
        ) : null}
      </View>

      <View style={styles.body}>
        <View style={styles.titleRow}>
          <Text style={styles.name} numberOfLines={1}>
            {restaurant.name}
          </Text>
          <View style={[styles.statusPill, isOpen ? styles.statusOpen : styles.statusClosed]}>
            {isOpen ? <View style={styles.openDot} /> : null}
            <Text style={[styles.statusText, isOpen ? styles.statusTextOpen : styles.statusTextClosed]}>
              {isOpen ? 'Abierto' : 'Cerrado'}
            </Text>
          </View>
        </View>

        {restaurant.description ? (
          <Text style={styles.desc} numberOfLines={1}>
            {restaurant.description}
          </Text>
        ) : null}

        <View style={styles.signalRow}>
          {rating ? (
            <View style={styles.signal}>
              <Ionicons name="star" size={13} color={colors.warning} />
              <Text style={styles.signalStrong}>{rating}</Text>
            </View>
          ) : (
            <View style={styles.signal}>
              <Ionicons name="star-outline" size={13} color={colors.textMuted} />
              <Text style={styles.signalMuted}>Nuevo</Text>
            </View>
          )}
          <Text style={styles.dot}>·</Text>
          <View style={styles.signal}>
            <Ionicons name="time-outline" size={13} color={colors.primary} />
            <Text style={styles.signalText}>{eta.label}</Text>
          </View>
          <Text style={styles.dot}>·</Text>
          <View style={styles.signal}>
            <Ionicons name="bicycle-outline" size={13} color={colors.accentDark} />
            <Text style={styles.signalText}>{feeShort}</Text>
          </View>
        </View>

        <Text style={styles.address} numberOfLines={1}>
          {restaurant.address}
        </Text>
      </View>

      <Ionicons name="chevron-forward" size={18} color={colors.textMuted} style={styles.chevron} />
    </Pressable>
  );
}

export default React.memo(RestaurantCard);

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: 16,
    marginBottom: spacing.md,
    padding: 10,
    gap: 12,
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  pressed: { opacity: 0.92 },
  closed: { opacity: 0.78 },
  thumbWrap: {
    width: 88,
    height: 88,
    borderRadius: 14,
    overflow: 'hidden',
    backgroundColor: colors.primaryLight,
  },
  thumb: {
    width: 88,
    height: 88,
    borderRadius: 14,
  },
  thumbOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(15,23,42,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  thumbOverlayText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#FFF',
    letterSpacing: 0.3,
  },
  body: { flex: 1, minWidth: 0, gap: 4 },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  name: {
    flex: 1,
    fontSize: 16,
    fontWeight: '800',
    color: colors.text,
    letterSpacing: -0.2,
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
  statusOpen: { backgroundColor: '#ECFDF5' },
  statusClosed: { backgroundColor: '#FEF2F2' },
  openDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.success },
  statusText: { fontSize: 10, fontWeight: '800' },
  statusTextOpen: { color: colors.success },
  statusTextClosed: { color: colors.error },
  desc: { fontSize: 12, color: colors.textSecondary, lineHeight: 16 },
  signalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 4,
    marginTop: 2,
  },
  signal: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  signalStrong: { fontSize: 12, fontWeight: '800', color: colors.text },
  signalText: { fontSize: 12, fontWeight: '700', color: colors.textSecondary },
  signalMuted: { fontSize: 12, fontWeight: '700', color: colors.textMuted },
  dot: { fontSize: 12, color: colors.textMuted, fontWeight: '700' },
  address: { fontSize: 11, color: colors.textMuted, fontWeight: '500', marginTop: 2 },
  chevron: { marginLeft: 2 },
});
