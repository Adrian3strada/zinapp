import Ionicons from '@expo/vector-icons/Ionicons';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors } from '../theme/colors';
import { HIT_SLOP } from '../theme/spacing';
import { cardShadow } from '../theme/shadows';
import type { CartItem } from '../types';
import { formatCurrency } from '../utils/format';
import { getProductEmoji } from '../utils/foodVisuals';
import FoodImage from './FoodImage';

interface Props {
  item: CartItem;
  onDecrease: (productId: number, quantity: number) => void;
  onIncrease: (productId: number, quantity: number) => void;
}

function CartLineItem({ item, onDecrease, onIncrease }: Props) {
  const { product, quantity } = item;

  return (
    <View style={styles.item}>
      <FoodImage
        emoji={getProductEmoji(product.name)}
        color={colors.primary}
        size="sm"
      />
      <View style={styles.itemInfo}>
        <Text style={styles.name}>{product.name}</Text>
        <Text style={styles.price}>{formatCurrency(product.price)}</Text>
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
          style={styles.qtyBtn}
          onPress={() => onIncrease(product.id, quantity)}
          hitSlop={HIT_SLOP}
        >
          <Ionicons name="add" size={18} color={colors.primary} />
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
    padding: 12,
    borderRadius: 14,
    marginBottom: 10,
    gap: 12,
    ...cardShadow,
  },
  itemInfo: { flex: 1 },
  name: { fontSize: 15, fontWeight: '700', color: colors.text },
  price: { color: colors.primary, marginTop: 2, fontWeight: '600' },
  qtyRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  qtyBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  qty: { fontSize: 16, fontWeight: '700', minWidth: 24, textAlign: 'center' },
});
