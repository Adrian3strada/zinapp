import Ionicons from '@expo/vector-icons/Ionicons';
import React, { useCallback, useMemo, useRef, useState } from 'react';
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
import FormField from '../../components/FormField';
import ScreenContainer from '../../components/ScreenContainer';
import ShipmentAddressBlock from '../../components/ShipmentAddressBlock';
import { getShipmentFee } from '../../config/delivery';
import { useAuth } from '../../context/AuthContext';
import { useLocation } from '../../hooks/useLocation';
import type { MandadoScreenProps } from '../../navigation/types';
import { restaurantApi, shipmentApi } from '../../services/api';
import { colors } from '../../theme/colors';
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
import { runWithRetry } from '../../utils/runWithRetry';

const MANDADO_COLOR = '#16A34A';

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

  const addItem = useCallback(() => {
    const name = draftName.trim();
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
        quantity: String(qty),
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

  const quickAdd = useCallback((name: string, category: MandadoCategory) => {
    setDraftName(name);
    setDraftCategory(category);
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

  const summaryPreview = useMemo(
    () => items.map((it) => formatMandadoItem(it)).join(' · '),
    [items],
  );

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
            name: it.name,
            quantity: parseFloat(it.quantity),
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
      <ScrollView
        contentContainerStyle={[
          styles.scroll,
          { paddingTop: insets.top + spacing.sm, paddingBottom: insets.bottom + 24 },
        ]}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.hero}>
          <View style={styles.heroIcon}>
            <Text style={styles.heroEmoji}>🛒</Text>
          </View>
          <View style={styles.heroText}>
            <Text style={styles.heroTitle}>Mandado</Text>
            <Text style={styles.heroSub}>
              Pide verdura, fruta, legumbres y más. Indica kilos o gramos y tus tiendas de preferencia.
            </Text>
          </View>
        </View>

        <Text style={styles.sectionTitle}>¿Qué necesitas?</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.catRow}>
          {MANDADO_CATEGORIES.map((cat) => (
            <Pressable
              key={cat.key}
              style={[styles.catChip, draftCategory === cat.key && styles.catChipActive]}
              onPress={() => setDraftCategory(cat.key)}
            >
              <Text style={styles.catEmoji}>{cat.emoji}</Text>
              <Text style={[styles.catLabel, draftCategory === cat.key && styles.catLabelActive]}>
                {cat.label}
              </Text>
            </Pressable>
          ))}
        </ScrollView>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.quickRow}>
          {MANDADO_CATEGORIES.find((c) => c.key === draftCategory)?.examples.map((ex) => (
            <Pressable key={ex} style={styles.quickChip} onPress={() => quickAdd(ex, draftCategory)}>
              <Text style={styles.quickChipText}>{ex}</Text>
            </Pressable>
          ))}
        </ScrollView>

        <View style={styles.addRow}>
          <FormField
            label="Producto"
            value={draftName}
            onChangeText={setDraftName}
            placeholder="Ej. Tomate, plátano, frijol…"
            embedded
          />
          <View style={styles.qtyRow}>
            <TextInput
              style={styles.qtyInput}
              value={draftQty}
              onChangeText={setDraftQty}
              keyboardType="decimal-pad"
              placeholder="1"
            />
            <View style={styles.unitToggle}>
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

        {items.length > 0 ? (
          <View style={styles.itemsBox}>
            {items.map((item) => (
              <View key={item.id} style={styles.itemRow}>
                <Text style={styles.itemEmoji}>
                  {MANDADO_CATEGORIES.find((c) => c.key === item.category)?.emoji ?? '🛒'}
                </Text>
                <Text style={styles.itemText}>{formatMandadoItem(item)}</Text>
                <Pressable onPress={() => removeItem(item.id)} hitSlop={8}>
                  <Ionicons name="close-circle" size={20} color={colors.textMuted} />
                </Pressable>
              </View>
            ))}
          </View>
        ) : (
          <Text style={styles.hint}>Agrega productos con cantidad en kg o gramos.</Text>
        )}

        <Text style={styles.sectionTitle}>Tiendas de preferencia</Text>
        <FormField
          label="¿Dónde prefieres que compren?"
          value={preferredStores}
          onChangeText={setPreferredStores}
          placeholder="Ej. Central de abastos, Soriana, tiendita…"
          multiline
          embedded
        />
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.quickRow}>
          {MANDADO_STORE_SUGGESTIONS.map((store) => (
            <Pressable
              key={store}
              style={styles.quickChip}
              onPress={() => setPreferredStores((prev) => (prev ? `${prev}, ${store}` : store))}
            >
              <Text style={styles.quickChipText}>{store}</Text>
            </Pressable>
          ))}
        </ScrollView>

        <Text style={styles.sectionTitle}>Entrega a domicilio</Text>
        <ShipmentAddressBlock
          title="Tu dirección"
          fieldLabel="Dirección de entrega"
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

        <FormField
          label="Notas (opcional)"
          value={deliveryNotes}
          onChangeText={setDeliveryNotes}
          placeholder="Ej. que estén maduros, sin bolsa, timbre rojo…"
          multiline
          embedded
        />

        <Text style={styles.sectionTitle}>Pago del servicio</Text>
        <View style={styles.payRow}>
          {(['cash', 'transfer'] as const).map((method) => (
            <Pressable
              key={method}
              style={[styles.payChip, paymentMethod === method && styles.payChipActive]}
              onPress={() => setPaymentMethod(method)}
            >
              <Ionicons
                name={method === 'cash' ? 'cash-outline' : 'card-outline'}
                size={18}
                color={paymentMethod === method ? colors.primary : colors.textMuted}
              />
              <Text style={[styles.payChipText, paymentMethod === method && styles.payChipTextActive]}>
                {method === 'cash' ? 'Efectivo' : 'Transferencia'}
              </Text>
            </Pressable>
          ))}
        </View>

        <View style={styles.feeBox}>
          <Text style={styles.feeLabel}>Costo del mandado (servicio + entrega)</Text>
          <Text style={styles.feeValue}>${deliveryFee.toFixed(2)}</Text>
          <Text style={styles.feeNote}>
            El costo de los productos se paga aparte al repartidor o en la tienda.
          </Text>
        </View>

        {summaryPreview ? (
          <Text style={styles.preview} numberOfLines={3}>
            {summaryPreview}
          </Text>
        ) : null}

        <Button
          title={`Pedir mandado · $${deliveryFee.toFixed(2)}`}
          onPress={handleSubmit}
          loading={submitting}
          style={styles.submit}
        />
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingHorizontal: spacing.screen, gap: spacing.sm },
  hero: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: '#ECFDF5',
    borderRadius: 18,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: '#BBF7D0',
    marginBottom: spacing.sm,
  },
  heroIcon: {
    width: 52,
    height: 52,
    borderRadius: 16,
    backgroundColor: '#DCFCE7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroEmoji: { fontSize: 28 },
  heroText: { flex: 1 },
  heroTitle: { fontSize: 22, fontWeight: '900', color: MANDADO_COLOR },
  heroSub: { fontSize: 13, color: colors.textSecondary, marginTop: 4, lineHeight: 18 },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.text,
    marginTop: spacing.sm,
    marginBottom: 4,
  },
  catRow: { gap: 8, paddingVertical: 4 },
  catChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  catChipActive: { backgroundColor: '#DCFCE7', borderColor: MANDADO_COLOR },
  catEmoji: { fontSize: 16 },
  catLabel: { fontSize: 13, fontWeight: '700', color: colors.textSecondary },
  catLabelActive: { color: MANDADO_COLOR },
  quickRow: { gap: 8, paddingVertical: 4, marginBottom: spacing.xs },
  quickChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: colors.primaryLight,
  },
  quickChipText: { fontSize: 12, fontWeight: '700', color: colors.primary },
  addRow: { gap: 8 },
  qtyRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  qtyInput: {
    width: 72,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    fontWeight: '700',
    backgroundColor: colors.surface,
    color: colors.text,
  },
  unitToggle: { flexDirection: 'row', borderRadius: 12, overflow: 'hidden', borderWidth: 1, borderColor: colors.border },
  unitBtn: { paddingHorizontal: 14, paddingVertical: 10, backgroundColor: colors.surface },
  unitBtnActive: { backgroundColor: MANDADO_COLOR },
  unitBtnText: { fontSize: 13, fontWeight: '800', color: colors.textMuted },
  unitBtnTextActive: { color: '#FFF' },
  addBtn: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: MANDADO_COLOR,
    alignItems: 'center',
    justifyContent: 'center',
  },
  itemsBox: {
    backgroundColor: colors.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.borderLight,
    padding: spacing.sm,
    gap: 8,
  },
  itemRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  itemEmoji: { fontSize: 18 },
  itemText: { flex: 1, fontSize: 14, fontWeight: '600', color: colors.text },
  hint: { fontSize: 13, color: colors.textMuted, fontStyle: 'italic' },
  payRow: { flexDirection: 'row', gap: 10 },
  payChip: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  payChipActive: { borderColor: colors.primary, backgroundColor: colors.primaryLight },
  payChipText: { fontSize: 14, fontWeight: '700', color: colors.textMuted },
  payChipTextActive: { color: colors.primary },
  feeBox: {
    backgroundColor: colors.surface,
    borderRadius: 14,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.borderLight,
    marginTop: spacing.sm,
  },
  feeLabel: { fontSize: 13, color: colors.textSecondary, fontWeight: '600' },
  feeValue: { fontSize: 28, fontWeight: '900', color: colors.text, marginTop: 4 },
  feeNote: { fontSize: 12, color: colors.textMuted, marginTop: 6, lineHeight: 17 },
  preview: { fontSize: 12, color: colors.textSecondary, marginTop: 4 },
  submit: { marginTop: spacing.md },
});
