import Ionicons from '@expo/vector-icons/Ionicons';
import React, { useCallback, useEffect, useState } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { appAlert, appConfirm } from '../../utils/appAlert';
import { useResponsiveLayout } from '../../hooks/useResponsiveLayout';
import { useTabScreenInsets } from '../../hooks/useTabScreenInsets';

import Button from '../Button';
import EmptyState from '../EmptyState';
import FormField from '../FormField';
import { promotionApi } from '../../services/api';
import { colors } from '../../theme/colors';
import { HIT_SLOP, spacing } from '../../theme/spacing';
import { cardShadow } from '../../theme/shadows';
import type { Product, ProductPromotion, PromoType } from '../../types';
import { getApiErrorMessage } from '../../utils/apiErrors';
import { keyboardAvoidingBehavior } from '../../utils/webPlatform';
import {
  buildValidUntilIso,
  defaultPromoEndDate,
  formatPromoUntil,
  promoDisplayLabel,
  promoUntilParts,
  PROMO_TYPE_OPTIONS,
} from '../../utils/promo';
import PromoExpiryPicker from './PromoExpiryPicker';
import { KeyboardAvoidingView } from 'react-native';

interface Props {
  products: Product[];
  onChanged?: () => void;
}

interface PromoDraft {
  productId: number | null;
  promoType: PromoType;
  percentOff: string;
  specialPrice: string;
  label: string;
  endDate: string;
  endTime: string;
}

const EMPTY_DRAFT: PromoDraft = {
  productId: null,
  promoType: 'two_for_one',
  percentOff: '20',
  specialPrice: '',
  label: '',
  endDate: defaultPromoEndDate(),
  endTime: '23:59',
};

function PromoRow({
  promo,
  onDeactivate,
  busy,
}: {
  promo: ProductPromotion;
  onDeactivate: (promo: ProductPromotion) => void;
  busy: boolean;
}) {
  const active = promo.is_currently_active !== false;
  const until = promoUntilParts(promo.valid_until);
  return (
    <View style={[styles.promoRow, !active && styles.promoRowInactive]}>
      <View style={[styles.dateBadge, !active && styles.dateBadgeInactive]}>
        <Text style={[styles.dateBadgeDay, !active && styles.dateBadgeMuted]}>{until?.day ?? '—'}</Text>
        <Text style={[styles.dateBadgeMonth, !active && styles.dateBadgeMuted]}>{until?.month ?? ''}</Text>
      </View>
      <View style={styles.promoInfo}>
        <View style={styles.promoTitleRow}>
          <Text style={styles.promoProduct} numberOfLines={1}>
            {promo.product_name ?? `Platillo #${promo.product}`}
          </Text>
          <View style={[styles.promoTypeBadge, !active && styles.promoTypeBadgeInactive]}>
            <Text style={[styles.promoTypeBadgeText, !active && styles.promoTypeBadgeTextInactive]}>
              {promoDisplayLabel(promo)}
            </Text>
          </View>
        </View>
        <Text style={styles.promoUntil}>
          {active ? `Vigente hasta ${formatPromoUntil(promo.valid_until)}` : 'Promoción vencida'}
        </Text>
      </View>
      {active && promo.is_active ? (
        <Pressable
          style={styles.deactivateBtn}
          onPress={() => onDeactivate(promo)}
          disabled={busy}
          hitSlop={HIT_SLOP}
        >
          <Ionicons name="pause-circle-outline" size={22} color={colors.error} />
        </Pressable>
      ) : (
        <View style={styles.expiredBadge}>
          <Text style={styles.expiredText}>Inactiva</Text>
        </View>
      )}
    </View>
  );
}

export default function RestaurantPromotionsSection({ products, onChanged }: Props) {
  const { isDesktopWeb } = useResponsiveLayout();
  const { insets } = useTabScreenInsets();
  const [promotions, setPromotions] = useState<ProductPromotion[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [draft, setDraft] = useState<PromoDraft>(EMPTY_DRAFT);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await promotionApi.mine();
      setPromotions(data);
    } catch {
      setPromotions([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const openEditor = () => {
    setDraft({
      ...EMPTY_DRAFT,
      endDate: defaultPromoEndDate(),
      productId: products[0]?.id ?? null,
    });
    setEditorOpen(true);
  };

  const savePromo = async () => {
    if (!draft.productId) {
      appAlert('Promoción', 'Elige un platillo.');
      return;
    }
    const validUntil = buildValidUntilIso(draft.endDate, draft.endTime);
    if (!validUntil) {
      appAlert('Fecha inválida', 'Elige una fecha y hora de fin en el calendario.');
      return;
    }
    if (draft.promoType === 'percent_off') {
      const pct = Number(draft.percentOff);
      if (!Number.isFinite(pct) || pct < 1 || pct > 99) {
        appAlert('Descuento', 'Indica un porcentaje entre 1 y 99.');
        return;
      }
    }
    if (draft.promoType === 'special_price') {
      const price = parseFloat(draft.specialPrice);
      if (!Number.isFinite(price) || price <= 0) {
        appAlert('Precio', 'Indica un precio promocional válido.');
        return;
      }
    }

    setSaving(true);
    try {
      await promotionApi.create({
        product: draft.productId,
        promo_type: draft.promoType,
        percent_off: draft.promoType === 'percent_off' ? Number(draft.percentOff) : undefined,
        special_price: draft.promoType === 'special_price' ? draft.specialPrice.trim() : undefined,
        label: draft.label.trim() || undefined,
        valid_until: validUntil,
      });
      setEditorOpen(false);
      await load();
      onChanged?.();
      appAlert('Listo', 'Promoción publicada en tu menú.');
    } catch (err) {
      appAlert('Error', getApiErrorMessage(err, 'No se pudo crear la promoción.'));
    } finally {
      setSaving(false);
    }
  };

  const deactivatePromo = (promo: ProductPromotion) => {
    appConfirm(
      'Pausar promoción',
      `¿Quitar "${promoDisplayLabel(promo)}" de ${promo.product_name ?? 'este platillo'}?`,
      async () => {
        setBusyId(promo.id);
        try {
          await promotionApi.patch(promo.id, { is_active: false });
          await load();
          onChanged?.();
        } catch (err) {
          appAlert('Error', getApiErrorMessage(err, 'No se pudo pausar la promoción.'));
        } finally {
          setBusyId(null);
        }
      },
      'Pausar',
    );
  };

  const activeCount = promotions.filter((p) => p.is_currently_active !== false && p.is_active).length;

  return (
    <>
      <View style={styles.section}>
        <View style={styles.sectionRow}>
          <View>
            <Text style={styles.sectionTitle}>Promociones</Text>
            <Text style={styles.sectionSub}>
              2x1, descuentos o precio especial · {activeCount} activa{activeCount === 1 ? '' : 's'}
            </Text>
          </View>
          <Pressable
            style={[styles.addBtn, products.length === 0 && styles.addBtnDisabled]}
            onPress={openEditor}
            disabled={products.length === 0}
            hitSlop={HIT_SLOP}
          >
            <Ionicons name="pricetag-outline" size={18} color="#FFF" />
            <Text style={styles.addText}>Nueva</Text>
          </Pressable>
        </View>

        {products.length === 0 ? (
          <Text style={styles.emptyHint}>Agrega platillos al menú antes de crear promos.</Text>
        ) : loading ? (
          <Text style={styles.emptyHint}>Cargando promociones…</Text>
        ) : promotions.length === 0 ? (
          <EmptyState
            emoji="🏷️"
            title="Sin promociones"
            subtitle="Crea un 2x1 o descuento y elige hasta cuándo estará activo."
            actionLabel="Crear promoción"
            onAction={openEditor}
          />
        ) : (
          promotions.map((promo) => (
            <PromoRow
              key={promo.id}
              promo={promo}
              onDeactivate={deactivatePromo}
              busy={busyId === promo.id}
            />
          ))
        )}
      </View>

      <Modal visible={editorOpen} animationType="slide" transparent onRequestClose={() => setEditorOpen(false)}>
        <KeyboardAvoidingView style={styles.flex} behavior={keyboardAvoidingBehavior()}>
          <View style={[styles.modalOverlay, isDesktopWeb && styles.modalOverlayDesktop]}>
            <Pressable style={styles.modalBackdrop} onPress={() => setEditorOpen(false)} />
            <View
              style={[
                styles.modal,
                isDesktopWeb && styles.modalDesktop,
                { paddingBottom: insets.bottom + 12 },
              ]}
            >
              <View style={styles.modalHeader}>
                <View>
                  <Text style={styles.modalEyebrow}>Nueva promoción</Text>
                  <Text style={styles.modalTitle}>Publicar en el menú</Text>
                </View>
                <Pressable onPress={() => setEditorOpen(false)} hitSlop={HIT_SLOP}>
                  <Ionicons name="close" size={26} color={colors.textSecondary} />
                </Pressable>
              </View>

              <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.modalScroll}>
                <Text style={styles.fieldLabel}>Platillo</Text>
                <View style={styles.productPicker}>
                  {products.map((product) => {
                    const selected = draft.productId === product.id;
                    return (
                      <Pressable
                        key={product.id}
                        style={[styles.productChip, selected && styles.productChipActive]}
                        onPress={() => setDraft((d) => ({ ...d, productId: product.id }))}
                      >
                        <Text
                          style={[styles.productChipText, selected && styles.productChipTextActive]}
                          numberOfLines={1}
                        >
                          {product.name}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>

                <Text style={styles.fieldLabel}>Tipo de promo</Text>
                <View style={styles.typeRow}>
                  {PROMO_TYPE_OPTIONS.map((option) => {
                    const selected = draft.promoType === option.key;
                    return (
                      <Pressable
                        key={option.key}
                        style={[styles.typeChip, selected && styles.typeChipActive]}
                        onPress={() => setDraft((d) => ({ ...d, promoType: option.key }))}
                      >
                        <Text style={[styles.typeChipText, selected && styles.typeChipTextActive]}>
                          {option.label}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
                <Text style={styles.typeHint}>
                  {PROMO_TYPE_OPTIONS.find((o) => o.key === draft.promoType)?.hint}
                </Text>

                {draft.promoType === 'percent_off' ? (
                  <FormField
                    label="Porcentaje de descuento"
                    value={draft.percentOff}
                    onChangeText={(v) => setDraft((d) => ({ ...d, percentOff: v }))}
                    icon="trending-down-outline"
                    embedded
                    keyboardType="number-pad"
                    placeholder="Ej. 20"
                  />
                ) : null}

                {draft.promoType === 'special_price' ? (
                  <FormField
                    label="Precio promocional"
                    value={draft.specialPrice}
                    onChangeText={(v) => setDraft((d) => ({ ...d, specialPrice: v }))}
                    icon="cash-outline"
                    embedded
                    keyboardType="decimal-pad"
                    placeholder="Ej. 69.00"
                  />
                ) : null}

                <FormField
                  label="Etiqueta (opcional)"
                  value={draft.label}
                  onChangeText={(v) => setDraft((d) => ({ ...d, label: v }))}
                  icon="text-outline"
                  embedded
                  placeholder="Ej. Promo fin de semana"
                />

                <Text style={styles.fieldLabel}>¿Hasta cuándo?</Text>
                <PromoExpiryPicker
                  endDate={draft.endDate}
                  endTime={draft.endTime}
                  onChange={(endDate, endTime) => setDraft((d) => ({ ...d, endDate, endTime }))}
                />
                <Text style={styles.typeHint}>
                  Toca un día en el calendario. La promo se oculta sola al vencer.
                </Text>
              </ScrollView>

              <View style={styles.modalFooter}>
                <Button
                  title="Cancelar"
                  variant="secondary"
                  onPress={() => setEditorOpen(false)}
                  style={styles.modalBtn}
                />
                <Button title="Publicar" onPress={savePromo} loading={saving} style={styles.modalBtn} />
              </View>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  section: {
    backgroundColor: colors.surface,
    borderRadius: 22,
    padding: spacing.lg,
    marginBottom: spacing.lg,
    borderWidth: 1,
    borderColor: colors.borderLight,
    ...cardShadow,
  },
  sectionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 12,
    marginBottom: spacing.md,
  },
  sectionTitle: { fontSize: 18, fontWeight: '800', color: colors.text },
  sectionSub: { fontSize: 12, color: colors.textSecondary, marginTop: 2, lineHeight: 17 },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.accent,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    minHeight: 44,
  },
  addBtnDisabled: { opacity: 0.45 },
  addText: { color: '#FFF', fontWeight: '700', fontSize: 13 },
  emptyHint: { fontSize: 13, color: colors.textSecondary, textAlign: 'center', paddingVertical: spacing.md },
  promoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: colors.borderLight,
  },
  promoRowInactive: { opacity: 0.65 },
  dateBadge: {
    width: 48,
    height: 52,
    borderRadius: 12,
    backgroundColor: colors.accentLight,
    borderWidth: 1,
    borderColor: '#FED7AA',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 4,
  },
  dateBadgeInactive: { backgroundColor: colors.background, borderColor: colors.border },
  dateBadgeDay: { fontSize: 18, fontWeight: '800', color: colors.accentDark, lineHeight: 20 },
  dateBadgeMonth: { fontSize: 10, fontWeight: '800', color: colors.accent, letterSpacing: 0.5 },
  dateBadgeMuted: { color: colors.textMuted },
  promoInfo: { flex: 1, minWidth: 0 },
  promoTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  promoProduct: { flex: 1, fontSize: 15, fontWeight: '800', color: colors.text, minWidth: 0 },
  promoTypeBadge: {
    backgroundColor: colors.accent,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  promoTypeBadgeInactive: { backgroundColor: colors.background },
  promoTypeBadgeText: { fontSize: 10, fontWeight: '800', color: '#FFF' },
  promoTypeBadgeTextInactive: { color: colors.textMuted },
  promoUntil: { fontSize: 12, color: colors.textSecondary, marginTop: 4, lineHeight: 16 },
  deactivateBtn: { padding: 4 },
  expiredBadge: {
    backgroundColor: colors.background,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  expiredText: { fontSize: 10, fontWeight: '700', color: colors.textMuted },
  modalOverlay: { flex: 1, justifyContent: 'flex-end' },
  modalOverlayDesktop: { justifyContent: 'center', paddingHorizontal: spacing.lg },
  modalBackdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.5)' },
  modal: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 16,
    paddingHorizontal: 20,
    maxHeight: '92%',
  },
  modalDesktop: { width: '100%', maxWidth: 520, alignSelf: 'center', borderRadius: 24 },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  modalEyebrow: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  modalTitle: { fontSize: 20, fontWeight: '800', color: colors.text, marginTop: 2 },
  modalScroll: { paddingBottom: 8 },
  fieldLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    marginBottom: 8,
    marginTop: 4,
  },
  productPicker: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: spacing.md },
  productChip: {
    maxWidth: '48%',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
  },
  productChipActive: { backgroundColor: colors.primaryLight, borderColor: colors.primary },
  productChipText: { fontSize: 12, fontWeight: '700', color: colors.textSecondary },
  productChipTextActive: { color: colors.primary },
  typeRow: { flexDirection: 'row', gap: 8, marginBottom: 6 },
  typeChip: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
  },
  typeChipActive: { backgroundColor: colors.accentLight, borderColor: colors.accent },
  typeChipText: { fontSize: 13, fontWeight: '800', color: colors.textSecondary },
  typeChipTextActive: { color: colors.accentDark },
  typeHint: { fontSize: 12, color: colors.textSecondary, marginBottom: spacing.sm, lineHeight: 17, marginTop: 6 },
  modalFooter: {
    flexDirection: 'row',
    gap: 10,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.borderLight,
  },
  modalBtn: { flex: 1, flexGrow: 1, flexShrink: 1, minWidth: 0 },
});
