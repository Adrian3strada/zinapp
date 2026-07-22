import Ionicons from '@expo/vector-icons/Ionicons';
import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { normalizeCartNotes } from '../context/CartContext';
import { colors } from '../theme/colors';
import { HIT_SLOP, spacing } from '../theme/spacing';
import { cardShadow } from '../theme/shadows';
import type { CartItem } from '../types';
import { formatCurrency } from '../utils/format';
import { getProductEmoji } from '../utils/foodVisuals';
import { resolveMediaUrl } from '../utils/media';
import { calculatePromoLineTotal } from '../utils/promo';
import { webTextInputStyle } from '../utils/webPlatform';
import FoodImage from './FoodImage';

interface Props {
  item: CartItem;
  onDecrease: (productId: number, quantity: number, notes?: string) => void;
  onIncrease: (productId: number, quantity: number, notes?: string) => void;
  onNotesChange?: (productId: number, notes: string, nextNotes: string) => void;
}

function CartLineItem({ item, onDecrease, onIncrease, onNotesChange }: Props) {
  const { product, quantity, notes } = item;
  const [draftNotes, setDraftNotes] = useState(notes ?? '');
  const { total: lineTotal } = calculatePromoLineTotal(product, quantity);
  const lineNotes = normalizeCartNotes(notes);

  useEffect(() => {
    setDraftNotes(notes ?? '');
  }, [notes]);

  const commitNotes = () => {
    if (!onNotesChange) return;
    const next = normalizeCartNotes(draftNotes);
    if (next === lineNotes) return;
    onNotesChange(product.id, lineNotes, next);
  };

  return (
    <View style={styles.item}>
      <View style={styles.topRow}>
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
            onPress={() => onDecrease(product.id, quantity, lineNotes)}
            hitSlop={HIT_SLOP}
          >
            <Ionicons name="remove" size={18} color={colors.primary} />
          </Pressable>
          <Text style={styles.qty}>{quantity}</Text>
          <Pressable
            style={[styles.qtyBtn, styles.qtyBtnAdd]}
            onPress={() => onIncrease(product.id, quantity, lineNotes)}
            hitSlop={HIT_SLOP}
          >
            <Ionicons name="add" size={18} color="#FFF" />
          </Pressable>
        </View>
      </View>

      <View style={styles.notesRow}>
        <Ionicons name="restaurant-outline" size={16} color={colors.textMuted} />
        <TextInput
          style={[styles.notesInput, webTextInputStyle()]}
          value={draftNotes}
          onChangeText={setDraftNotes}
          onBlur={commitNotes}
          onSubmitEditing={commitNotes}
          placeholder="Sabor o extras (opcional)"
          placeholderTextColor={colors.textMuted}
          maxLength={255}
          returnKeyType="done"
        />
      </View>
    </View>
  );
}

export default React.memo(CartLineItem);

const styles = StyleSheet.create({
  item: {
    backgroundColor: colors.surface,
    padding: spacing.md,
    borderRadius: 18,
    marginBottom: spacing.sm,
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: colors.borderLight,
    ...cardShadow,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
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
  notesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.background,
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  notesInput: {
    flex: 1,
    fontSize: 13,
    color: colors.text,
    paddingVertical: 0,
    minHeight: 22,
  },
});
