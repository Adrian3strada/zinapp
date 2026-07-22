import Ionicons from '@expo/vector-icons/Ionicons';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import Button from '../../components/Button';
import FoodImage from '../../components/FoodImage';
import FormField from '../../components/FormField';
import ScreenContainer from '../../components/ScreenContainer';
import { normalizeCartNotes, useCart } from '../../context/CartContext';
import type { ProductDetailScreenProps } from '../../navigation/types';
import { colors } from '../../theme/colors';
import { HIT_SLOP, spacing } from '../../theme/spacing';
import { cardShadow } from '../../theme/shadows';
import { formatCurrency } from '../../utils/format';
import { getProductEmoji } from '../../utils/foodVisuals';
import { impactLight } from '../../utils/haptics';
import { resolveMediaUrl } from '../../utils/media';
import { promoDisplayLabel, promoPriceHint } from '../../utils/promo';

export default function ProductDetailScreen({ route, navigation }: ProductDetailScreenProps) {
  const { product, restaurantName } = route.params;
  const { addItem, updateQuantity, items } = useCart();
  const insets = useSafeAreaInsets();
  const [notes, setNotes] = useState('');

  const lineNotes = normalizeCartNotes(notes);

  const quantity = useMemo(
    () =>
      items.find(
        (item) =>
          item.product.id === product.id && normalizeCartNotes(item.notes) === lineNotes,
      )?.quantity ?? 0,
    [items, lineNotes, product.id],
  );

  const emoji = getProductEmoji(product.name);
  const imageUri = resolveMediaUrl(product.image_url ?? product.image);
  const promoHint = promoPriceHint(product);
  const promoLabel = product.active_promotion ? promoDisplayLabel(product.active_promotion) : null;
  const available = product.is_available !== false;

  useEffect(() => {
    navigation.setOptions({ title: product.name });
  }, [navigation, product.name]);

  const handleAdd = useCallback(() => {
    if (!available) return;
    try {
      addItem(product, 1, notes);
      void impactLight();
    } catch {
      // Evita cierre nativo si algo falla al agregar
    }
  }, [addItem, available, notes, product]);

  const handleDecrease = useCallback(() => {
    if (quantity <= 1) {
      updateQuantity(product.id, 0, lineNotes);
    } else {
      updateQuantity(product.id, quantity - 1, lineNotes);
    }
    void impactLight();
  }, [lineNotes, product.id, quantity, updateQuantity]);

  return (
    <ScreenContainer>
      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: spacing.xxl + insets.bottom }]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.heroWrap}>
          <FoodImage
            emoji={emoji}
            color={colors.primary}
            size="lg"
            imageUri={imageUri}
            style={styles.heroImage}
          />
        </View>

        <View style={styles.body}>
          {restaurantName ? (
            <Text style={styles.restaurant}>{restaurantName}</Text>
          ) : null}

          <View style={styles.titleRow}>
            <Text style={styles.name}>{product.name}</Text>
            {promoLabel ? (
              <View style={styles.promoBadge}>
                <Text style={styles.promoBadgeText}>{promoLabel}</Text>
              </View>
            ) : null}
          </View>

          <Text style={styles.price}>{promoHint ?? formatCurrency(product.price)}</Text>
          {promoHint ? (
            <Text style={styles.priceOriginal}>Precio regular {formatCurrency(product.price)}</Text>
          ) : null}

          {!available ? (
            <View style={styles.unavailableBanner}>
              <Ionicons name="alert-circle-outline" size={16} color={colors.error} />
              <Text style={styles.unavailableText}>No disponible por ahora</Text>
            </View>
          ) : null}

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Descripción</Text>
            <Text style={styles.description}>
              {product.description?.trim()
                ? product.description.trim()
                : 'Este platillo aún no tiene descripción.'}
            </Text>
          </View>

          {available ? (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Sabor o extras</Text>
              <Text style={styles.notesIntro}>
                Indica el sabor, sin cebolla, toppings u otras preferencias para la cocina.
              </Text>
              <FormField
                label="Instrucciones"
                hideLabel
                value={notes}
                onChangeText={setNotes}
                icon="restaurant-outline"
                placeholder="Ej. pastor, extra queso, sin cebolla"
                hint="Opcional · máx. 255 caracteres"
                autoCapitalize="sentences"
                multiline
              />
            </View>
          ) : null}
        </View>
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, spacing.md) }]}>
        {quantity > 0 ? (
          <View style={styles.qtyRow}>
            <Pressable
              style={styles.qtyBtn}
              onPress={handleDecrease}
              hitSlop={HIT_SLOP}
              accessibilityLabel={`Quitar ${product.name}`}
            >
              <Ionicons name="remove" size={22} color={colors.primary} />
            </Pressable>
            <Text style={styles.qty}>{quantity}</Text>
            <Pressable
              style={[styles.qtyBtn, styles.qtyBtnAdd, !available && styles.qtyDisabled]}
              onPress={handleAdd}
              disabled={!available}
              hitSlop={HIT_SLOP}
              accessibilityLabel={`Agregar ${product.name}`}
            >
              <Ionicons name="add" size={22} color="#FFF" />
            </Pressable>
            <Button
              title="Ver carrito"
              variant="secondary"
              onPress={() =>
                (navigation as { navigate: (a: string, b?: object) => void }).navigate('Main', {
                  screen: 'Carrito',
                })
              }
              style={styles.cartBtn}
            />
          </View>
        ) : (
          <Button
            title={available ? 'Agregar al carrito' : 'No disponible'}
            onPress={handleAdd}
            disabled={!available}
            size="lg"
          />
        )}
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  scroll: { flexGrow: 1 },
  heroWrap: {
    height: 240,
    backgroundColor: colors.primaryLight,
    overflow: 'hidden',
  },
  heroImage: {
    width: '100%',
    height: 240,
    borderRadius: 0,
  },
  body: {
    padding: spacing.screen,
    gap: spacing.sm,
  },
  restaurant: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  name: {
    fontSize: 24,
    fontWeight: '800',
    color: colors.text,
    letterSpacing: -0.3,
    flexShrink: 1,
  },
  promoBadge: {
    backgroundColor: colors.accentLight,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  promoBadgeText: { fontSize: 11, fontWeight: '800', color: colors.accentDark },
  price: {
    fontSize: 22,
    fontWeight: '800',
    color: colors.primary,
    marginTop: 4,
  },
  priceOriginal: {
    fontSize: 13,
    color: colors.textMuted,
    textDecorationLine: 'line-through',
  },
  unavailableBanner: {
    marginTop: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    alignSelf: 'flex-start',
    backgroundColor: colors.error + '14',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
  },
  unavailableText: { fontSize: 13, fontWeight: '700', color: colors.error },
  section: {
    marginTop: spacing.lg,
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.borderLight,
    ...cardShadow,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: colors.text,
    marginBottom: 8,
  },
  description: {
    fontSize: 15,
    lineHeight: 22,
    color: colors.textSecondary,
  },
  notesIntro: {
    fontSize: 13,
    lineHeight: 18,
    color: colors.textSecondary,
    marginBottom: 10,
  },
  footer: {
    paddingHorizontal: spacing.screen,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.borderLight,
    backgroundColor: colors.surface,
  },
  qtyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  qtyBtn: {
    width: 46,
    height: 46,
    borderRadius: 15,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  qtyBtnAdd: { backgroundColor: colors.primary },
  qtyDisabled: { opacity: 0.5 },
  qty: {
    fontSize: 18,
    fontWeight: '800',
    minWidth: 28,
    textAlign: 'center',
    color: colors.text,
  },
  cartBtn: { flex: 1 },
});
