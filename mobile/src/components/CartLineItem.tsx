import Ionicons from '@expo/vector-icons/Ionicons';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors } from '../theme/colors';
import { HIT_SLOP, spacing } from '../theme/spacing';
import { cardShadow } from '../theme/shadows';
import type { CartItem } from '../types';
import { formatCurrency } from '../utils/format';
import { getProductEmoji } from '../utils/foodVisuals';
import { resolveMediaUrl } from '../utils/media';
import FoodImage from './FoodImage';

interface Props {
  item: CartItem;
  onDecrease: (productId: number, quantity: number) => void;
  onIncrease: (productId: number, quantity: number) => void;
}

function CartLineItem({ item, onDecrease, onIncrease }: Props) {
  const { product, quantity } = item;
  const lineTotal = Number(product.price) * quantity;

  return (
    <View style={styles.item}>
      <FoodImage
        emoji={getProductEmoji(product.name)}
        color={colors.primary}
        size="sm"
        imageUri={resolveMediaUrl(product.image_url ?? product.image)}
      />
      <View style={styles.itemInfo}>
        <Text style={styles.name} numberOfLines={2}>
          {product.name}
        </Text>
        <Text style={styles.unitPrice}>{formatCurrency(product.price)} c/u</Text>
        <Text style={styles.lineTotal}>{formatCurrency(lineTotal)}</Text>
      </View>
      <View style={styles.qtyRow}>
        <Pressable
          style={styles.qtyBtn}
          onPress={() => onDecrease(product.id, quantity)}
          hitSlop={HIT_SLOP}
        >
          <Ionicons name="remove" size={18} color={colors.primary} />
        </Pressable>
        <Text style={styles.qty}>{quantity}</Text>
        <Pressable
          style={[styles.qtyBtn, styles.qtyBtnAdd]}
          onPress={() => onIncrease(product.id, quantity)}
          hitSlop={HIT_SLOP}
        >
          <Ionicons name="add" size={18} color="#FFF" />
        </Pressable>
      </View>
    </View>
  );
}

export default React.memo(CartLineItem);

const styles = StyleSheet.create({
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    padding: spacing.md,
    borderRadius: 18,
    marginBottom: spacing.sm,
    gap: spacing.md,
    borderWidth: 1,
    borderColor: colors.borderLight,
    ...cardShadow,
  },
  itemInfo: { flex: 1 },
  name: { fontSize: 15, fontWeight: '800', color: colors.text, letterSpacing: -0.2 },
  unitPrice: { color: colors.textMuted, marginTop: 2, fontSize: 12, fontWeight: '500' },
  lineTotal: { color: colors.primary, marginTop: 4, fontWeight: '800', fontSize: 15 },
  qtyRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  qtyBtn: {
    width: 34,
    height: 34,
    borderRadius: 12,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  qtyBtnAdd: { backgroundColor: colors.primary },
  qty: { fontSize: 16, fontWeight: '800', minWidth: 22, textAlign: 'center' },
});
