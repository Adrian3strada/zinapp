import Ionicons from '@expo/vector-icons/Ionicons';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Image,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native';
import { appAlert, appConfirm } from '../../utils/appAlert';
import { useResponsiveLayout } from '../../hooks/useResponsiveLayout';
import { useTabScreenInsets } from '../../hooks/useTabScreenInsets';

import Button from '../../components/Button';
import EmptyState from '../../components/EmptyState';
import FoodImage from '../../components/FoodImage';
import FormField from '../../components/FormField';
import RestaurantHeroHeader from '../../components/restaurant/RestaurantHeroHeader';
import RestaurantPromotionsSection from '../../components/restaurant/RestaurantPromotionsSection';
import RestaurantSetupBanner from '../../components/RestaurantSetupBanner';
import ScreenContainer from '../../components/ScreenContainer';
import { useRestaurantContext } from '../../context/RestaurantContext';
import { productApi, restaurantApi } from '../../services/api';
import { colors } from '../../theme/colors';
import { HIT_SLOP, spacing } from '../../theme/spacing';
import { cardShadow } from '../../theme/shadows';
import type { Product, Restaurant } from '../../types';
import { getApiErrorMessage } from '../../utils/apiErrors';
import { keyboardAvoidingBehavior } from '../../utils/webPlatform';
import { formatCurrency, parsePriceInput } from '../../utils/format';
import { getProductEmoji } from '../../utils/foodVisuals';
import { appendImage } from '../../utils/imagePicker';
import { resolveMediaUrl } from '../../utils/media';
import * as ImagePicker from 'expo-image-picker';

interface ProductDraft {
  id?: number;
  name: string;
  description: string;
  price: string;
  is_available: boolean;
  imageUri?: string | null;
  image_url?: string | null;
}

const ProductManageRow = React.memo(function ProductManageRow({
  product,
  onEdit,
  onToggle,
  toggling,
}: {
  product: Product;
  onEdit: (product: Product) => void;
  onToggle: (product: Product, available: boolean) => void;
  toggling: boolean;
}) {
  const unavailable = !product.is_available;
  const skipEditRef = useRef(false);

  const handleToggle = (value: boolean) => {
    skipEditRef.current = true;
    setTimeout(() => {
      skipEditRef.current = false;
    }, 400);
    onToggle(product, value);
  };

  const handleEdit = () => {
    if (skipEditRef.current || toggling) return;
    onEdit(product);
  };

  const stopSwitchPointer = Platform.OS === 'web'
    ? {
        onClick: (event: { stopPropagation: () => void }) => event.stopPropagation(),
        onMouseDown: (event: { stopPropagation: () => void }) => event.stopPropagation(),
      }
    : {};

  return (
    <View style={[styles.productCard, unavailable && styles.productCardUnavailable]}>
      <Pressable
        style={({ pressed }) => [styles.productMain, pressed && styles.productCardPressed]}
        onPress={handleEdit}
      >
        <FoodImage
          emoji={getProductEmoji(product.name)}
          color={colors.primary}
          size="md"
          imageUri={resolveMediaUrl(product.image_url ?? product.image)}
        />
        <View style={styles.productInfo}>
          <View style={styles.nameRow}>
            <Text style={[styles.productName, unavailable && styles.unavailableText]} numberOfLines={1}>
              {product.name}
            </Text>
            {unavailable ? (
              <View style={styles.soldOutBadge}>
                <Text style={styles.soldOutText}>Agotado</Text>
              </View>
            ) : (
              <View style={styles.availableBadge}>
                <Text style={styles.availableText}>Visible</Text>
              </View>
            )}
          </View>
          {!!product.description && (
            <Text style={styles.productDesc} numberOfLines={2}>
              {product.description}
            </Text>
          )}
          <Text style={styles.productPrice}>{formatCurrency(product.price)}</Text>
        </View>
      </Pressable>
      <Pressable
        onPress={handleEdit}
        hitSlop={HIT_SLOP}
        style={styles.editIconBtn}
        accessibilityLabel={`Editar ${product.name}`}
      >
        <Ionicons name="create-outline" size={20} color={colors.textMuted} />
      </Pressable>
      <View
        style={styles.productActions}
        pointerEvents="box-none"
        {...stopSwitchPointer}
      >
        <View pointerEvents="auto" {...stopSwitchPointer}>
          <Switch
            value={product.is_available}
            onValueChange={handleToggle}
            disabled={toggling}
            trackColor={{ true: colors.primary, false: colors.border }}
            accessibilityLabel={`Disponibilidad de ${product.name}`}
          />
        </View>
      </View>
    </View>
  );
});

export default function RestaurantManageScreen() {
  const { isDesktopWeb } = useResponsiveLayout();
  const { insets, keyboardHeaderless, tabBottomPadding } = useTabScreenInsets();
  const { refresh: refreshRestaurant } = useRestaurantContext();
  const [restaurant, setRestaurant] = useState<Restaurant | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editor, setEditor] = useState<ProductDraft | null>(null);
  const [togglingId, setTogglingId] = useState<number | null>(null);
  const hasLoadedRef = useRef(false);

  const availableCount = products.filter((p) => p.is_available).length;

  const load = useCallback(async () => {
    const isRefresh = hasLoadedRef.current;
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError(null);
    try {
      const { data } = await restaurantApi.mine();
      setRestaurant(data);
      setProducts(data.products ?? []);
    } catch (err) {
      setError(getApiErrorMessage(err, 'No se pudo cargar tu menú'));
    } finally {
      hasLoadedRef.current = true;
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  React.useEffect(() => {
    load();
  }, [load]);

  const toggleProduct = async (product: Product, available: boolean) => {
    if (togglingId === product.id) return;
    setTogglingId(product.id);
    setProducts((prev) =>
      prev.map((p) => (p.id === product.id ? { ...p, is_available: available } : p)),
    );
    try {
      await productApi.patch(product.id, { is_available: available });
      await refreshRestaurant();
    } catch (err) {
      setProducts((prev) =>
        prev.map((p) => (p.id === product.id ? { ...p, is_available: !available } : p)),
      );
      appAlert('Error', getApiErrorMessage(err, 'No se pudo actualizar el producto.'));
    } finally {
      setTogglingId(null);
    }
  };

  const openNewProduct = () => {
    setEditor({
      name: '',
      description: '',
      price: '',
      is_available: true,
      imageUri: null,
    });
  };

  const openEditProduct = (product: Product) => {
    setEditor({
      id: product.id,
      name: product.name,
      description: product.description,
      price: product.price,
      is_available: product.is_available,
      image_url: product.image_url,
      imageUri: null,
    });
  };

  const closeEditor = useCallback(() => {
    Keyboard.dismiss();
    if (!editor) return;

    const isNewDraft =
      !editor.id &&
      (editor.name.trim() ||
        editor.description.trim() ||
        editor.price.trim() ||
        editor.imageUri);

    if (isNewDraft) {
      appConfirm(
        'Cerrar formulario',
        '¿Descartar el producto nuevo?',
        () => setEditor(null),
        'Descartar',
      );
      return;
    }
    setEditor(null);
  }, [editor]);

  const pickImage = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      appAlert('Permiso', 'Necesitamos acceso a tus fotos.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.8,
    });
    if (!result.canceled && editor) {
      setEditor({ ...editor, imageUri: result.assets[0].uri });
    }
  };

  const saveProduct = async () => {
    if (!restaurant || !editor) return;
    if (!editor.name.trim() || !editor.price.trim()) {
      appAlert('Producto', 'Nombre y precio son obligatorios.');
      return;
    }
    const parsedPrice = parsePriceInput(editor.price);
    if (parsedPrice === null) {
      appAlert('Producto', 'Indica un precio válido (ej. 85.00).');
      return;
    }
    const wasEdit = !!editor.id;
    setSaving(true);
    try {
      const fd = new FormData();
      fd.append('name', editor.name.trim());
      fd.append('description', editor.description.trim());
      fd.append('price', parsedPrice.toFixed(2));
      fd.append('is_available', editor.is_available ? 'true' : 'false');
      if (editor.imageUri) {
        await appendImage(fd, 'image', editor.imageUri, 'product.jpg');
      }
      if (editor.id) {
        const { data } = await productApi.update(editor.id, fd);
        setProducts((prev) => prev.map((p) => (p.id === data.id ? data : p)));
      } else {
        fd.append('restaurant', String(restaurant.id));
        const { data } = await productApi.create(fd);
        setProducts((prev) => [...prev, data].sort((a, b) => a.name.localeCompare(b.name)));
      }
      setEditor(null);
      await refreshRestaurant();
      appAlert('Listo', wasEdit ? 'Producto actualizado' : 'Producto agregado');
    } catch (err) {
      appAlert('Error', getApiErrorMessage(err, 'No se pudo guardar el producto'));
    } finally {
      setSaving(false);
    }
  };

  const deleteProduct = () => {
    if (!editor?.id) return;
    appConfirm(
      'Eliminar producto',
      `¿Quitar "${editor.name}" del menú?`,
      async () => {
        setDeleting(true);
        try {
          await productApi.delete(editor.id!);
          setProducts((prev) => prev.filter((p) => p.id !== editor.id));
          setEditor(null);
          await refreshRestaurant();
          appAlert('Listo', 'Producto eliminado');
        } catch (err) {
          appAlert('Error', getApiErrorMessage(err, 'No se pudo eliminar el producto'));
        } finally {
          setDeleting(false);
        }
      },
      'Eliminar',
    );
  };

  if (loading) {
    return <ScreenContainer loading />;
  }

  const scrollPadding = {
    paddingHorizontal: spacing.screen,
    paddingBottom: tabBottomPadding(spacing.xxl),
  };

  return (
    <ScreenContainer error={error} onRetry={load}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={keyboardAvoidingBehavior()}
        keyboardVerticalOffset={keyboardHeaderless()}
      >
        <ScrollView
          contentContainerStyle={scrollPadding}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => {
                void load();
                void refreshRestaurant();
              }}
              colors={[colors.primary]}
              tintColor={colors.primary}
            />
          }
        >
          <RestaurantHeroHeader
            restaurant={restaurant}
            topInset={insets.top}
            eyebrow="Menú"
            title={restaurant?.name}
            subtitle="Administra platillos, precios y disponibilidad"
            stats={[
              { label: 'Platillos', value: products.length, icon: 'fast-food-outline' },
              { label: 'Disponibles', value: availableCount, icon: 'checkmark-circle-outline' },
              {
                label: 'Ocultos',
                value: products.length - availableCount,
                icon: 'eye-off-outline',
              },
            ]}
            actionIcon="add"
            onActionPress={openNewProduct}
          />

          {restaurant?.setup_status ? (
            <RestaurantSetupBanner restaurant={restaurant} setupStatus={restaurant.setup_status} />
          ) : null}

          <View style={styles.tipCard}>
            <Ionicons name="information-circle-outline" size={20} color={colors.primary} />
            <Text style={styles.tipText}>
              Logo, horario y ubicación del local se configuran en la pestaña{' '}
              <Text style={styles.tipBold}>Perfil</Text>.
            </Text>
          </View>

          {products.length === 0 ? (
            <EmptyState
              emoji="🍽️"
              title="Sin platillos aún"
              subtitle="Agrega tu primer producto para que los clientes puedan pedir"
              actionLabel="Agregar primer platillo"
              onAction={openNewProduct}
            />
          ) : (
            <View style={styles.menuSection}>
              <View style={styles.sectionRow}>
                <View style={styles.sectionCopy}>
                  <Text style={styles.sectionTitle}>Catálogo</Text>
                  <Text style={styles.sectionSub}>
                    Toca un platillo para editarlo · usa el switch para ocultarlo
                  </Text>
                </View>
                <Pressable style={styles.addBtn} onPress={openNewProduct} hitSlop={HIT_SLOP}>
                  <Ionicons name="add" size={20} color="#FFF" />
                  <Text style={styles.addText}>Nuevo</Text>
                </Pressable>
              </View>
              {products.map((item) => (
                <ProductManageRow
                  key={item.id}
                  product={item}
                  onEdit={openEditProduct}
                  onToggle={toggleProduct}
                  toggling={togglingId === item.id}
                />
              ))}
            </View>
          )}

          <RestaurantPromotionsSection
            products={products}
            onChanged={() => {
              void load();
              void refreshRestaurant();
            }}
          />
        </ScrollView>
      </KeyboardAvoidingView>

      <Modal visible={!!editor} animationType="slide" transparent onRequestClose={closeEditor}>
        <KeyboardAvoidingView
          style={styles.flex}
          behavior={keyboardAvoidingBehavior()}
        >
          <View style={[styles.modalOverlay, isDesktopWeb && styles.modalOverlayDesktop]}>
            <Pressable style={styles.modalBackdrop} onPress={closeEditor} />
            <View
              style={[
                styles.modal,
                isDesktopWeb && styles.modalDesktop,
                { paddingBottom: insets.bottom + 12 },
              ]}
            >
              <View style={styles.modalHeader}>
                <View>
                  <Text style={styles.modalEyebrow}>
                    {editor?.id ? 'Editar platillo' : 'Nuevo platillo'}
                  </Text>
                  <Text style={styles.modalTitle}>
                    {editor?.id ? editor.name || 'Producto' : 'Agregar al menú'}
                  </Text>
                </View>
                <Pressable
                  onPress={closeEditor}
                  hitSlop={HIT_SLOP}
                  style={styles.modalClose}
                  accessibilityLabel="Cerrar"
                >
                  <Ionicons name="close" size={26} color={colors.textSecondary} />
                </Pressable>
              </View>

              <ScrollView
                style={styles.modalBody}
                keyboardShouldPersistTaps="handled"
                keyboardDismissMode="interactive"
                showsVerticalScrollIndicator={false}
                contentContainerStyle={styles.modalScroll}
              >
                <Pressable style={styles.photoBox} onPress={pickImage} hitSlop={HIT_SLOP}>
                  {editor?.imageUri || editor?.image_url ? (
                    <Image
                      source={{ uri: editor?.imageUri ?? editor?.image_url ?? undefined }}
                      style={styles.photoImage}
                    />
                  ) : (
                    <View style={styles.photoPlaceholder}>
                      <Ionicons name="camera" size={36} color={colors.primary} />
                      <Text style={styles.photoPlaceholderText}>Foto del platillo</Text>
                      <Text style={styles.photoHint}>Mejora las ventas con una buena foto</Text>
                    </View>
                  )}
                </Pressable>

                <FormField
                  label="Nombre del platillo"
                  value={editor?.name ?? ''}
                  onChangeText={(v) => setEditor((e) => (e ? { ...e, name: v } : e))}
                  icon="restaurant-outline"
                  embedded
                  required
                  autoCapitalize="words"
                />
                <FormField
                  label="Precio"
                  value={editor?.price ?? ''}
                  onChangeText={(v) => setEditor((e) => (e ? { ...e, price: v } : e))}
                  icon="cash-outline"
                  placeholder="Ej. 85.00"
                  embedded
                  required
                  keyboardType="decimal-pad"
                />
                <FormField
                  label="Descripción"
                  value={editor?.description ?? ''}
                  onChangeText={(v) => setEditor((e) => (e ? { ...e, description: v } : e))}
                  icon="text-outline"
                  embedded
                  multiline
                  placeholder="Ingredientes, porción, etc."
                />

                <View style={styles.availabilityRow}>
                  <View style={styles.availabilityInfo}>
                    <Text style={styles.availabilityLabel}>Disponible en menú</Text>
                    <Text style={styles.availabilityHint}>
                      Si lo apagas, los clientes no lo verán
                    </Text>
                  </View>
                  <Switch
                    value={editor?.is_available ?? true}
                    onValueChange={(v) => setEditor((e) => (e ? { ...e, is_available: v } : e))}
                    trackColor={{ true: colors.primary, false: colors.border }}
                  />
                </View>
              </ScrollView>

              <View style={styles.modalFooter}>
                <View style={styles.modalActions}>
                  <Button
                    title="Cancelar"
                    variant="secondary"
                    onPress={closeEditor}
                    style={styles.modalActionBtn}
                  />
                  <Button
                    title="Guardar"
                    onPress={saveProduct}
                    loading={saving}
                    style={styles.modalActionBtn}
                  />
                </View>
                {editor?.id && (
                  <Button
                    title="Eliminar producto"
                    variant="danger"
                    onPress={deleteProduct}
                    loading={deleting}
                    style={styles.deleteBtn}
                  />
                )}
              </View>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  tipCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    backgroundColor: colors.primaryLight,
    borderRadius: 14,
    padding: spacing.md,
    marginBottom: spacing.lg,
    borderWidth: 1,
    borderColor: colors.primary + '22',
  },
  tipText: { flex: 1, fontSize: 13, color: colors.textSecondary, lineHeight: 19 },
  tipBold: { fontWeight: '800', color: colors.primary },
  menuSection: {
    backgroundColor: colors.surface,
    borderRadius: 22,
    padding: spacing.lg,
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
  sectionCopy: { flex: 1, minWidth: 0 },
  sectionTitle: { fontSize: 18, fontWeight: '800', color: colors.text, letterSpacing: -0.2 },
  sectionSub: { fontSize: 12, color: colors.textSecondary, marginTop: 2, lineHeight: 17 },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.primary,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    minHeight: 44,
    flexShrink: 0,
  },
  addText: { color: '#FFF', fontWeight: '700', fontSize: 13 },
  productCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  productCardUnavailable: { opacity: 0.75 },
  productCardPressed: { opacity: 0.92 },
  productMain: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    minWidth: 0,
  },
  productInfo: { flex: 1, minWidth: 0 },
  editIconBtn: { padding: 4 },
  productActions: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingLeft: 8,
    minWidth: 56,
    zIndex: 2,
  },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  productName: { fontWeight: '800', fontSize: 15, color: colors.text, flexShrink: 1 },
  unavailableText: { color: colors.textSecondary },
  soldOutBadge: {
    backgroundColor: colors.error + '18',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  soldOutText: { fontSize: 10, fontWeight: '700', color: colors.error },
  availableBadge: {
    backgroundColor: colors.success + '18',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  availableText: { fontSize: 10, fontWeight: '700', color: colors.success },
  productDesc: { fontSize: 12, color: colors.textSecondary, marginTop: 4, lineHeight: 17 },
  productPrice: { color: colors.primary, fontWeight: '800', fontSize: 16, marginTop: 6 },
  modalOverlay: { flex: 1, justifyContent: 'flex-end' },
  modalOverlayDesktop: {
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
  },
  modalBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  modal: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 16,
    paddingHorizontal: 20,
    maxHeight: '92%',
  },
  modalDesktop: {
    width: '100%',
    maxWidth: 480,
    alignSelf: 'center',
    borderRadius: 24,
    marginBottom: 0,
  },
  modalBody: { flexGrow: 0, flexShrink: 1 },
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
  modalClose: { padding: 4 },
  modalScroll: { paddingBottom: 8 },
  photoBox: {
    height: 180,
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: spacing.md,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    borderStyle: 'dashed',
  },
  photoImage: { width: '100%', height: '100%', resizeMode: 'cover' },
  photoPlaceholder: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 6 },
  photoPlaceholderText: { color: colors.primary, fontWeight: '700', fontSize: 15 },
  photoHint: { color: colors.textMuted, fontSize: 12 },
  availabilityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.background,
    borderRadius: 12,
    padding: 14,
    marginTop: 4,
    marginBottom: 8,
  },
  availabilityInfo: { flex: 1, paddingRight: 12 },
  availabilityLabel: { fontSize: 15, fontWeight: '700', color: colors.text },
  availabilityHint: { fontSize: 12, color: colors.textSecondary, marginTop: 2 },
  modalFooter: {
    paddingTop: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: colors.borderLight,
  },
  modalActions: {
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: 10,
  },
  modalActionBtn: { flex: 1, minWidth: 0 },
  deleteBtn: { marginTop: 10, alignSelf: 'stretch' },
});
