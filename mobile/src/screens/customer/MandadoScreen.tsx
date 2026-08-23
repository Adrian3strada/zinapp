import Ionicons from '@expo/vector-icons/Ionicons';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useCallback, useRef, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import Button from '../../components/Button';
import KeyboardForm from '../../components/KeyboardForm';
import ScreenContainer from '../../components/ScreenContainer';
import ShipmentAddressBlock from '../../components/ShipmentAddressBlock';
import { getShipmentFee } from '../../config/delivery';
import { useAuth } from '../../context/AuthContext';
import { useLocation } from '../../hooks/useLocation';
import type { MandadoScreenProps } from '../../navigation/types';
import { restaurantApi, shipmentApi } from '../../services/api';
import { colors } from '../../theme/colors';
import { radii } from '../../theme/radii';
import { spacing } from '../../theme/spacing';
import type { MandadoCategory, MandadoItem, MandadoUnit } from '../../utils/mandadoCategories';
import {
  createMandadoItem,
  formatMandadoItem,
  MANDADO_CATEGORIES,
  MANDADO_STORE_SUGGESTIONS,
} from '../../utils/mandadoCategories';
import { appAlert } from '../../utils/appAlert';
import { getApiErrorMessage } from '../../utils/apiErrors';
import { createIdempotencyKey } from '../../utils/idempotency';
import { isInCoverage } from '../../utils/coverage';
import { formatCurrency } from '../../utils/format';
import { runWithRetry } from '../../utils/runWithRetry';
import { keyboardOffsetWithHeader } from '../../utils/screenInsets';

export default function MandadoScreen({ navigation }: MandadoScreenProps) {
  const insets = useSafeAreaInsets();
  const { user, requestLogin } = useAuth();
  const { getCurrentPosition, loading: locating } = useLocation();

  const [items, setItems] = useState<MandadoItem[]>([]);
  const [draftName, setDraftName] = useState('');
  const [draftQty, setDraftQty] = useState('1');
  const [draftUnit, setDraftUnit] = useState<MandadoUnit>('kg');
  const [draftCategory, setDraftCategory] = useState<MandadoCategory>('verdura');
  const [preferredStores, setPreferredStores] = useState('');
  const [deliveryAddress, setDeliveryAddress] = useState(user?.address ?? '');
  const [deliveryNotes, setDeliveryNotes] = useState('');
  const [deliveryCoords, setDeliveryCoords] = useState<{ latitude: number; longitude: number } | null>(null);
  const [coverageOk, setCoverageOk] = useState<boolean | null>(null);
  const [addressApproximate, setAddressApproximate] = useState(false);
  const [geocoding, setGeocoding] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'transfer'>('cash');
  const [submitting, setSubmitting] = useState(false);
  const idempotencyKey = useRef<string | null>(null);

  const deliveryFee = getShipmentFee('medium');
  const categoryMeta = MANDADO_CATEGORIES.find((c) => c.key === draftCategory);

  const addItem = useCallback(() => {
    const name = draftName.trim().slice(0, 80);
    if (!name) {
      appAlert('Producto', 'Escribe qué quieres en el mandado.');
      return;
    }
    const qty = parseFloat(draftQty.replace(',', '.'));
    if (!Number.isFinite(qty) || qty <= 0) {
      appAlert('Cantidad', 'Indica kilos o gramos válidos.');
      return;
    }
    setItems((prev) => [
      ...prev,
      createMandadoItem({
        name,
        quantity: String(Number(qty.toFixed(2))),
        unit: draftUnit,
        category: draftCategory,
      }),
    ]);
    setDraftName('');
    setDraftQty('1');
  }, [draftCategory, draftName, draftQty, draftUnit]);

  const removeItem = useCallback((id: string) => {
    setItems((prev) => prev.filter((it) => it.id !== id));
  }, []);

  const handleAddressChange = useCallback((text: string) => {
    setDeliveryAddress(text);
    setDeliveryCoords(null);
    setCoverageOk(null);
    setAddressApproximate(false);
  }, []);

  const handleGeocodeAddress = useCallback(async () => {
    if (!deliveryAddress.trim()) {
      appAlert('Dirección', 'Escribe tu dirección de entrega.');
      return;
    }
    setGeocoding(true);
    try {
      const { data } = await runWithRetry(() => restaurantApi.geocode(deliveryAddress));
      setDeliveryCoords({ latitude: data.latitude, longitude: data.longitude });
      setDeliveryAddress(data.display_name);
      setCoverageOk(data.in_coverage);
      setAddressApproximate(!!data.approximate);
    } catch (err) {
      appAlert('Dirección', getApiErrorMessage(err, 'No se encontró la dirección.'));
    } finally {
      setGeocoding(false);
    }
  }, [deliveryAddress]);

  const handleUseMyLocation = useCallback(async () => {
    const coords = await getCurrentPosition();
    if (!coords) {
      appAlert('Ubicación', 'Activa el permiso de ubicación.');
      return;
    }
    setDeliveryCoords(coords);
    setAddressApproximate(false);
    if (!deliveryAddress.trim()) {
      setDeliveryAddress('Mi ubicación actual (Zinapécuaro)');
    }
    const localOk = isInCoverage(coords.latitude, coords.longitude);
    setCoverageOk(localOk);
    if (!localOk) {
      appAlert('Fuera de zona', 'Tu ubicación no está en Zinapécuaro.');
    }
  }, [deliveryAddress, getCurrentPosition]);

  const handleSubmit = useCallback(async () => {
    if (!user) {
      appAlert('Inicia sesión', 'Necesitas una cuenta para pedir un mandado.', [
        { text: 'Ahora no', style: 'cancel' },
        { text: 'Entrar', onPress: requestLogin },
      ]);
      return;
    }
    if (items.length === 0) {
      appAlert('Lista vacía', 'Agrega al menos un producto.');
      return;
    }
    if (!deliveryAddress.trim()) {
      appAlert('Entrega', 'Indica dónde entregar el mandado.');
      return;
    }
    if (coverageOk === false && deliveryCoords) {
      appAlert('Cobertura', 'La dirección está fuera de Zinapécuaro.');
      return;
    }

    let coords = deliveryCoords;
    let covered = coverageOk;
    setSubmitting(true);
    if (!idempotencyKey.current) {
      idempotencyKey.current = createIdempotencyKey();
    }
    try {
      if (!coords || covered !== true) {
        const { data } = await runWithRetry(() => restaurantApi.geocode(deliveryAddress));
        coords = { latitude: data.latitude, longitude: data.longitude };
        setDeliveryCoords(coords);
        setDeliveryAddress(data.display_name);
        setCoverageOk(data.in_coverage);
        covered = data.in_coverage;
        if (!data.in_coverage) {
          appAlert('Cobertura', 'La dirección está fuera de Zinapécuaro.');
          return;
        }
      }

      const { data } = await shipmentApi.createMandado(
        {
          kind: 'mandado',
          mandado_items: items.map((it) => ({
            name: it.name.slice(0, 80),
            quantity: Number(parseFloat(it.quantity).toFixed(2)),
            unit: it.unit,
            category: it.category,
          })),
          preferred_stores: preferredStores.trim(),
          size: 'medium',
          delivery_address: deliveryAddress.trim(),
          delivery_latitude: coords.latitude,
          delivery_longitude: coords.longitude,
          delivery_notes: deliveryNotes.trim(),
          payment_method: paymentMethod,
        },
        { idempotencyKey: idempotencyKey.current },
      );

      navigation.replace('ShipmentDetail', { shipmentId: data.id });
    } catch (err) {
      appAlert('Mandado', getApiErrorMessage(err, 'No se pudo enviar tu mandado.'));
    } finally {
      setSubmitting(false);
    }
  }, [
    coverageOk,
    deliveryAddress,
    deliveryCoords,
    deliveryNotes,
    items,
    navigation,
    paymentMethod,
    preferredStores,
    requestLogin,
    user,
  ]);

  return (
    <ScreenContainer>
      <KeyboardForm
        contentContainerStyle={styles.scroll}
        bottomPadding={spacing.xl}
        keyboardVerticalOffset={keyboardOffsetWithHeader(insets)}
        footer={
          <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, spacing.md) }]}>
            <View style={styles.footerInfo}>
              <Text style={styles.footerLabel} numberOfLines={1}>
                Servicio + entrega
              </Text>
              <Text style={styles.footerPrice} numberOfLines={1}>
                {formatCurrency(deliveryFee)}
              </Text>
            </View>
            <Button
              title={
                items.length > 0
                  ? `Confirmar mandado · ${formatCurrency(deliveryFee)}`
                  : 'Agrega productos'
              }
              onPress={handleSubmit}
              loading={submitting}
              disabled={items.length === 0}
              size="lg"
              style={styles.footerBtn}
            />
          </View>
        }
      >
        <LinearGradient
          colors={[colors.gradientStart, colors.gradientMid]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.hero}
        >
          <View style={styles.heroIcon}>
            <Ionicons name="basket-outline" size={28} color={colors.primary} />
          </View>
          <View style={styles.heroCopy}>
            <Text style={styles.heroTitle} numberOfLines={1}>
              Haz tu mandado
            </Text>
            <Text style={styles.heroSub} numberOfLines={3}>
              Arma tu lista y te llevamos lo que necesites de la tienda o mercado.
            </Text>
          </View>
        </LinearGradient>

        <SectionCard title="Tu lista" icon="list-outline">
          {items.length === 0 ? (
            <Text style={styles.emptyHint}>Aún no hay productos. Agrega el primero abajo.</Text>
          ) : (
            <View style={styles.itemsList}>
              {items.map((item, index) => (
                <View
                  key={item.id}
                  style={[styles.itemRow, index < items.length - 1 && styles.itemRowBorder]}
                >
                  <Text style={styles.itemEmoji}>
                    {MANDADO_CATEGORIES.find((c) => c.key === item.category)?.emoji ?? '🛒'}
                  </Text>
                  <Text style={styles.itemText} numberOfLines={2}>
                    {formatMandadoItem(item)}
                  </Text>
                  <Pressable onPress={() => removeItem(item.id)} hitSlop={8}>
                    <Ionicons name="trash-outline" size={18} color={colors.textMuted} />
                  </Pressable>
                </View>
              ))}
            </View>
          )}

          <View style={styles.categoryGrid}>
            {MANDADO_CATEGORIES.map((cat) => {
              const active = draftCategory === cat.key;
              return (
                <Pressable
                  key={cat.key}
                  style={[styles.categoryPill, active && styles.categoryPillActive]}
                  onPress={() => setDraftCategory(cat.key)}
                >
                  <Text style={styles.categoryEmoji}>{cat.emoji}</Text>
                  <Text style={[styles.categoryLabel, active && styles.categoryLabelActive]}>
                    {cat.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          {categoryMeta?.examples.length ? (
            <ScrollView
              horizontal
              nestedScrollEnabled
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.examplesRow}
              keyboardShouldPersistTaps="handled"
            >
              {categoryMeta.examples.map((ex) => (
                <Pressable
                  key={ex}
                  style={styles.exampleChip}
                  onPress={() => {
                    setDraftName(ex);
                    setDraftCategory(categoryMeta.key);
                  }}
                >
                  <Text style={styles.exampleChipText}>{ex}</Text>
                </Pressable>
              ))}
            </ScrollView>
          ) : null}

          <View style={styles.addCard}>
            <TextInput
              style={styles.nameInput}
              value={draftName}
              onChangeText={setDraftName}
              placeholder="Ej. Jitomate, plátano, frijol…"
              placeholderTextColor={colors.textMuted}
              maxLength={80}
            />
            <View style={styles.addControls}>
              <TextInput
                style={styles.qtyInput}
                value={draftQty}
                onChangeText={setDraftQty}
                keyboardType="decimal-pad"
                placeholder="1"
                placeholderTextColor={colors.textMuted}
              />
              <View style={styles.unitRow}>
                {(['kg', 'g'] as MandadoUnit[]).map((unit) => (
                  <Pressable
                    key={unit}
                    style={[styles.unitBtn, draftUnit === unit && styles.unitBtnActive]}
                    onPress={() => setDraftUnit(unit)}
                  >
                    <Text style={[styles.unitBtnText, draftUnit === unit && styles.unitBtnTextActive]}>
                      {unit}
                    </Text>
                  </Pressable>
                ))}
              </View>
              <Pressable style={styles.addBtn} onPress={addItem}>
                <Ionicons name="add" size={22} color="#FFF" />
              </Pressable>
            </View>
          </View>
        </SectionCard>

        <SectionCard title="Tiendas preferidas" icon="storefront-outline" optional>
          <TextInput
            style={styles.textArea}
            value={preferredStores}
            onChangeText={setPreferredStores}
            placeholder="Central de abastos, Soriana, tiendita de la esquina…"
            placeholderTextColor={colors.textMuted}
            multiline
          />
          <View style={styles.storeRow}>
            {MANDADO_STORE_SUGGESTIONS.map((store) => (
              <Pressable
                key={store}
                style={styles.storeChip}
                onPress={() => setPreferredStores((prev) => (prev ? `${prev}, ${store}` : store))}
              >
                <Text style={styles.storeChipText}>{store}</Text>
              </Pressable>
            ))}
          </View>
        </SectionCard>

        <SectionCard title="Entrega" icon="location-outline">
          <ShipmentAddressBlock
            title="Dirección"
            fieldLabel="¿A dónde lo llevamos?"
            icon="home-outline"
            placeholder="Calle, número, colonia…"
            value={deliveryAddress}
            onChangeText={handleAddressChange}
            onGeocode={handleGeocodeAddress}
            onUseLocation={handleUseMyLocation}
            geocoding={geocoding}
            locating={locating}
            coverageOk={coverageOk}
            approximate={addressApproximate}
          />
          <Text style={styles.notesLabel}>Notas (opcional)</Text>
          <TextInput
            style={styles.textArea}
            value={deliveryNotes}
            onChangeText={setDeliveryNotes}
            placeholder="Ej. que estén maduros, timbre rojo…"
            placeholderTextColor={colors.textMuted}
            multiline
          />
        </SectionCard>

        <SectionCard title="Pago del servicio" icon="wallet-outline">
          <View style={styles.payRow}>
            {(['cash', 'transfer'] as const).map((method) => (
              <Pressable
                key={method}
                style={[styles.payOption, paymentMethod === method && styles.payOptionActive]}
                onPress={() => setPaymentMethod(method)}
              >
                <Ionicons
                  name={method === 'cash' ? 'cash-outline' : 'card-outline'}
                  size={20}
                  color={paymentMethod === method ? colors.primary : colors.textMuted}
                />
                <Text
                  style={[styles.payOptionText, paymentMethod === method && styles.payOptionTextActive]}
                  numberOfLines={1}
                >
                  {method === 'cash' ? 'Efectivo' : 'Transferencia'}
                </Text>
              </Pressable>
            ))}
          </View>
          <Text style={styles.payNote}>
            Los productos se pagan aparte al repartidor o en la tienda.
          </Text>
        </SectionCard>
      </KeyboardForm>
    </ScreenContainer>
  );
}

function SectionCard({
  title,
  icon,
  optional,
  children,
}: {
  title: string;
  icon: keyof typeof Ionicons.glyphMap;
  optional?: boolean;
  children: React.ReactNode;
}) {
  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <View style={styles.cardIcon}>
          <Ionicons name={icon} size={18} color={colors.primary} />
        </View>
        <Text style={styles.cardTitle} numberOfLines={1}>
          {title}
        </Text>
        {optional ? <Text style={styles.optionalTag}>Opcional</Text> : null}
      </View>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  scroll: {
    paddingHorizontal: spacing.screen,
    gap: spacing.md,
    backgroundColor: colors.background,
    paddingTop: spacing.sm,
  },
  hero: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    borderRadius: radii.xl,
    padding: spacing.lg,
    marginBottom: spacing.xs,
  },
  heroIcon: {
    width: 52,
    height: 52,
    borderRadius: radii.lg,
    backgroundColor: 'rgba(255,255,255,0.95)',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  heroCopy: { flex: 1, minWidth: 0 },
  heroTitle: { fontSize: 22, fontWeight: '900', color: '#FFF' },
  heroSub: { fontSize: 13, color: 'rgba(255,255,255,0.92)', marginTop: 4, lineHeight: 18 },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radii.xl,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.borderLight,
    gap: spacing.sm,
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  cardIcon: {
    width: 34,
    height: 34,
    borderRadius: radii.md,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  cardTitle: { flex: 1, minWidth: 0, fontSize: 16, fontWeight: '800', color: colors.text },
  optionalTag: { fontSize: 11, fontWeight: '700', color: colors.textMuted, flexShrink: 0 },
  emptyHint: { fontSize: 13, color: colors.textMuted, lineHeight: 18 },
  itemsList: {
    backgroundColor: colors.background,
    borderRadius: radii.lg,
    overflow: 'hidden',
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  itemRowBorder: { borderBottomWidth: 1, borderBottomColor: colors.borderLight },
  itemEmoji: { fontSize: 18, flexShrink: 0 },
  itemText: { flex: 1, minWidth: 0, fontSize: 15, fontWeight: '600', color: colors.text },
  categoryGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  categoryPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: radii.pill,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  categoryPillActive: { backgroundColor: colors.primaryLight, borderColor: colors.primary },
  categoryEmoji: { fontSize: 14 },
  categoryLabel: { fontSize: 12, fontWeight: '700', color: colors.textSecondary },
  categoryLabelActive: { color: colors.primary },
  examplesRow: { gap: 8, paddingVertical: 2 },
  exampleChip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: radii.pill,
    backgroundColor: colors.primaryLight,
  },
  exampleChipText: { fontSize: 12, fontWeight: '700', color: colors.primary },
  addCard: {
    backgroundColor: colors.background,
    borderRadius: radii.lg,
    padding: 12,
    gap: 10,
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  nameInput: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
    paddingVertical: 4,
  },
  addControls: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
  },
  qtyInput: {
    width: 64,
    minWidth: 56,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    paddingHorizontal: 10,
    paddingVertical: 10,
    fontSize: 16,
    fontWeight: '700',
    backgroundColor: colors.surface,
    color: colors.text,
    textAlign: 'center',
  },
  unitRow: {
    flexDirection: 'row',
    borderRadius: radii.md,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.border,
    flexShrink: 0,
  },
  unitBtn: { paddingHorizontal: 12, paddingVertical: 10, backgroundColor: colors.surface },
  unitBtnActive: { backgroundColor: colors.primary },
  unitBtnText: { fontSize: 13, fontWeight: '800', color: colors.textMuted },
  unitBtnTextActive: { color: '#FFF' },
  addBtn: {
    width: 44,
    height: 44,
    borderRadius: radii.md,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 'auto',
    flexShrink: 0,
  },
  textArea: {
    minHeight: 72,
    borderWidth: 1,
    borderColor: colors.borderLight,
    borderRadius: radii.lg,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: colors.text,
    backgroundColor: colors.background,
    textAlignVertical: 'top',
  },
  storeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  storeChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: radii.pill,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  storeChipText: { fontSize: 12, fontWeight: '700', color: colors.textSecondary },
  notesLabel: { fontSize: 13, fontWeight: '700', color: colors.textSecondary, marginTop: 4 },
  payRow: { flexDirection: 'row', gap: 10 },
  payOption: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    paddingHorizontal: 8,
    borderRadius: radii.lg,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.background,
  },
  payOptionActive: { borderColor: colors.primary, backgroundColor: colors.primaryLight },
  payOptionText: { fontSize: 14, fontWeight: '700', color: colors.textMuted, flexShrink: 1 },
  payOptionTextActive: { color: colors.primary },
  payNote: { fontSize: 12, color: colors.textMuted, lineHeight: 17 },
  footer: {
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.borderLight,
    paddingHorizontal: spacing.screen,
    paddingTop: 12,
    gap: 10,
  },
  footerInfo: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: 12,
  },
  footerLabel: { flex: 1, minWidth: 0, fontSize: 13, fontWeight: '600', color: colors.textSecondary },
  footerPrice: { fontSize: 20, fontWeight: '900', color: colors.text, flexShrink: 0 },
  footerBtn: { width: '100%' },
});
