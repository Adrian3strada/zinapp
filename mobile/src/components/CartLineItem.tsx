import Ionicons from '@expo/vector-icons/Ionicons';
import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { normalizeCartNotes } from '../context/CartContext';
import { colors } from '../theme/colors';
import { HIT_SLOP, spacing } from '../theme/spacing';
import { cardShadow } from '../theme/shadows';
import type { CartItem, SelectedProductOption } from '../types';
import { formatCurrency } from '../utils/format';
import { getProductEmoji } from '../utils/foodVisuals';
import { resolveMediaUrl } from '../utils/media';
import { calculateCartLineTotal } from '../utils/promo';
import { webTextInputStyle } from '../utils/webPlatform';
import FoodImage from './FoodImage';

interface Props {
  item: CartItem;
  onDecrease: (
    productId: number,
    quantity: number,
    notes?: string,
    selectedOptions?: SelectedProductOption[],
  ) => void;
  onIncrease: (
    productId: number,
    quantity: number,
    notes?: string,
    selectedOptions?: SelectedProductOption[],
  ) => void;
  onNotesChange?: (
    productId: number,
    notes: string,
    nextNotes: string,
    selectedOptions?: SelectedProductOption[],
  ) => void;
}

function CartLineItem({ item, onDecrease, onIncrease, onNotesChange }: Props) {
  const { product, quantity, notes, selectedOptions } = item;
  const [draftNotes, setDraftNotes] = useState(notes ?? '');
  const lineTotal = calculateCartLineTotal(item);
  const lineNotes = normalizeCartNotes(notes);
  const optionsLabel = (selectedOptions ?? [])
    .map((o) => (parseFloat(o.price_delta) > 0 ? `${o.name} (+$${o.price_delta})` : o.name))
    .join(' · ');

  useEffect(() => {
    setDraftNotes(notes ?? '');
  }, [notes]);

  const commitNotes = () => {
    if (!onNotesChange) return;
    const next = normalizeCartNotes(draftNotes);
    if (next === lineNotes) return;
    onNotesChange(product.id, lineNotes, next, selectedOptions);
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
          {optionsLabel ? (
            <Text style={styles.options} numberOfLines={2}>
              {optionsLabel}
            </Text>
          ) : null}
          <Text style={styles.unitPrice}>{formatCurrency(product.price)} c/u base</Text>
          <Text style={styles.lineTotal}>{formatCurrency(lineTotal)}</Text>
        </View>
        <View style={styles.qtyRow}>
          <Pressable
            style={styles.qtyBtn}
            onPress={() => onDecrease(product.id, quantity, lineNotes, selectedOptions)}
            hitSlop={HIT_SLOP}
          >
            <Ionicons name="remove" size={18} color={colors.primary} />
          </Pressable>
          <Text style={styles.qty}>{quantity}</Text>
          <Pressable
            style={[styles.qtyBtn, styles.qtyBtnAdd]}
            onPress={() => onIncrease(product.id, quantity, lineNotes, selectedOptions)}
            hitSlop={HIT_SLOP}
          >
            <Ionicons name="add" size={18} color="#FFF" />
          </Pressable>
        </View>
      </View>

      <View style={styles.notesRow}>
        <Ionicons name="create-outline" size={16} color={colors.textMuted} />
        <TextInput
          style={[styles.notesInput, webTextInputStyle()]}
          value={draftNotes}
          onChangeText={setDraftNotes}
          onBlur={commitNotes}
          onSubmitEditing={commitNotes}
          placeholder="Notas para cocina (opcional)"
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
  options: { color: colors.textSecondary, marginTop: 2, fontSize: 12, lineHeight: 16 },
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
