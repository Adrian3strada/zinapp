import Ionicons from '@expo/vector-icons/Ionicons';
import { LinearGradient } from 'expo-linear-gradient';
import * as ImagePicker from 'expo-image-picker';
import React, { useCallback, useState } from 'react';
import {
  Alert,
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
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import Button from '../../components/Button';
import EmptyState from '../../components/EmptyState';
import FoodImage from '../../components/FoodImage';
import FormField from '../../components/FormField';
import ScreenContainer from '../../components/ScreenContainer';
import { productApi, restaurantApi } from '../../services/api';
import { colors } from '../../theme/colors';
import { HIT_SLOP, spacing } from '../../theme/spacing';
import { cardShadow } from '../../theme/shadows';
import type { Product, Restaurant } from '../../types';
import { getApiErrorMessage } from '../../utils/apiErrors';
import { formatCurrency } from '../../utils/format';
import { getProductEmoji } from '../../utils/foodVisuals';
import { resolveMediaUrl } from '../../utils/media';

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
}: {
  product: Product;
  onEdit: (product: Product) => void;
  onToggle: (product: Product, available: boolean) => void;
}) {
  const unavailable = !product.is_available;

  return (
    <View style={[styles.productRow, unavailable && styles.productRowUnavailable]}>
      <Pressable style={styles.productMain} onPress={() => onEdit(product)} hitSlop={HIT_SLOP}>
        <FoodImage
          emoji={getProductEmoji(product.name)}
          color={colors.primary}
          size="sm"
          imageUri={resolveMediaUrl(product.image_url ?? product.image)}
        />
        <View style={styles.productInfo}>
          <View style={styles.nameRow}>
            <Text style={[styles.productName, unavailable && styles.unavailableText]} numberOfLines={1}>
              {product.name}
            </Text>
            {unavailable && (
              <View style={styles.soldOutBadge}>
                <Text style={styles.soldOutText}>Agotado</Text>
              </View>
            )}
          </View>
          {!!product.description && (
            <Text style={styles.productDesc} numberOfLines={1}>
              {product.description}
            </Text>
          )}
          <Text style={styles.productPrice}>{formatCurrency(product.price)}</Text>
        </View>
        <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
      </Pressable>
      <Switch
        value={product.is_available}
        onValueChange={(v) => onToggle(product, v)}
        trackColor={{ true: colors.primary, false: colors.border }}
        accessibilityLabel={`Disponibilidad de ${product.name}`}
      />
    </View>
  );
});

export default function RestaurantManageScreen() {
  const insets = useSafeAreaInsets();
  const [restaurant, setRestaurant] = useState<Restaurant | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editor, setEditor] = useState<ProductDraft | null>(null);

  const availableCount = products.filter((p) => p.is_available).length;

  const load = useCallback(async () => {
    const isRefresh = products.length > 0;
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
      setLoading(false);
      setRefreshing(false);
    }
  }, [products.length]);

  React.useEffect(() => {
    load();
  }, [load]);

  const toggleProduct = async (product: Product, available: boolean) => {
    try {
      const fd = new FormData();
      fd.append('is_available', available ? 'true' : 'false');
      await productApi.update(product.id, fd);
      setProducts((prev) =>
        prev.map((p) => (p.id === product.id ? { ...p, is_available: available } : p)),
      );
    } catch (err) {
      Alert.alert('Error', getApiErrorMessage(err));
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
      Alert.alert('Cerrar formulario', '¿Descartar el producto nuevo?', [
        { text: 'Seguir editando', style: 'cancel' },
        { text: 'Descartar', style: 'destructive', onPress: () => setEditor(null) },
      ]);
      return;
    }
    setEditor(null);
  }, [editor]);

  const pickImage = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Permiso', 'Necesitamos acceso a tus fotos.');
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
      Alert.alert('Producto', 'Nombre y precio son obligatorios.');
      return;
    }
    setSaving(true);
    try {
      const fd = new FormData();
      fd.append('name', editor.name.trim());
      fd.append('description', editor.description.trim());
      fd.append('price', editor.price.trim());
      fd.append('is_available', editor.is_available ? 'true' : 'false');
      if (editor.imageUri) {
        fd.append('image', {
          uri: editor.imageUri,
          name: 'product.jpg',
          type: 'image/jpeg',
        } as unknown as Blob);
      }
      if (editor.id) {
        await productApi.update(editor.id, fd);
      } else {
        fd.append('restaurant', String(restaurant.id));
        await productApi.create(fd);
      }
      setEditor(null);
      await load();
      Alert.alert('Listo', editor.id ? 'Producto actualizado' : 'Producto agregado');
    } catch (err) {
      Alert.alert('Error', getApiErrorMessage(err, 'No se pudo guardar el producto'));
    } finally {
      setSaving(false);
    }
  };

  const deleteProduct = () => {
    if (!editor?.id) return;
    Alert.alert('Eliminar producto', `¿Quitar "${editor.name}" del menú?`, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Eliminar',
        style: 'destructive',
        onPress: async () => {
          setDeleting(true);
          try {
            await productApi.delete(editor.id!);
            setEditor(null);
            await load();
            Alert.alert('Listo', 'Producto eliminado');
          } catch (err) {
            Alert.alert('Error', getApiErrorMessage(err, 'No se pudo eliminar el producto'));
          } finally {
            setDeleting(false);
          }
        },
      },
    ]);
  };

  if (loading) {
    return <ScreenContainer loading />;
  }

  const scrollPadding = {
    paddingHorizontal: spacing.screen,
    paddingBottom: insets.bottom + spacing.tabBar + spacing.xxl,
  };

  return (
    <ScreenContainer error={error} onRetry={load}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 88 : 0}
      >
        <ScrollView
          contentContainerStyle={scrollPadding}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={load}
              colors={[colors.primary]}
              tintColor={colors.primary}
            />
          }
        >
          <LinearGradient
            colors={[colors.gradientStart, colors.gradientEnd]}
            style={[styles.hero, { paddingTop: insets.top + spacing.md }]}
          >
            <View style={styles.heroRow}>
              <View style={styles.heroIcon}>
                <Ionicons name="restaurant" size={26} color="#FFF" />
              </View>
              <View style={styles.heroText}>
                <Text style={styles.heroTitle}>Tu menú</Text>
                <Text style={styles.heroSub} numberOfLines={1}>
                  {restaurant?.name ?? 'Restaurante'}
                </Text>
              </View>
              <Pressable style={styles.heroAddBtn} onPress={openNewProduct} hitSlop={HIT_SLOP}>
                <Ionicons name="add" size={22} color={colors.primary} />
              </Pressable>
            </View>
            <View style={styles.stats}>
              <View style={styles.statBox}>
                <Text style={styles.statNum}>{products.length}</Text>
                <Text style={styles.statLabel}>Platillos</Text>
              </View>
              <View style={styles.statBox}>
                <Text style={styles.statNum}>{availableCount}</Text>
                <Text style={styles.statLabel}>Disponibles</Text>
              </View>
            </View>
            <Text style={styles.heroHint}>
              Datos del local (foto, dirección) en la pestaña Perfil
            </Text>
          </LinearGradient>

          {products.length === 0 ? (
            <EmptyState
              emoji="🍽️"
              title="Sin platillos aún"
              subtitle="Agrega tu primer producto para que los clientes puedan pedir"
              actionLabel="Agregar primer platillo"
              onAction={openNewProduct}
            />
          ) : (
            <View style={styles.card}>
              <View style={styles.sectionRow}>
                <Text style={styles.section}>Platillos</Text>
                <Pressable style={styles.addBtn} onPress={openNewProduct} hitSlop={HIT_SLOP}>
                  <Ionicons name="add" size={20} color="#FFF" />
                  <Text style={styles.addText}>Agregar</Text>
                </Pressable>
              </View>
              {products.map((item) => (
                <ProductManageRow
                  key={item.id}
                  product={item}
                  onEdit={openEditProduct}
                  onToggle={toggleProduct}
                />
              ))}
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>

      <Modal visible={!!editor} animationType="slide" transparent onRequestClose={closeEditor}>
        <KeyboardAvoidingView
          style={styles.flex}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <View style={styles.modalOverlay}>
            <Pressable style={styles.modalBackdrop} onPress={closeEditor} />
            <View style={[styles.modal, { paddingBottom: insets.bottom + 12 }]}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>
                  {editor?.id ? 'Editar producto' : 'Nuevo producto'}
                </Text>
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
        </KeyboardAvoidingView>
      </Modal>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  hero: {
    marginHorizontal: -spacing.screen,
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.lg,
    marginBottom: spacing.lg,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
  },
  heroRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  heroIcon: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroText: { flex: 1 },
  heroTitle: { fontSize: 22, fontWeight: '800', color: '#FFF' },
  heroSub: { fontSize: 14, color: 'rgba(255,255,255,0.9)', marginTop: 2, fontWeight: '500' },
  heroAddBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#FFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stats: { flexDirection: 'row', gap: 12, marginTop: spacing.lg },
  statBox: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.18)',
    borderRadius: 14,
    padding: 14,
    alignItems: 'center',
  },
  statNum: { fontSize: 26, fontWeight: '800', color: '#FFF' },
  statLabel: { fontSize: 12, color: 'rgba(255,255,255,0.85)', fontWeight: '600', marginTop: 2 },
  heroHint: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.75)',
    marginTop: spacing.md,
    textAlign: 'center',
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: colors.border,
    ...cardShadow,
  },
  section: { fontSize: 16, fontWeight: '700', color: colors.text },
  sectionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.primary,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
    minHeight: 44,
  },
  addText: { color: '#FFF', fontWeight: '700', fontSize: 13 },
  productRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    minHeight: 72,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    gap: 8,
  },
  productRowUnavailable: { opacity: 0.72 },
  productMain: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12 },
  productInfo: { flex: 1, minWidth: 0 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  productName: { fontWeight: '700', color: colors.text, flexShrink: 1 },
  unavailableText: { color: colors.textSecondary },
  soldOutBadge: {
    backgroundColor: colors.error + '18',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  soldOutText: { fontSize: 10, fontWeight: '700', color: colors.error },
  productDesc: { fontSize: 12, color: colors.textSecondary, marginTop: 2 },
  productPrice: { color: colors.primary, fontWeight: '800', marginTop: 4 },
  modalOverlay: { flex: 1, justifyContent: 'flex-end' },
  modalBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  modal: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: 16,
    paddingHorizontal: 20,
    maxHeight: '92%',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  modalTitle: { fontSize: 18, fontWeight: '800', color: colors.text, flex: 1 },
  modalClose: { padding: 4 },
  modalScroll: { paddingBottom: 8 },
  photoBox: {
    height: 160,
    borderRadius: 14,
    overflow: 'hidden',
    marginBottom: spacing.md,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
  },
  photoImage: { width: '100%', height: '100%', resizeMode: 'cover' },
  photoPlaceholder: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8 },
  photoPlaceholderText: { color: colors.primary, fontWeight: '600' },
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
  modalActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  modalActionBtn: { flex: 1 },
  deleteBtn: { marginTop: 10 },
});
