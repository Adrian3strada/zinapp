import Ionicons from '@expo/vector-icons/Ionicons';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors } from '../theme/colors';
import { HIT_SLOP, spacing } from '../theme/spacing';
import { cardShadow } from '../theme/shadows';
import type { Product } from '../types';
import { formatCurrency } from '../utils/format';
import { getProductEmoji } from '../utils/foodVisuals';
import { promoDisplayLabel, promoPriceHint } from '../utils/promo';
import { resolveMediaUrl } from '../utils/media';
import FoodImage from './FoodImage';

interface Props {
  product: Product;
  quantity?: number;
  onAdd: () => void;
  onDecrease?: () => void;
  onPress?: () => void;
}

function ProductCard({ product, quantity = 0, onAdd, onDecrease, onPress }: Props) {
  const emoji = getProductEmoji(product.name);
  const inCart = quantity > 0;
  const promoHint = promoPriceHint(product);
  const promoLabel = product.active_promotion ? promoDisplayLabel(product.active_promotion) : null;

  const content = (
    <>
      <FoodImage
        emoji={emoji}
        color={colors.primary}
        size="md"
        imageUri={resolveMediaUrl(product.image_url ?? product.image)}
      />
      <View style={styles.info}>
        <View style={styles.nameRow}>
          <Text style={styles.name}>{product.name}</Text>
          {promoLabel ? (
            <View style={styles.promoBadge}>
              <Text style={styles.promoBadgeText}>{promoLabel}</Text>
            </View>
          ) : null}
        </View>
        {product.description ? (
          <Text style={styles.desc} numberOfLines={2}>
            {product.description}
          </Text>
        ) : null}
        <Text style={styles.price}>{promoHint ?? formatCurrency(product.price)}</Text>
      </View>
    </>
  );

  return (
    <View style={[styles.card, promoLabel && styles.cardPromo]}>
      {onPress ? (
        <Pressable
          style={styles.mainPress}
          onPress={onPress}
          accessibilityRole="button"
          accessibilityLabel={`Ver detalle de ${product.name}`}
        >
          {content}
        </Pressable>
      ) : (
        content
      )}
      {inCart ? (
        <View style={styles.qtyRow}>
          <Pressable
            style={styles.qtyBtn}
            onPress={onDecrease}
            hitSlop={HIT_SLOP}
            accessibilityRole="button"
            accessibilityLabel={`Quitar ${product.name}`}
          >
            <Ionicons name="remove" size={20} color={colors.primary} />
          </Pressable>
          <Text style={styles.qty} accessibilityLabel={`Cantidad ${quantity}`}>
            {quantity}
          </Text>
          <Pressable
            style={[styles.qtyBtn, styles.qtyBtnAdd]}
            onPress={onAdd}
            hitSlop={HIT_SLOP}
            accessibilityRole="button"
            accessibilityLabel={`Agregar ${product.name}`}
          >
            <Ionicons name="add" size={20} color="#FFF" />
          </Pressable>
        </View>
      ) : (
        <Pressable
          style={({ pressed }) => [styles.addBtn, pressed && styles.addBtnPressed]}
          onPress={onAdd}
          hitSlop={HIT_SLOP}
          accessibilityRole="button"
          accessibilityLabel={`Agregar ${product.name}`}
        >
          <Ionicons name="add" size={22} color="#FFF" />
        </Pressable>
      )}
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
  cardPromo: {
    borderColor: colors.accent + '55',
  },
  mainPress: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  info: { flex: 1, minWidth: 0 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  name: { fontSize: 15, fontWeight: '700', color: colors.text, letterSpacing: -0.2, flexShrink: 1 },
  promoBadge: {
    backgroundColor: colors.accentLight,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  promoBadgeText: { fontSize: 12, fontWeight: '800', color: colors.accentDark },
  desc: { fontSize: 13, color: colors.textSecondary, marginTop: 4, lineHeight: 18 },
  price: { fontSize: 16, fontWeight: '700', color: colors.primary, marginTop: 6 },
  addBtn: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    ...cardShadow,
  },
  addBtnPressed: { opacity: 0.88 },
  qtyRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  qtyBtn: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  qtyBtnAdd: { backgroundColor: colors.primary },
  qty: { fontSize: 16, fontWeight: '800', minWidth: 22, textAlign: 'center', color: colors.text },
});
