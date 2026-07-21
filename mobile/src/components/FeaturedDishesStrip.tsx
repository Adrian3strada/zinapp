import Ionicons from '@expo/vector-icons/Ionicons';
import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import FoodImage from './FoodImage';
import { colors } from '../theme/colors';
import { spacing } from '../theme/spacing';
import { cardShadow } from '../theme/shadows';
import type { Product } from '../types';
import { formatCurrency } from '../utils/format';
import { getProductEmoji } from '../utils/foodVisuals';
import { resolveMediaUrl } from '../utils/media';
import { promoDisplayLabel, promoPriceHint } from '../utils/promo';

interface Props {
  products: Product[];
  onPressProduct: (product: Product) => void;
  onPressSeeAll: () => void;
}

function FeaturedDishCard({
  product,
  onPress,
}: {
  product: Product;
  onPress: () => void;
}) {
  const emoji = getProductEmoji(product.name);
  const promoHint = promoPriceHint(product);
  const promoLabel = product.active_promotion ? promoDisplayLabel(product.active_promotion) : null;

  return (
    <Pressable
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${product.name}${product.restaurant_name ? ` de ${product.restaurant_name}` : ''}`}
    >
      <View style={styles.imageWrap}>
        <FoodImage
          emoji={emoji}
          color={colors.primary}
          size="md"
          imageUri={resolveMediaUrl(product.image_url ?? product.image)}
          style={styles.image}
        />
        {promoLabel ? (
          <View style={styles.promoBadge}>
            <Text style={styles.promoBadgeText}>{promoLabel}</Text>
          </View>
        ) : null}
      </View>
      <Text style={styles.name} numberOfLines={2}>
        {product.name}
      </Text>
      {product.restaurant_name ? (
        <Text style={styles.restaurant} numberOfLines={1}>
          {product.restaurant_name}
        </Text>
      ) : null}
      <Text style={styles.price} numberOfLines={1}>
        {promoHint ?? formatCurrency(product.price)}
      </Text>
    </Pressable>
  );
}

export default function FeaturedDishesStrip({ products, onPressProduct, onPressSeeAll }: Props) {
  if (products.length === 0) return null;

  return (
    <View style={styles.wrap}>
      <View style={styles.header}>
        <Text style={styles.title}>Platillos cerca de ti</Text>
        <Pressable style={styles.seeAll} onPress={onPressSeeAll} hitSlop={8}>
          <Text style={styles.seeAllText}>Ver menús</Text>
          <Ionicons name="chevron-forward" size={16} color={colors.primary} />
        </Pressable>
      </View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scroll}
      >
        {products.map((product) => (
          <FeaturedDishCard
            key={product.id}
            product={product}
            onPress={() => onPressProduct(product)}
          />
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.sm },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  title: {
    fontSize: 17,
    fontWeight: '800',
    color: colors.text,
    letterSpacing: -0.2,
  },
  seeAll: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  seeAllText: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.primary,
  },
  scroll: {
    gap: spacing.sm,
    paddingVertical: 2,
  },
  card: {
    width: 148,
    backgroundColor: colors.surface,
    borderRadius: 18,
    padding: spacing.md,
    gap: 6,
    borderWidth: 1,
    borderColor: colors.borderLight,
    ...cardShadow,
  },
  pressed: { opacity: 0.92 },
  imageWrap: {
    position: 'relative',
    alignSelf: 'stretch',
  },
  image: {
    width: '100%',
    height: 96,
    borderRadius: 14,
  },
  promoBadge: {
    position: 'absolute',
    top: 6,
    left: 6,
    backgroundColor: colors.accent,
    borderRadius: 8,
    paddingHorizontal: 7,
    paddingVertical: 3,
  },
  promoBadgeText: { fontSize: 10, fontWeight: '800', color: '#FFF' },
  name: {
    fontSize: 14,
    fontWeight: '800',
    color: colors.text,
    lineHeight: 18,
    marginTop: 2,
  },
  restaurant: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  price: {
    fontSize: 14,
    fontWeight: '800',
    color: colors.primary,
    marginTop: 2,
  },
});
