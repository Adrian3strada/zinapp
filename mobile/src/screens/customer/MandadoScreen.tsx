import Ionicons from '@expo/vector-icons/Ionicons';
import { LinearGradient } from 'expo-linear-gradient';
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
import SeasonalHeroAccent from '../../components/seasonal/SeasonalHeroAccent';
import CategoryIconTile from '../../components/CategoryIconTile';
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
  categoryArticleUnits,
  formatMandadoItem,
  getCategoryMeta,
  MANDADO_CATEGORIES,
  MANDADO_STEPS,
  MANDADO_STORE_SUGGESTIONS,
  mandadoDraftToItem,
  mandadoItemToPayload,
  QUICK_QTY_ARTICLE,
  QUICK_QTY_WEIGHT_KG,
} from '../../utils/mandadoCategories';
import { appAlert, appConfirm } from '../../utils/appAlert';
import { getApiErrorMessage } from '../../utils/apiErrors';
import { createIdempotencyKey } from '../../utils/idempotency';
import { isInCoverage } from '../../utils/coverage';
import { formatCurrency } from '../../utils/format';
import { runWithRetry } from '../../utils/runWithRetry';
import { keyboardOffsetWithHeader } from '../../utils/screenInsets';

const MANDADO_TINTS: Record<MandadoCategory, string> = {
  verdura: '#BBF7D0',
  fruta: '#FECACA',
  legumbre: '#FED7AA',
  carnes: '#FECACA',
  abarrotes: '#FDE68A',
  lacteos: '#E0F2FE',
  bebidas: '#C7D2FE',
  limpieza: '#DDD6FE',
  farmacia: '#FBCFE8',
  otro: '#E8F1FB',
};

const ARTICLE_UNIT_LABELS: Record<MandadoUnit, string> = {
  pza: 'pza',
  paq: 'paq',
  lt: 'lt',
  kg: 'kg',
  g: 'g',
};

export default function MandadoScreen({ navigation }: MandadoScreenProps) {
  const insets = useSafeAreaInsets();
  const { user, requestLogin } = useAuth();
  const { getCurrentPosition, loading: locating } = useLocation();

  const [items, setItems] = useState<MandadoItem[]>([]);
  const [draftName, setDraftName] = useState('');
  const [draftNotes, setDraftNotes] = useState('');
  const [draftQty, setDraftQty] = useState('');
  const [draftUnit, setDraftUnit] = useState<MandadoUnit>('kg');
  const [draftArticleUnit, setDraftArticleUnit] = useState<MandadoUnit>('pza');
  const [draftMode, setDraftMode] = useState<'article' | 'weight'>('article');
  const [draftCategory, setDraftCategory] = useState<MandadoCategory>('abarrotes');
  const [hasDraft, setHasDraft] = useState(false);
  const nameRef = useRef('');
  const lastNameRef = useRef('');
  const [preferredStores, setPreferredStores] = useState('');
  const [pickupNotes, setPickupNotes] = useState('');
  const [estimatedBudget, setEstimatedBudget] = useState('');
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
  const categoryMeta = getCategoryMeta(draftCategory);
  const articleUnits = useMemo(() => categoryArticleUnits(draftCategory), [draftCategory]);

  const selectCategory = useCallback((key: MandadoCategory) => {
    setDraftCategory(key);
    const units = categoryArticleUnits(key);
    setDraftArticleUnit((current) => (units.includes(current) ? current : (units[0] ?? 'pza')));
  }, []);

  const resetDraft = useCallback(() => {
    nameRef.current = '';
    lastNameRef.current = '';
    setHasDraft(false);
    setDraftName('');
    setDraftNotes('');
    setDraftQty('');
  }, []);

  const setName = useCallback((text: string) => {
    nameRef.current = text;
    if (text.trim()) lastNameRef.current = text.trim();
    setHasDraft(!!text.trim() || !!lastNameRef.current);
    setDraftName(text);
  }, []);

  const readDraftItem = useCallback(() => {
    return mandadoDraftToItem({
      name: nameRef.current || lastNameRef.current || draftName,
      notes: draftNotes,
      quantity: draftQty,
      mode: draftMode,
      unit: draftUnit,
      articleUnit: draftArticleUnit,
      category: draftCategory,
    });
  }, [draftArticleUnit, draftCategory, draftMode, draftName, draftNotes, draftQty, draftUnit]);

  const addItem = useCallback(() => {
    const result = readDraftItem();
    if (!result.ok) {
      appAlert(
        result.reason === 'bad_qty' ? 'Cantidad' : 'Producto',
        result.reason === 'bad_qty'
          ? 'Indica un número válido o déjalo vacío.'
          : 'Escribe qué quieres en el mandado.',
      );
      return false;
    }
    setItems((prev) => [...prev, result.item]);
    resetDraft();
    return true;
  }, [readDraftItem, resetDraft]);

  const removeItem = useCallback((id: string) => {
    setItems((prev) => prev.filter((it) => it.id !== id));
  }, []);

  const clearList = useCallback(() => {
    if (items.length === 0) return;
    appConfirm('Vaciar lista', '¿Quitar todos los productos?', () => setItems([]));
  }, [items.length]);

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
    const pending = readDraftItem();
    const list = pending.ok ? [...items, pending.item] : items;
    if (list.length === 0) {
      appAlert('Lista vacía', 'Escribe al menos un producto.');
      return;
    }
    if (!preferredStores.trim()) {
      appAlert('Tienda', 'Escribe el nombre de la tienda o local donde quieres que compremos.');
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
          mandado_items: list.map(mandadoItemToPayload),
          preferred_stores: preferredStores.trim(),
          estimated_budget: estimatedBudget.trim() || undefined,
          pickup_notes: pickupNotes.trim() || undefined,
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
    estimatedBudget,
    items,
    navigation,
    paymentMethod,
    pickupNotes,
    preferredStores,
    readDraftItem,
    requestLogin,
    user,
  ]);

  const quickPresets = draftMode === 'weight' ? QUICK_QTY_WEIGHT_KG : QUICK_QTY_ARTICLE;

  return (
    <ScreenContainer>
      <KeyboardForm
        contentContainerStyle={styles.scroll}
        bottomPadding={spacing.xl}
        keyboardVerticalOffset={keyboardOffsetWithHeader(insets)}
        keyboardShouldPersistTaps="always"
        footer={
          <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, spacing.md) }]}>
            <View style={styles.footerInfo}>
              <Text style={styles.footerLabel} numberOfLines={1}>
                {items.length + (hasDraft ? 1 : 0) > 0
                  ? `${items.length + (hasDraft ? 1 : 0)} producto${items.length + (hasDraft ? 1 : 0) === 1 ? '' : 's'} · servicio + entrega`
                  : 'Servicio + entrega'}
              </Text>
              <Text style={styles.footerPrice} numberOfLines={1}>
                {formatCurrency(deliveryFee)}
              </Text>
            </View>
            <Button
              title={
                items.length > 0 || hasDraft
                  ? `Confirmar mandado · ${formatCurrency(deliveryFee)}`
                  : 'Escribe qué quieres'
              }
              onPress={() => { void handleSubmit(); }}
              loading={submitting}
              disabled={items.length === 0 && !hasDraft}
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
          <SeasonalHeroAccent />
          <View style={styles.heroIcon}>
            <Ionicons name="basket-outline" size={28} color={colors.primary} />
          </View>
          <View style={styles.heroCopy}>
            <Text style={styles.heroTitle} numberOfLines={1}>
              Haz tu mandado
            </Text>
            <Text style={styles.heroSub} numberOfLines={3}>
              Compramos en la tienda que elijas y te llevamos víveres, abarrotes, farmacia y más.
            </Text>
          </View>
        </LinearGradient>

        <View style={styles.stepsCard}>
          {MANDADO_STEPS.map((step, index) => (
            <View key={step.title} style={styles.stepRow}>
              <View style={styles.stepIcon}>
                <Ionicons name={step.icon} size={16} color={colors.primary} />
              </View>
              <View style={styles.stepCopy}>
                <Text style={styles.stepTitle}>
                  {index + 1}. {step.title}
                </Text>
                <Text style={styles.stepBody}>{step.body}</Text>
              </View>
            </View>
          ))}
        </View>

        <SectionCard
          title="Qué compras"
          icon="list-outline"
          badge={items.length + (hasDraft ? 1 : 0) > 0 ? String(items.length + (hasDraft ? 1 : 0)) : undefined}
          action={
            items.length > 0 ? (
              <Pressable onPress={clearList} hitSlop={8}>
                <Text style={styles.clearLink}>Vaciar</Text>
              </Pressable>
            ) : null
          }
        >
          <Text style={styles.sectionLabel}>Categoría</Text>
          <ScrollView
            horizontal
            nestedScrollEnabled
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.categoryRow}
            keyboardShouldPersistTaps="always"
          >
            {MANDADO_CATEGORIES.map((cat) => (
              <CategoryIconTile
                key={cat.key}
                emoji={cat.emoji}
                label={cat.label}
                tint={MANDADO_TINTS[cat.key]}
                selected={draftCategory === cat.key}
                onPress={() => selectCategory(cat.key)}
              />
            ))}
          </ScrollView>

          {categoryMeta?.examples.length ? (
            <>
              <Text style={styles.sectionLabel}>Sugerencias</Text>
              <ScrollView
                horizontal
                nestedScrollEnabled
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.examplesRow}
                keyboardShouldPersistTaps="always"
              >
                {categoryMeta.examples.map((ex) => (
                  <Pressable
                    key={ex}
                    style={styles.exampleChip}
                    onPress={() => setName(ex)}
                  >
                    <Text style={styles.exampleChipText}>{ex}</Text>
                  </Pressable>
                ))}
              </ScrollView>
            </>
          ) : null}

          <View style={styles.addCard}>
            <Text style={styles.sectionLabel}>Producto</Text>
            <View style={styles.modeRow}>
              {([
                { key: 'article' as const, label: 'Artículo', icon: 'cube-outline' as const },
                { key: 'weight' as const, label: 'Por peso', icon: 'scale-outline' as const },
              ]).map((mode) => {
                const active = draftMode === mode.key;
                return (
                  <Pressable
                    key={mode.key}
                    style={[styles.modeBtn, active && styles.modeBtnActive]}
                    onPress={() => {
                      setDraftMode(mode.key);
                      setDraftQty('');
                      if (mode.key === 'weight') setDraftUnit('kg');
                    }}
                  >
                    <Ionicons
                      name={mode.icon}
                      size={16}
                      color={active ? colors.primary : colors.textMuted}
                    />
                    <Text style={[styles.modeBtnText, active && styles.modeBtnTextActive]}>
                      {mode.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            <TextInput
              style={styles.nameInput}
              value={draftName}
              onChangeText={setName}
              placeholder="Ej. salsa Valentina, leche, jitomate…"
              placeholderTextColor={colors.textMuted}
              maxLength={80}
              returnKeyType="done"
              blurOnSubmit={false}
              onSubmitEditing={addItem}
            />

            <TextInput
              style={styles.notesInput}
              value={draftNotes}
              onChangeText={setDraftNotes}
              placeholder="Detalle opcional: marca, presentación, que estén frescos…"
              placeholderTextColor={colors.textMuted}
              maxLength={120}
            />

            <ScrollView
              horizontal
              nestedScrollEnabled
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.quickRow}
              keyboardShouldPersistTaps="always"
            >
              {quickPresets.map((preset) => {
                const label = draftMode === 'weight' ? `${preset} kg` : String(preset);
                const active = draftQty === String(preset);
                return (
                  <Pressable
                    key={label}
                    style={[styles.quickChip, active && styles.quickChipActive]}
                    onPress={() => setDraftQty(String(preset))}
                  >
                    <Text style={[styles.quickChipText, active && styles.quickChipTextActive]}>
                      {label}
                    </Text>
                  </Pressable>
                );
              })}
              <Pressable
                style={[styles.quickChip, !draftQty && styles.quickChipActive]}
                onPress={() => setDraftQty('')}
              >
                <Text style={[styles.quickChipText, !draftQty && styles.quickChipTextActive]}>
                  Sin cantidad
                </Text>
              </Pressable>
            </ScrollView>

            {draftMode === 'weight' ? (
              <View style={styles.addControls}>
                <TextInput
                  style={styles.qtyInput}
                  value={draftQty}
                  onChangeText={setDraftQty}
                  keyboardType="decimal-pad"
                  placeholder="Cant."
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
              </View>
            ) : (
              <View style={styles.addControls}>
                <TextInput
                  style={styles.qtyInputOptional}
                  value={draftQty}
                  onChangeText={setDraftQty}
                  keyboardType="decimal-pad"
                  placeholder="Cantidad (opcional)"
                  placeholderTextColor={colors.textMuted}
                />
                {draftQty.trim() ? (
                  <View style={styles.unitRow}>
                    {articleUnits.map((unit) => (
                      <Pressable
                        key={unit}
                        style={[styles.unitBtn, draftArticleUnit === unit && styles.unitBtnActive]}
                        onPress={() => setDraftArticleUnit(unit)}
                      >
                        <Text
                          style={[
                            styles.unitBtnText,
                            draftArticleUnit === unit && styles.unitBtnTextActive,
                          ]}
                        >
                          {ARTICLE_UNIT_LABELS[unit]}
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                ) : null}
              </View>
            )}

            <Pressable style={styles.addTextBtn} onPress={addItem}>
              <Ionicons name="add-circle-outline" size={18} color={colors.primary} />
              <Text style={styles.addTextBtnLabel}>Agregar otro a la lista</Text>
            </Pressable>
          </View>

          <Text style={styles.sectionLabel}>En tu lista</Text>
          {items.length === 0 && !hasDraft ? (
            <Text style={styles.emptyHint}>
              Lo que escribas arriba ya cuenta como producto. Confirma el mandado o pulsa agregar otro.
            </Text>
          ) : (
            <View style={styles.itemsList}>
              {items.map((item, index) => {
                const cat = getCategoryMeta(item.category);
                return (
                  <View
                    key={item.id}
                    style={[styles.itemRow, (index < items.length - 1 || hasDraft) && styles.itemRowBorder]}
                  >
                    <Text style={styles.itemEmoji}>{cat?.emoji ?? '🛒'}</Text>
                    <View style={styles.itemCopy}>
                      <Text style={styles.itemText} numberOfLines={2}>
                        {formatMandadoItem(item)}
                      </Text>
                      <Text style={styles.itemMeta} numberOfLines={2}>
                        {item.notes ? item.notes : cat?.label}
                      </Text>
                    </View>
                    <Pressable onPress={() => removeItem(item.id)} hitSlop={8}>
                      <Ionicons name="trash-outline" size={18} color={colors.textMuted} />
                    </Pressable>
                  </View>
                );
              })}
              {hasDraft ? (
                <View style={styles.itemRow}>
                  <Text style={styles.itemEmoji}>{categoryMeta?.emoji ?? '🛒'}</Text>
                  <View style={styles.itemCopy}>
                    <Text style={styles.itemText} numberOfLines={2}>
                      {draftName.trim() || lastNameRef.current}
                    </Text>
                    <Text style={styles.itemMeta}>Se incluye al confirmar</Text>
                  </View>
                </View>
              ) : null}
            </View>
          )}
        </SectionCard>

        <SectionCard title="¿Dónde compramos?" icon="storefront-outline">
          <Text style={styles.storeHint}>
            Elige un atajo o escribe la tienda, verdulería o abarrotes que quieras. El repartidor irá ahí.
          </Text>
          <ScrollView
            horizontal
            nestedScrollEnabled
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.examplesRow}
            keyboardShouldPersistTaps="always"
          >
            {MANDADO_STORE_SUGGESTIONS.map((store) => (
              <Pressable
                key={store}
                style={styles.exampleChip}
                onPress={() => setPreferredStores(store)}
              >
                <Text style={styles.exampleChipText}>{store}</Text>
              </Pressable>
            ))}
          </ScrollView>
          <TextInput
            style={styles.storeInput}
            value={preferredStores}
            onChangeText={setPreferredStores}
            placeholder="Ej. Verdulería de la esquina, Abarrotes Don Pepe…"
            placeholderTextColor={colors.textMuted}
            maxLength={120}
            autoCapitalize="words"
          />
          <Text style={styles.sectionLabel}>Instrucciones para la tienda (opcional)</Text>
          <TextInput
            style={styles.notesInput}
            value={pickupNotes}
            onChangeText={setPickupNotes}
            placeholder="Ej. preguntar promos, llevar bolsa, pedir factura…"
            placeholderTextColor={colors.textMuted}
            maxLength={200}
          />
          <Text style={styles.sectionLabel}>Presupuesto aproximado de productos (opcional)</Text>
          <TextInput
            style={styles.storeInput}
            value={estimatedBudget}
            onChangeText={setEstimatedBudget}
            placeholder="Ej. $300 – $500 en productos"
            placeholderTextColor={colors.textMuted}
            maxLength={80}
          />
          <Text style={styles.payNote}>
            El costo de los productos se paga aparte al repartidor o en la tienda.
          </Text>
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
          <Text style={styles.sectionLabel}>Notas de entrega (opcional)</Text>
          <TextInput
            style={styles.textArea}
            value={deliveryNotes}
            onChangeText={setDeliveryNotes}
            placeholder="Ej. timbre rojo, dejar en portería…"
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
            Este pago es solo por el servicio de mandado ({formatCurrency(deliveryFee)}). Los productos van aparte.
          </Text>
        </SectionCard>
      </KeyboardForm>
    </ScreenContainer>
  );
}

function SectionCard({
  title,
  icon,
  badge,
  action,
  children,
}: {
  title: string;
  icon: keyof typeof Ionicons.glyphMap;
  badge?: string;
  action?: React.ReactNode;
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
        {badge ? (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{badge}</Text>
          </View>
        ) : null}
        {action}
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
    overflow: 'hidden',
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
  stepsCard: {
    backgroundColor: colors.surface,
    borderRadius: radii.xl,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.borderLight,
    gap: 10,
  },
  stepRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  stepIcon: {
    width: 32,
    height: 32,
    borderRadius: radii.md,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  stepCopy: { flex: 1, minWidth: 0 },
  stepTitle: { fontSize: 14, fontWeight: '800', color: colors.text },
  stepBody: { fontSize: 12, color: colors.textMuted, marginTop: 2, lineHeight: 16 },
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
  badge: {
    minWidth: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  badgeText: { color: '#FFF', fontSize: 12, fontWeight: '800' },
  clearLink: { fontSize: 13, fontWeight: '700', color: colors.error },
  sectionLabel: { fontSize: 12, fontWeight: '800', color: colors.textSecondary, marginTop: 2 },
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
  itemCopy: { flex: 1, minWidth: 0, gap: 2 },
  itemText: { fontSize: 15, fontWeight: '700', color: colors.text },
  itemMeta: { fontSize: 12, fontWeight: '600', color: colors.textMuted },
  categoryRow: { gap: 12, paddingVertical: 6, paddingRight: 8 },
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
  modeRow: { flexDirection: 'row', gap: 8 },
  modeBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.borderLight,
    backgroundColor: colors.surface,
  },
  modeBtnActive: { borderColor: colors.primary, backgroundColor: colors.primaryLight },
  modeBtnText: { fontSize: 13, fontWeight: '800', color: colors.textMuted },
  modeBtnTextActive: { color: colors.primary },
  nameInput: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    paddingHorizontal: 12,
    paddingVertical: 12,
    backgroundColor: colors.surface,
  },
  notesInput: {
    borderWidth: 1,
    borderColor: colors.borderLight,
    borderRadius: radii.md,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: colors.text,
    backgroundColor: colors.surface,
  },
  quickRow: { gap: 8 },
  quickChip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.borderLight,
    backgroundColor: colors.surface,
  },
  quickChipActive: { borderColor: colors.primary, backgroundColor: colors.primaryLight },
  quickChipText: { fontSize: 12, fontWeight: '700', color: colors.textMuted },
  quickChipTextActive: { color: colors.primary },
  articleBlock: { gap: 8 },
  addControls: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
  },
  qtyInput: {
    width: 72,
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
  qtyInputOptional: {
    flex: 1,
    minWidth: 120,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    fontWeight: '600',
    backgroundColor: colors.surface,
    color: colors.text,
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
  addTextBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    minHeight: 44,
    paddingVertical: 10,
    borderRadius: radii.md,
    backgroundColor: colors.primaryLight,
  },
  addTextBtnLabel: { fontSize: 14, fontWeight: '800', color: colors.primary },
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
  storeHint: { fontSize: 13, color: colors.textMuted, lineHeight: 18 },
  storeInput: {
    borderWidth: 1,
    borderColor: colors.borderLight,
    borderRadius: radii.lg,
    paddingHorizontal: 14,
    paddingVertical: 14,
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
    backgroundColor: colors.background,
  },
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
