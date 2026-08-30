import Ionicons from '@expo/vector-icons/Ionicons';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Image,
  Keyboard,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  SectionList,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native';
import { appAlert } from '../../utils/appAlert';
import { useResponsiveLayout } from '../../hooks/useResponsiveLayout';
import { useTabScreenInsets } from '../../hooks/useTabScreenInsets';

import Button from '../../components/Button';
import EmptyState from '../../components/EmptyState';
import FoodImage from '../../components/FoodImage';
import FormField from '../../components/FormField';
import KeyboardForm from '../../components/KeyboardForm';
import RestaurantHeroHeader from '../../components/restaurant/RestaurantHeroHeader';
import RestaurantPromotionsSection from '../../components/restaurant/RestaurantPromotionsSection';
import RestaurantSetupBanner from '../../components/RestaurantSetupBanner';
import ScreenContainer from '../../components/ScreenContainer';
import SearchField from '../../components/SearchField';
import { useRestaurantContext } from '../../context/RestaurantContext';
import { productApi, restaurantApi } from '../../services/api';
import { colors } from '../../theme/colors';
import { HIT_SLOP, spacing } from '../../theme/spacing';
import { cardShadow } from '../../theme/shadows';
import type { Product, Restaurant } from '../../types';
import { getApiErrorMessage } from '../../utils/apiErrors';
import {
  formatCurrency,
  normalizeForSearch,
  parseExtraPriceInput,
  parsePriceInput,
} from '../../utils/format';
import { getProductEmoji } from '../../utils/foodVisuals';
import { appendImage, pickProductImage } from '../../utils/imagePicker';
import { resolveMediaUrl } from '../../utils/media';
import {
  groupProductsForManageCatalog,
  manageCategoryLabel,
  normalizeProductCategory,
  PRODUCT_CATEGORIES,
  resolveManageCategory,
  sortProductsByCategory,
  type ManageCategoryKey,
  type ProductCategoryKey,
} from '../../utils/productCategories';
import { FLATLIST_TUNING } from '../../utils/responsive';

type AvailabilityFilter = 'all' | 'available' | 'hidden';

interface OptionDraft {
  name: string;
  price_delta: string;
}

interface GroupDraft {
  name: string;
  /** true = el cliente debe elegir al menos 1 */
  required: boolean;
  /** true = puede elegir varias */
  multiple: boolean;
  options: OptionDraft[];
}

interface ProductDraft {
  id?: number;
  name: string;
  description: string;
  category: ProductCategoryKey;
  price: string;
  is_available: boolean;
  imageUri?: string | null;
  image_url?: string | null;
  optionGroups: GroupDraft[];
}

type CatalogSection = {
  key: ManageCategoryKey;
  title: string;
  emoji: string;
  data: Product[];
};

function groupsFromProduct(product: Product): GroupDraft[] {
  return (product.option_groups ?? []).map((g) => ({
    name: g.name,
    required: g.min_select > 0,
    multiple: g.max_select > 1,
    options: g.options.map((o) => ({
      name: o.name,
      price_delta: o.price_delta,
    })),
  }));
}

function buildGroupsPayload(optionGroups: GroupDraft[]) {
  return optionGroups
    .filter((g) => g.name.trim() && g.options.some((o) => o.name.trim()))
    .map((g) => {
      const options = g.options
        .filter((o) => o.name.trim())
        .map((o) => ({
          name: o.name.trim(),
          price_delta: (parseExtraPriceInput(o.price_delta) ?? 0).toFixed(2),
        }));
      return {
        name: g.name.trim(),
        min_select: g.required ? 1 : 0,
        max_select: g.multiple ? Math.max(options.length, 1) : 1,
        options,
      };
    });
}

function validateOptionDrafts(optionGroups: GroupDraft[]): string | null {
  const seenNames = new Set<string>();
  for (const group of optionGroups) {
    const groupName = group.name.trim();
    const namedOptions = group.options.filter((o) => o.name.trim());
    const hasPartialOptions = group.options.some((o) => o.name.trim() || o.price_delta.trim());

    if (!groupName && namedOptions.length === 0 && !hasPartialOptions) {
      continue;
    }
    if (!groupName) {
      return 'Cada grupo de opciones necesita un nombre.';
    }
    if (namedOptions.length === 0) {
      return `El grupo «${groupName}» necesita al menos una opción.`;
    }
    const key = normalizeForSearch(groupName);
    if (seenNames.has(key)) {
      return `Hay grupos duplicados: «${groupName}».`;
    }
    seenNames.add(key);

    const optionNames = new Set<string>();
    for (const opt of group.options) {
      const optName = opt.name.trim();
      if (!optName) {
        if (opt.price_delta.trim()) {
          return `Hay una opción sin nombre en «${groupName}».`;
        }
        continue;
      }
      const optKey = normalizeForSearch(optName);
      if (optionNames.has(optKey)) {
        return `Opción duplicada «${optName}» en «${groupName}».`;
      }
      optionNames.add(optKey);
      if (parseExtraPriceInput(opt.price_delta) === null) {
        return `Precio extra inválido en «${optName}». Usa 0 o un monto positivo.`;
      }
    }
  }
  return null;
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
        accessibilityRole="button"
        accessibilityLabel={`Editar ${product.name}`}
      >
        <FoodImage
          emoji={getProductEmoji(product.name)}
          color={colors.primary}
          size="sm"
          imageUri={resolveMediaUrl(product.image_url ?? product.image)}
        />
        <View style={styles.productInfo}>
          <Text
            style={[styles.productName, unavailable && styles.unavailableText]}
            numberOfLines={2}
            ellipsizeMode="tail"
          >
            {product.name}
          </Text>
          <View style={styles.metaRow}>
            <Text style={styles.productPrice}>{formatCurrency(product.price)}</Text>
            <Text style={styles.metaDot}>·</Text>
            <Text style={styles.productCategory} numberOfLines={1}>
              {manageCategoryLabel(product.category, product.category_display)}
            </Text>
          </View>
          <View
            style={[styles.statusBadge, unavailable ? styles.hiddenBadge : styles.availableBadge]}
          >
            <Text style={[styles.statusText, unavailable ? styles.hiddenText : styles.availableText]}>
              {unavailable ? 'Oculto' : 'Disponible'}
            </Text>
          </View>
        </View>
      </Pressable>
      <View style={styles.productActions} pointerEvents="box-none">
        <Pressable
          onPress={handleEdit}
          hitSlop={HIT_SLOP}
          style={styles.editIconBtn}
          accessibilityLabel={`Editar ${product.name}`}
        >
          <Ionicons name="create-outline" size={20} color={colors.textMuted} />
        </Pressable>
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
  const { insets, tabBottomPadding } = useTabScreenInsets();
  const {
    restaurant: ctxRestaurant,
    refresh: refreshRestaurant,
    canSwitch,
    openSwitcher,
  } = useRestaurantContext();
  const [restaurant, setRestaurant] = useState<Restaurant | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editor, setEditor] = useState<ProductDraft | null>(null);
  const [togglingId, setTogglingId] = useState<number | null>(null);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<ManageCategoryKey | 'all'>('all');
  const [availabilityFilter, setAvailabilityFilter] = useState<AvailabilityFilter>('all');
  const [collapsedSections, setCollapsedSections] = useState<Set<ManageCategoryKey>>(
    () => new Set(),
  );
  const hasLoadedRef = useRef(false);
  const savingRef = useRef(false);
  const togglingIdRef = useRef<number | null>(null);

  const load = useCallback(async () => {
    const isRefresh = hasLoadedRef.current;
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError(null);
    try {
      const { data } = await restaurantApi.mine();
      setRestaurant(data);
      setProducts(sortProductsByCategory(data.products ?? []));
    } catch (err) {
      setError(getApiErrorMessage(err, 'No se pudo cargar tu menú'));
    } finally {
      hasLoadedRef.current = true;
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load, ctxRestaurant?.id]);

  const toggleProduct = useCallback(async (product: Product, available: boolean) => {
    if (togglingIdRef.current === product.id) return;
    togglingIdRef.current = product.id;
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
      togglingIdRef.current = null;
      setTogglingId(null);
    }
  }, [refreshRestaurant]);

  const openNewProduct = useCallback(() => {
    setConfirmDelete(false);
    setConfirmDiscard(false);
    setEditor({
      name: '',
      description: '',
      category: 'comida',
      price: '',
      is_available: true,
      imageUri: null,
      optionGroups: [],
    });
  }, []);

  const openEditProduct = useCallback((product: Product) => {
    setConfirmDelete(false);
    setConfirmDiscard(false);
    setEditor({
      id: product.id,
      name: product.name,
      description: product.description,
      category: normalizeProductCategory(product.category),
      price: product.price,
      is_available: product.is_available,
      image_url: product.image_url,
      imageUri: null,
      optionGroups: groupsFromProduct(product),
    });
  }, []);

  const closeEditor = useCallback(() => {
    Keyboard.dismiss();
    if (!editor || savingRef.current) return;

    const isNewDraft =
      !editor.id &&
      (editor.name.trim() ||
        editor.description.trim() ||
        editor.price.trim() ||
        editor.imageUri);

    if (isNewDraft) {
      setConfirmDiscard(true);
      setConfirmDelete(false);
      return;
    }
    setConfirmDelete(false);
    setConfirmDiscard(false);
    setEditor(null);
  }, [editor]);

  const pickImage = async () => {
    try {
      const uri = await pickProductImage();
      if (uri && editor) {
        setEditor({ ...editor, imageUri: uri });
      }
    } catch {
      appAlert('Imagen', 'No se pudo cargar la foto. Intenta con otra imagen.');
    }
  };

  const upsertLocalProduct = useCallback((saved: Product) => {
    setProducts((prev) => {
      const others = prev.filter((p) => p.id !== saved.id);
      return sortProductsByCategory([...others, saved]);
    });
  }, []);

  const saveProduct = async () => {
    if (!restaurant || !editor || savingRef.current) return;
    if (!editor.name.trim() || !editor.price.trim()) {
      appAlert('Producto', 'Nombre y precio son obligatorios.');
      return;
    }
    const parsedPrice = parsePriceInput(editor.price);
    if (parsedPrice === null) {
      appAlert('Producto', 'Indica un precio válido mayor a cero (ej. 85.00).');
      return;
    }
    const optionsError = validateOptionDrafts(editor.optionGroups);
    if (optionsError) {
      appAlert('Opciones', optionsError);
      return;
    }

    const wasEdit = !!editor.id;
    const groupsPayload = buildGroupsPayload(editor.optionGroups);
    savingRef.current = true;
    setSaving(true);
    let saved: Product | null = null;
    try {
      const fd = new FormData();
      fd.append('name', editor.name.trim());
      fd.append('description', editor.description.trim());
      fd.append('category', editor.category);
      fd.append('price', parsedPrice.toFixed(2));
      fd.append('is_available', editor.is_available ? 'true' : 'false');
      if (editor.imageUri) {
        try {
          await appendImage(fd, 'image', editor.imageUri, 'product.jpg');
        } catch {
          appAlert('Imagen', 'No se pudo preparar la foto. Intenta elegirla de nuevo.');
          return;
        }
      }

      if (editor.id) {
        const { data } = await productApi.update(editor.id, fd);
        saved = data;
      } else {
        fd.append('restaurant', String(restaurant.id));
        const { data } = await productApi.create(fd);
        saved = data;
      }

      // Conservar id para reintentar opciones sin duplicar el producto.
      setEditor((e) =>
        e
          ? {
              ...e,
              id: saved!.id,
              image_url: saved!.image_url,
              imageUri: null,
              name: saved!.name,
              description: saved!.description,
              category: normalizeProductCategory(saved!.category),
              price: saved!.price,
              is_available: saved!.is_available,
            }
          : e,
      );
      upsertLocalProduct({
        ...saved,
        option_groups: saved.option_groups ?? [],
      });

      try {
        const { data: withOptions } = await productApi.replaceOptionGroups(
          saved.id,
          groupsPayload,
        );
        upsertLocalProduct(withOptions);
        setConfirmDelete(false);
        setConfirmDiscard(false);
        setEditor(null);
        await refreshRestaurant();
        appAlert('Listo', wasEdit ? 'Producto actualizado' : 'Producto agregado');
      } catch (optErr) {
        await refreshRestaurant();
        appAlert(
          'Opciones',
          `${getApiErrorMessage(optErr, 'No se pudieron guardar los sabores/extras.')}\n\nEl producto sí se guardó. Puedes corregir las opciones y pulsar Guardar de nuevo.`,
        );
      }
    } catch (err) {
      appAlert('Error', getApiErrorMessage(err, 'No se pudo guardar el producto'));
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  };

  const deleteProduct = () => {
    if (!editor?.id || deleting || savingRef.current) return;
    setConfirmDelete(true);
    setConfirmDiscard(false);
  };

  const confirmDeleteProduct = async () => {
    if (!editor?.id || deleting) return;
    setDeleting(true);
    try {
      await productApi.delete(editor.id);
      setProducts((prev) => prev.filter((p) => p.id !== editor.id));
      setConfirmDelete(false);
      setConfirmDiscard(false);
      setEditor(null);
      await refreshRestaurant();
      appAlert('Listo', 'Producto eliminado');
    } catch (err) {
      appAlert('Error', getApiErrorMessage(err, 'No se pudo eliminar el producto'));
    } finally {
      setDeleting(false);
    }
  };

  const clearFilters = useCallback(() => {
    setSearch('');
    setCategoryFilter('all');
    setAvailabilityFilter('all');
  }, []);

  const hasActiveFilters =
    search.trim().length > 0 || categoryFilter !== 'all' || availabilityFilter !== 'all';

  const filteredProducts = useMemo(() => {
    const q = normalizeForSearch(search);
    return products.filter((product) => {
      if (availabilityFilter === 'available' && !product.is_available) return false;
      if (availabilityFilter === 'hidden' && product.is_available) return false;
      if (categoryFilter !== 'all' && resolveManageCategory(product.category) !== categoryFilter) {
        return false;
      }
      if (q && !normalizeForSearch(product.name).includes(q)) return false;
      return true;
    });
  }, [availabilityFilter, categoryFilter, products, search]);

  const sections = useMemo((): CatalogSection[] => {
    return groupProductsForManageCatalog(filteredProducts).map((section) => ({
      ...section,
      data: collapsedSections.has(section.key) ? [] : section.data,
    }));
  }, [collapsedSections, filteredProducts]);

  const sectionCounts = useMemo(() => {
    const map = new Map<ManageCategoryKey, number>();
    for (const section of groupProductsForManageCatalog(filteredProducts)) {
      map.set(section.key, section.data.length);
    }
    return map;
  }, [filteredProducts]);

  const availableCategoryKeys = useMemo(() => {
    const keys = new Set<ManageCategoryKey>();
    for (const product of products) {
      keys.add(resolveManageCategory(product.category));
    }
    return keys;
  }, [products]);

  const availableCount = useMemo(
    () => products.filter((p) => p.is_available).length,
    [products],
  );
  const hiddenCount = products.length - availableCount;

  const toggleSection = useCallback((key: ManageCategoryKey) => {
    setCollapsedSections((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }, []);

  const renderItem = useCallback(
    ({ item }: { item: Product }) => (
      <ProductManageRow
        product={item}
        onEdit={openEditProduct}
        onToggle={toggleProduct}
        toggling={togglingId === item.id}
      />
    ),
    [openEditProduct, toggleProduct, togglingId],
  );

  const renderSectionHeader = useCallback(
    ({ section }: { section: CatalogSection }) => {
      const count = sectionCounts.get(section.key) ?? section.data.length;
      const collapsed = collapsedSections.has(section.key);
      return (
        <Pressable
          style={styles.sectionHeader}
          onPress={() => toggleSection(section.key)}
          accessibilityRole="button"
          accessibilityState={{ expanded: !collapsed }}
          accessibilityLabel={`${section.title}, ${count} productos`}
        >
          <View style={styles.sectionHeaderLeft}>
            <Text style={styles.sectionEmoji}>{section.emoji}</Text>
            <Text style={styles.sectionHeaderTitle}>{section.title}</Text>
            <View style={styles.sectionCountBadge}>
              <Text style={styles.sectionCountText}>{count}</Text>
            </View>
          </View>
          <Ionicons
            name={collapsed ? 'chevron-forward' : 'chevron-down'}
            size={18}
            color={colors.textMuted}
          />
        </Pressable>
      );
    },
    [collapsedSections, sectionCounts, toggleSection],
  );

  const listHeader = useMemo(
    () => (
      <View>
        <RestaurantHeroHeader
          restaurant={restaurant}
          topInset={insets.top}
          eyebrow="Menú"
          title={restaurant?.name}
          subtitle="Administra platillos, precios y disponibilidad"
          actionIcon="add"
          actionLabel="Agregar producto"
          onActionPress={openNewProduct}
          canSwitch={canSwitch}
          onTitlePress={openSwitcher}
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
          <View style={styles.catalogToolbar}>
            <View style={styles.catalogTitleRow}>
              <View style={styles.sectionCopy}>
                <Text style={styles.sectionTitle}>Catálogo</Text>
                <Text style={styles.sectionSub}>
                  {products.length} producto{products.length === 1 ? '' : 's'}
                  {hasActiveFilters
                    ? ` · ${filteredProducts.length} visible${filteredProducts.length === 1 ? '' : 's'}`
                    : ''}
                </Text>
              </View>
              <Pressable style={styles.addBtn} onPress={openNewProduct} hitSlop={HIT_SLOP}>
                <Ionicons name="add" size={20} color="#FFF" />
                <Text style={styles.addText}>Nuevo producto</Text>
              </Pressable>
            </View>

            <SearchField
              value={search}
              onChangeText={setSearch}
              placeholder="Buscar por nombre…"
              onClear={() => setSearch('')}
            />

            <Text style={styles.filterLabel}>Categoría</Text>
            <View style={styles.chipWrap}>
              <Pressable
                style={[styles.filterChip, categoryFilter === 'all' && styles.filterChipActive]}
                onPress={() => setCategoryFilter('all')}
              >
                <Text
                  style={[
                    styles.filterChipText,
                    categoryFilter === 'all' && styles.filterChipTextActive,
                  ]}
                >
                  Todas
                </Text>
              </Pressable>
              {PRODUCT_CATEGORIES.filter((c) => availableCategoryKeys.has(c.key)).map((cat) => (
                <Pressable
                  key={cat.key}
                  style={[
                    styles.filterChip,
                    categoryFilter === cat.key && styles.filterChipActive,
                  ]}
                  onPress={() => setCategoryFilter(cat.key)}
                >
                  <Text
                    style={[
                      styles.filterChipText,
                      categoryFilter === cat.key && styles.filterChipTextActive,
                    ]}
                  >
                    {cat.emoji} {cat.label}
                  </Text>
                </Pressable>
              ))}
              {availableCategoryKeys.has('unknown') ? (
                <Pressable
                  style={[
                    styles.filterChip,
                    categoryFilter === 'unknown' && styles.filterChipActive,
                  ]}
                  onPress={() => setCategoryFilter('unknown')}
                >
                  <Text
                    style={[
                      styles.filterChipText,
                      categoryFilter === 'unknown' && styles.filterChipTextActive,
                    ]}
                  >
                    📦 Sin categoría
                  </Text>
                </Pressable>
              ) : null}
            </View>

            <Text style={styles.filterLabel}>Disponibilidad</Text>
            <View style={styles.chipWrap}>
              {(
                [
                  { key: 'all', label: 'Todos', count: products.length },
                  { key: 'available', label: 'Disponibles', count: availableCount },
                  { key: 'hidden', label: 'Ocultos', count: hiddenCount },
                ] as const
              ).map((opt) => {
                const active = availabilityFilter === opt.key;
                return (
                  <Pressable
                    key={opt.key}
                    style={[styles.filterChip, active && styles.filterChipActive]}
                    onPress={() => setAvailabilityFilter(opt.key)}
                  >
                    <Text
                      style={[styles.filterChipText, active && styles.filterChipTextActive]}
                    >
                      {opt.label}
                    </Text>
                    <View style={[styles.filterBadge, active && styles.filterBadgeActive]}>
                      <Text
                        style={[
                          styles.filterBadgeText,
                          active && styles.filterBadgeTextActive,
                        ]}
                      >
                        {opt.count}
                      </Text>
                    </View>
                  </Pressable>
                );
              })}
            </View>
          </View>
        )}
      </View>
    ),
    [
      availabilityFilter,
      availableCategoryKeys,
      availableCount,
      categoryFilter,
      filteredProducts.length,
      hasActiveFilters,
      hiddenCount,
      insets.top,
      openNewProduct,
      products.length,
      restaurant,
      search,
      canSwitch,
      openSwitcher,
    ],
  );

  const listEmpty = useMemo(() => {
    if (products.length === 0 || filteredProducts.length > 0) return null;
    return (
      <View style={styles.emptyFilters}>
        <Text style={styles.emptyFiltersTitle}>Sin resultados</Text>
        <Text style={styles.emptyFiltersSub}>
          Ningún producto coincide con la búsqueda o los filtros.
        </Text>
        <Button title="Limpiar filtros" variant="secondary" onPress={clearFilters} />
      </View>
    );
  }, [clearFilters, filteredProducts.length, products.length]);

  const listFooter = useMemo(
    () => (
      <RestaurantPromotionsSection
        products={products}
        restaurantId={restaurant?.id}
        onChanged={() => {
          void load();
          void refreshRestaurant();
        }}
      />
    ),
    [load, products, refreshRestaurant, restaurant?.id],
  );

  if (loading) {
    return <ScreenContainer loading />;
  }

  return (
    <ScreenContainer error={error} onRetry={load}>
      <SectionList
        sections={products.length === 0 ? [] : sections}
        keyExtractor={(item) => String(item.id)}
        renderItem={renderItem}
        renderSectionHeader={products.length === 0 ? undefined : renderSectionHeader}
        stickySectionHeadersEnabled={false}
        ListHeaderComponent={listHeader}
        ListEmptyComponent={
          products.length > 0 && filteredProducts.length === 0 ? listEmpty : null
        }
        ListFooterComponent={listFooter}
        contentContainerStyle={[
          styles.listContent,
          { paddingBottom: tabBottomPadding(spacing.xxl) },
        ]}
        style={styles.list}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
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
        initialNumToRender={FLATLIST_TUNING.initialNumToRender}
        maxToRenderPerBatch={FLATLIST_TUNING.maxToRenderPerBatch}
        windowSize={FLATLIST_TUNING.windowSize}
        removeClippedSubviews={FLATLIST_TUNING.removeClippedSubviews}
      />

      <Modal visible={!!editor} animationType="slide" transparent onRequestClose={closeEditor}>
        <View style={styles.flex}>
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
                <View style={styles.modalHeaderCopy}>
                  <Text style={styles.modalEyebrow}>
                    {editor?.id ? 'Editar platillo' : 'Nuevo platillo'}
                  </Text>
                  <Text style={styles.modalTitle} numberOfLines={2}>
                    {editor?.id ? editor.name || 'Producto' : 'Agregar al menú'}
                  </Text>
                </View>
                <Pressable
                  onPress={closeEditor}
                  hitSlop={HIT_SLOP}
                  style={styles.modalClose}
                  accessibilityLabel="Cerrar"
                  disabled={saving}
                >
                  <Ionicons name="close" size={26} color={colors.textSecondary} />
                </Pressable>
              </View>

              <KeyboardForm
                fill={false}
                style={styles.modalBody}
                contentContainerStyle={styles.modalScroll}
                bottomPadding={8}
                keyboardVerticalOffset={0}
                footer={
                  <View style={styles.modalFooter}>
                    {confirmDiscard ? (
                      <View style={styles.confirmBox}>
                        <Text style={styles.confirmTitle}>¿Descartar el producto nuevo?</Text>
                        <Text style={styles.confirmSub}>Se perderán los datos del formulario.</Text>
                        <View style={styles.modalActions}>
                          <Button
                            title="Seguir editando"
                            variant="secondary"
                            onPress={() => setConfirmDiscard(false)}
                            style={styles.modalActionBtn}
                          />
                          <Button
                            title="Descartar"
                            variant="danger"
                            onPress={() => {
                              setConfirmDiscard(false);
                              setConfirmDelete(false);
                              setEditor(null);
                            }}
                            style={styles.modalActionBtn}
                          />
                        </View>
                      </View>
                    ) : confirmDelete ? (
                      <View style={styles.confirmBox}>
                        <Text style={styles.confirmTitle}>¿Eliminar producto?</Text>
                        <Text style={styles.confirmSub}>
                          {`Se quitará "${editor?.name || 'este producto'}" del menú.`}
                        </Text>
                        <View style={styles.modalActions}>
                          <Button
                            title="Cancelar"
                            variant="secondary"
                            onPress={() => setConfirmDelete(false)}
                            disabled={deleting}
                            style={styles.modalActionBtn}
                          />
                          <Button
                            title="Sí, eliminar"
                            variant="danger"
                            onPress={() => {
                              void confirmDeleteProduct();
                            }}
                            loading={deleting}
                            style={styles.modalActionBtn}
                          />
                        </View>
                      </View>
                    ) : (
                      <>
                        <View style={styles.modalActions}>
                          <Button
                            title="Cancelar"
                            variant="secondary"
                            onPress={closeEditor}
                            disabled={saving}
                            style={styles.modalActionBtn}
                          />
                          <Button
                            title="Guardar"
                            onPress={() => {
                              void saveProduct();
                            }}
                            loading={saving}
                            style={styles.modalActionBtn}
                          />
                        </View>
                        {editor?.id ? (
                          <Button
                            title="Eliminar producto"
                            variant="danger"
                            onPress={deleteProduct}
                            loading={deleting}
                            disabled={saving}
                            style={styles.deleteBtn}
                          />
                        ) : null}
                      </>
                    )}
                  </View>
                }
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
                      <Text style={styles.photoHint}>Toca para elegir y recortar</Text>
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
                <Text style={styles.categoryLabel}>Categoría del menú</Text>
                <View style={styles.categoryChips}>
                  {PRODUCT_CATEGORIES.map((cat) => {
                    const active = (editor?.category ?? 'comida') === cat.key;
                    return (
                      <Pressable
                        key={cat.key}
                        style={[styles.categoryChip, active && styles.categoryChipActive]}
                        onPress={() =>
                          setEditor((e) => (e ? { ...e, category: cat.key } : e))
                        }
                      >
                        <Text
                          style={[
                            styles.categoryChipText,
                            active && styles.categoryChipTextActive,
                          ]}
                        >
                          {cat.emoji} {cat.label}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
                <FormField
                  label="Descripción"
                  value={editor?.description ?? ''}
                  onChangeText={(v) => setEditor((e) => (e ? { ...e, description: v } : e))}
                  icon="text-outline"
                  embedded
                  multiline
                  placeholder="Ingredientes, porción, etc."
                />

                <View style={styles.optionsBlock}>
                  <Text style={styles.optionsTitle}>Sabores / extras</Text>
                  <Text style={styles.optionsHint}>
                    El cliente elige al pedir. Puedes poner precio extra por opción.
                  </Text>
                  {(editor?.optionGroups ?? []).map((group, gIdx) => (
                    <View key={`g-${gIdx}`} style={styles.groupCard}>
                      <FormField
                        label="Nombre del grupo"
                        value={group.name}
                        onChangeText={(v) =>
                          setEditor((e) => {
                            if (!e) return e;
                            const optionGroups = [...e.optionGroups];
                            optionGroups[gIdx] = { ...optionGroups[gIdx], name: v };
                            return { ...e, optionGroups };
                          })
                        }
                        icon="list-outline"
                        embedded
                        placeholder="Ej. Sabor, Toppings"
                      />
                      <View style={styles.groupToggles}>
                        <Pressable
                          style={styles.toggleChip}
                          onPress={() =>
                            setEditor((e) => {
                              if (!e) return e;
                              const optionGroups = [...e.optionGroups];
                              optionGroups[gIdx] = {
                                ...optionGroups[gIdx],
                                required: !optionGroups[gIdx].required,
                              };
                              return { ...e, optionGroups };
                            })
                          }
                        >
                          <Ionicons
                            name={group.required ? 'checkbox' : 'square-outline'}
                            size={18}
                            color={colors.primary}
                          />
                          <Text style={styles.toggleChipText}>Obligatorio</Text>
                        </Pressable>
                        <Pressable
                          style={styles.toggleChip}
                          onPress={() =>
                            setEditor((e) => {
                              if (!e) return e;
                              const optionGroups = [...e.optionGroups];
                              optionGroups[gIdx] = {
                                ...optionGroups[gIdx],
                                multiple: !optionGroups[gIdx].multiple,
                              };
                              return { ...e, optionGroups };
                            })
                          }
                        >
                          <Ionicons
                            name={group.multiple ? 'checkbox' : 'square-outline'}
                            size={18}
                            color={colors.primary}
                          />
                          <Text style={styles.toggleChipText}>Varias opciones</Text>
                        </Pressable>
                      </View>
                      {group.options.map((opt, oIdx) => (
                        <View key={`o-${gIdx}-${oIdx}`} style={styles.optionEditRow}>
                          <View style={styles.optionNameField}>
                            <FormField
                              label={oIdx === 0 ? 'Opción' : undefined}
                              hideLabel={oIdx > 0}
                              value={opt.name}
                              onChangeText={(v) =>
                                setEditor((e) => {
                                  if (!e) return e;
                                  const optionGroups = [...e.optionGroups];
                                  const options = [...optionGroups[gIdx].options];
                                  options[oIdx] = { ...options[oIdx], name: v };
                                  optionGroups[gIdx] = { ...optionGroups[gIdx], options };
                                  return { ...e, optionGroups };
                                })
                              }
                              icon="ellipse-outline"
                              embedded
                              placeholder="Ej. Pastor"
                            />
                          </View>
                          <View style={styles.optionPriceField}>
                            <FormField
                              label={oIdx === 0 ? 'Extra $' : undefined}
                              hideLabel={oIdx > 0}
                              value={opt.price_delta}
                              onChangeText={(v) =>
                                setEditor((e) => {
                                  if (!e) return e;
                                  const optionGroups = [...e.optionGroups];
                                  const options = [...optionGroups[gIdx].options];
                                  options[oIdx] = { ...options[oIdx], price_delta: v };
                                  optionGroups[gIdx] = { ...optionGroups[gIdx], options };
                                  return { ...e, optionGroups };
                                })
                              }
                              icon="cash-outline"
                              embedded
                              placeholder="0"
                              keyboardType="decimal-pad"
                            />
                          </View>
                        </View>
                      ))}
                      <View style={styles.groupActions}>
                        <Button
                          title="Agregar opción"
                          variant="ghost"
                          onPress={() =>
                            setEditor((e) => {
                              if (!e) return e;
                              const optionGroups = [...e.optionGroups];
                              optionGroups[gIdx] = {
                                ...optionGroups[gIdx],
                                options: [
                                  ...optionGroups[gIdx].options,
                                  { name: '', price_delta: '0' },
                                ],
                              };
                              return { ...e, optionGroups };
                            })
                          }
                          style={styles.groupActionBtn}
                        />
                        <Button
                          title="Quitar grupo"
                          variant="ghost"
                          onPress={() =>
                            setEditor((e) =>
                              e
                                ? {
                                    ...e,
                                    optionGroups: e.optionGroups.filter((_, i) => i !== gIdx),
                                  }
                                : e,
                            )
                          }
                          style={styles.groupActionBtn}
                        />
                      </View>
                    </View>
                  ))}
                  <Button
                    title="Agregar grupo (sabor / toppings)"
                    variant="secondary"
                    onPress={() =>
                      setEditor((e) =>
                        e
                          ? {
                              ...e,
                              optionGroups: [
                                ...e.optionGroups,
                                {
                                  name: '',
                                  required: true,
                                  multiple: false,
                                  options: [
                                    { name: '', price_delta: '0' },
                                    { name: '', price_delta: '0' },
                                  ],
                                },
                              ],
                            }
                          : e,
                      )
                    }
                  />
                </View>

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
              </KeyboardForm>
            </View>
          </View>
        </View>
      </Modal>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  list: { flex: 1 },
  listContent: {
    paddingHorizontal: spacing.screen,
    flexGrow: 1,
  },
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
  catalogToolbar: {
    backgroundColor: colors.surface,
    borderRadius: 22,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.borderLight,
    marginBottom: spacing.md,
    gap: spacing.sm,
    ...cardShadow,
  },
  catalogTitleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 12,
    marginBottom: spacing.xs,
  },
  sectionCopy: { flex: 1, minWidth: 0 },
  sectionTitle: { fontSize: 18, fontWeight: '800', color: colors.text, letterSpacing: -0.2 },
  sectionSub: { fontSize: 12, color: colors.textSecondary, marginTop: 2, lineHeight: 17 },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.primary,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    minHeight: 44,
    flexShrink: 1,
    maxWidth: '48%',
  },
  addText: { color: '#FFF', fontWeight: '700', fontSize: 13, flexShrink: 1 },
  filterLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    marginTop: 4,
  },
  chipWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    minHeight: 40,
    borderRadius: 14,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  filterChipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  filterChipText: { fontSize: 13, fontWeight: '700', color: colors.textSecondary },
  filterChipTextActive: { color: '#FFF' },
  filterBadge: {
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 5,
  },
  filterBadgeActive: { backgroundColor: 'rgba(255,255,255,0.25)' },
  filterBadgeText: { fontSize: 11, fontWeight: '800', color: colors.primaryDark },
  filterBadgeTextActive: { color: '#FFF' },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.background,
    paddingVertical: 10,
    paddingHorizontal: 4,
    marginTop: 4,
  },
  sectionHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
    minWidth: 0,
  },
  sectionEmoji: { fontSize: 16 },
  sectionHeaderTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: colors.text,
    flexShrink: 1,
  },
  sectionCountBadge: {
    minWidth: 22,
    height: 22,
    borderRadius: 11,
    paddingHorizontal: 6,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionCountText: { fontSize: 12, fontWeight: '800', color: colors.textSecondary },
  productCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: 4,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
    backgroundColor: colors.surface,
  },
  productCardUnavailable: { opacity: 0.72 },
  productCardPressed: { opacity: 0.92 },
  productMain: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    minWidth: 0,
  },
  productInfo: { flex: 1, minWidth: 0, gap: 4 },
  productActions: {
    flexDirection: 'row',
    alignItems: 'center',
    flexShrink: 0,
    gap: 2,
  },
  editIconBtn: {
    minWidth: 40,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 0,
  },
  productName: {
    fontWeight: '800',
    fontSize: 14,
    color: colors.text,
    lineHeight: 19,
  },
  unavailableText: { color: colors.textSecondary },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 4,
    minWidth: 0,
  },
  metaDot: { color: colors.textMuted, fontSize: 12 },
  productCategory: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
    flexShrink: 1,
  },
  productPrice: { color: colors.primary, fontWeight: '800', fontSize: 14 },
  statusBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  availableBadge: {
    backgroundColor: colors.success + '18',
  },
  hiddenBadge: {
    backgroundColor: colors.error + '18',
  },
  statusText: { fontSize: 11, fontWeight: '700' },
  availableText: { color: colors.success },
  hiddenText: { color: colors.error },
  emptyFilters: {
    alignItems: 'center',
    paddingVertical: spacing.xl,
    paddingHorizontal: spacing.md,
    gap: 10,
    backgroundColor: colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.borderLight,
    marginBottom: spacing.md,
  },
  emptyFiltersTitle: { fontSize: 16, fontWeight: '800', color: colors.text },
  emptyFiltersSub: {
    fontSize: 13,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 4,
  },
  categoryLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.textSecondary,
    marginBottom: 8,
    marginTop: 4,
  },
  categoryChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: spacing.md,
  },
  categoryChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 16,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  categoryChipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  categoryChipText: { fontSize: 13, fontWeight: '700', color: colors.textSecondary },
  categoryChipTextActive: { color: '#FFF' },
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
  modalHeaderCopy: { flex: 1, minWidth: 0, paddingRight: 8 },
  modalEyebrow: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  modalTitle: { fontSize: 20, fontWeight: '800', color: colors.text, marginTop: 2 },
  modalClose: {
    minWidth: 44,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 0,
  },
  modalScroll: { paddingBottom: 24 },
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
  optionsBlock: { marginTop: spacing.md, gap: spacing.sm },
  optionsTitle: { fontSize: 15, fontWeight: '800', color: colors.text },
  optionsHint: { fontSize: 12, color: colors.textSecondary, lineHeight: 17, marginBottom: 4 },
  groupCard: {
    backgroundColor: colors.background,
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: colors.borderLight,
    gap: 4,
    marginBottom: 8,
  },
  groupToggles: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 6 },
  toggleChip: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  toggleChipText: { fontSize: 13, fontWeight: '600', color: colors.text },
  optionEditRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, alignItems: 'flex-start' },
  optionNameField: { flex: 1.4, flexBasis: '45%', minWidth: 0 },
  optionPriceField: { flex: 1, flexBasis: '40%', minWidth: 0 },
  groupActions: { flexDirection: 'row', gap: 8, marginTop: 4 },
  groupActionBtn: { flex: 1 },
  modalFooter: {
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.borderLight,
    gap: 10,
  },
  modalActions: {
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: 10,
  },
  modalActionBtn: { flex: 1, minWidth: 0, height: 50 },
  deleteBtn: { alignSelf: 'stretch', height: 50 },
  confirmBox: {
    backgroundColor: colors.background,
    borderRadius: 14,
    padding: 12,
    gap: 10,
    borderWidth: 1,
    borderColor: colors.border,
  },
  confirmTitle: {
    fontSize: 16,
    fontWeight: '900',
    color: colors.text,
    textAlign: 'center',
  },
  confirmSub: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 18,
  },
});
