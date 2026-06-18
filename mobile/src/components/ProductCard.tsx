import Ionicons from '@expo/vector-icons/Ionicons';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors } from '../theme/colors';
import { HIT_SLOP, spacing } from '../theme/spacing';
import { cardShadow } from '../theme/shadows';
import type { Product } from '../types';
import { formatCurrency } from '../utils/format';
import { getProductEmoji } from '../utils/foodVisuals';
import { resolveMediaUrl } from '../utils/media';
import FoodImage from './FoodImage';

interface Props {
  product: Product;
  onAdd: () => void;
}

function ProductCard({ product, onAdd }: Props) {
  const emoji = getProductEmoji(product.name);

  return (
    <View style={styles.card}>
      <FoodImage
        emoji={emoji}
        color={colors.primary}
        size="md"
        imageUri={resolveMediaUrl(product.image_url ?? product.image)}
      />
      <View style={styles.info}>
        <Text style={styles.name}>{product.name}</Text>
        {product.description ? (
          <Text style={styles.desc} numberOfLines={2}>
            {product.description}
          </Text>
        ) : null}
        <Text style={styles.price}>{formatCurrency(product.price)}</Text>
      </View>
      <Pressable
        style={({ pressed }) => [styles.addBtn, pressed && styles.addBtnPressed]}
        onPress={onAdd}
        hitSlop={HIT_SLOP}
        accessibilityLabel={`Agregar ${product.name}`}
      >
        <Ionicons name="add" size={22} color="#FFF" />
      </Pressable>
    </View>
  );
}

export default React.memo(ProductCard);

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: 18,
    padding: spacing.md,
    marginBottom: spacing.md,
    gap: spacing.md,
    borderWidth: 1,
    borderColor: colors.borderLight,
    ...cardShadow,
  },
  info: { flex: 1 },
  name: { fontSize: 16, fontWeight: '800', color: colors.text, letterSpacing: -0.2 },
  desc: { fontSize: 12, color: colors.textSecondary, marginTop: 4, lineHeight: 17 },
  price: { fontSize: 17, fontWeight: '800', color: colors.primary, marginTop: 8 },
  addBtn: {
    width: 46,
    height: 46,
    borderRadius: 15,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    ...cardShadow,
  },
  addBtnPressed: { opacity: 0.88, transform: [{ scale: 0.96 }] },
});
