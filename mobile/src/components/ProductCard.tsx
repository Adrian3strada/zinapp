import Ionicons from '@expo/vector-icons/Ionicons';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors } from '../theme/colors';
import { HIT_SLOP } from '../theme/spacing';
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
        <Text style={styles.desc} numberOfLines={2}>
          {product.description}
        </Text>
        <Text style={styles.price}>{formatCurrency(product.price)}</Text>
      </View>
      <Pressable
        style={({ pressed }) => [styles.addBtn, pressed && styles.addBtnPressed]}
        onPress={onAdd}
        hitSlop={HIT_SLOP}
      >
        <Ionicons name="add" size={24} color="#FFF" />
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
    borderRadius: 16,
    padding: 12,
    marginBottom: 12,
    gap: 12,
    borderWidth: 1,
    borderColor: colors.border,
    ...cardShadow,
  },
  info: { flex: 1 },
  name: { fontSize: 16, fontWeight: '700', color: colors.text },
  desc: { fontSize: 12, color: colors.textSecondary, marginTop: 3, lineHeight: 17 },
  price: { fontSize: 16, fontWeight: '800', color: colors.primary, marginTop: 8 },
  addBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    ...cardShadow,
  },
  addBtnPressed: { opacity: 0.85 },
});
