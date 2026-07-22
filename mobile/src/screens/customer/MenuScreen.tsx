import Ionicons from '@expo/vector-icons/Ionicons';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, SectionList, StyleSheet, Text, View } from 'react-native';
import { appAlert } from '../../utils/appAlert';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import ListSkeleton from '../../components/ListSkeleton';
import EmptyState from '../../components/EmptyState';
import FloatingCartBar from '../../components/FloatingCartBar';
import ListFooter from '../../components/ListFooter';
import ProductCard from '../../components/ProductCard';
import ScreenContainer from '../../components/ScreenContainer';
import { useAuth } from '../../context/AuthContext';
import { useCart } from '../../context/CartContext';
import { usePaginatedList } from '../../hooks/usePaginatedList';
import type { MenuScreenProps } from '../../navigation/types';
import { productApi, restaurantApi } from '../../services/api';
import { colors } from '../../theme/colors';
import { spacing } from '../../theme/spacing';
import { cardShadow } from '../../theme/shadows';
import type { Product, Restaurant } from '../../types';
import { getRestaurantVisual } from '../../utils/foodVisuals';
import { impactLight } from '../../utils/haptics';
import { resolveMediaUrl } from '../../utils/media';
import {
  groupProductsByCategory,
  normalizeProductCategory,
  PRODUCT_CATEGORIES,
  type ProductCategoryKey,
} from '../../utils/productCategories';
import { buildMenuBannerMeta } from '../../utils/restaurantMeta';
import { FLATLIST_TUNING } from '../../utils/responsive';
import FoodImage from '../../components/FoodImage';

const MenuProductRow = React.memo(function MenuProductRow({
  product,
  quantity,
  onAdd,
  onDecrease,
  onPress,
}: {
  product: Product;
  quantity: number;
  onAdd: (product: Product) => void;
  onDecrease: (product: Product) => void;
  onPress: (product: Product) => void;
}) {
  return (
    <ProductCard
      product={product}
      quantity={quantity}
      onAdd={() => onAdd(product)}
      onDecrease={() => onDecrease(product)}
      onPress={() => onPress(product)}
    />
  );
});

export default function MenuScreen({ route, navigation }: MenuScreenProps) {
  const { restaurantId, restaurantName } = route.params;
  const { user } = useAuth();
  const { addItem, updateQuantity, items, itemCount, total } = useCart();
  const insets = useSafeAreaInsets();
  const isCustomer = user?.role === 'customer';
  const [restaurant, setRestaurant] = useState<Restaurant | null>(null);
  const [favorited, setFavorited] = useState(false);
  const [togglingFavorite, setTogglingFavorite] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState<ProductCategoryKey | null>(null);

  const visual = getRestaurantVisual(restaurant?.name ?? restaurantName);
  const imageUri = resolveMediaUrl(restaurant?.image_url ?? restaurant?.image);

  useEffect(() => {
    restaurantApi
      .get(restaurantId)
      .then(({ data }) => {
        setRestaurant(data);
        setFavorited(data.is_favorited === true);
      })
      .catch(() => {});
  }, [restaurantId]);

  const handleToggleFavorite = useCallback(async () => {
    if (!isCustomer || togglingFavorite) return;
    setTogglingFavorite(true);
    try {
      const { data } = await restaurantApi.toggleFavorite(restaurantId);
      setFavorited(data.is_favorited);
      setRestaurant((current) => (current ? { ...current, is_favorited: data.is_favorited } : current));
    } catch {
      appAlert('Error', 'No se pudo guardar la preferencia de avisos.');
    } finally {
      setTogglingFavorite(false);
    }
  }, [isCustomer, restaurantId, togglingFavorite]);

  const fetchPage = useCallback(async (page: number) => {
    const { data } = await productApi.listByRestaurant(restaurantId, page);
    return data;
  }, [restaurantId]);

  const {
    items: products,
    loading,
    loadingMore,
    error,
    hasMore,
    refresh,
    loadMore,
  } = usePaginatedList(fetchPage, [restaurantId], 'No se pudo cargar el menú');

  useEffect(() => {
    navigation.setOptions({ title: restaurant?.name ?? restaurantName });
  }, [navigation, restaurant?.name, restaurantName]);

  const quantityByProduct = useMemo(() => {
    const map = new Map<number, number>();
    for (const item of items) {
      map.set(item.product.id, (map.get(item.product.id) ?? 0) + item.quantity);
    }
    return map;
  }, [items]);

  const handleOpenDetail = useCallback((product: Product) => {
    navigation.navigate('ProductDetail', {
      product,
      restaurantName: restaurant?.name ?? restaurantName,
    });
  }, [navigation, restaurant?.name, restaurantName]);

  const productNeedsOptions = useCallback((product: Product) => {
    return (product.option_groups ?? []).some((g) => g.min_select > 0);
  }, []);

  const handleAdd = useCallback((product: Product) => {
    // Si hay opciones obligatorias, abrir detalle para elegir sabor/toppings.
    if (productNeedsOptions(product)) {
      handleOpenDetail(product);
      return;
    }
    try {
      addItem(product);
      void impactLight();
    } catch {
      // Evita cierre nativo si algo falla al agregar
    }
  }, [addItem, handleOpenDetail, productNeedsOptions]);

  const handleDecrease = useCallback((product: Product) => {
    // Prefiere la línea sin notas/opciones; si no, la primera del producto.
    const plain = items.find(
      (i) =>
        i.product.id === product.id
        && !(i.notes ?? '').trim()
        && !(i.selectedOptions?.length),
    );
    const line = plain ?? items.find((i) => i.product.id === product.id);
    if (!line) return;
    updateQuantity(product.id, line.quantity - 1, line.notes, line.selectedOptions);
    void impactLight();
  }, [items, updateQuantity]);

  const renderItem = useCallback(
    ({ item }: { item: Product }) => (
      <MenuProductRow
        product={item}
        quantity={quantityByProduct.get(item.id) ?? 0}
        onAdd={handleAdd}
        onDecrease={handleDecrease}
        onPress={handleOpenDetail}
      />
    ),
    [handleAdd, handleDecrease, handleOpenDetail, quantityByProduct],
  );

  const availableCategoryKeys = useMemo(() => {
    const keys = new Set(products.map((p) => normalizeProductCategory(p.category)));
    return PRODUCT_CATEGORIES.filter((c) => keys.has(c.key)).map((c) => c.key);
  }, [products]);

  const sections = useMemo(() => {
    const source = categoryFilter
      ? products.filter((p) => normalizeProductCategory(p.category) === categoryFilter)
      : products;
    return groupProductsByCategory(source);
  }, [categoryFilter, products]);

  const listPaddingBottom = useMemo(
    () => (isCustomer ? spacing.floatingBar + insets.bottom + spacing.xxl : spacing.xxl),
    [isCustomer, insets.bottom],
  );

  const bannerMeta = restaurant ? buildMenuBannerMeta(restaurant) : null;

  const categoryChips = useMemo(() => {
    if (availableCategoryKeys.length <= 1) return null;
    return (
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.categoryChips}
      >
        <Pressable
          style={[styles.chip, categoryFilter === null && styles.chipActive]}
          onPress={() => setCategoryFilter(null)}
        >
          <Text style={[styles.chipText, categoryFilter === null && styles.chipTextActive]}>
            Todos
          </Text>
        </Pressable>
        {PRODUCT_CATEGORIES.filter((c) => availableCategoryKeys.includes(c.key)).map((cat) => (
          <Pressable
            key={cat.key}
            style={[styles.chip, categoryFilter === cat.key && styles.chipActive]}
            onPress={() => setCategoryFilter(cat.key)}
          >
            <Text style={[styles.chipText, categoryFilter === cat.key && styles.chipTextActive]}>
              {cat.label}
            </Text>
          </Pressable>
        ))}
      </ScrollView>
    );
  }, [availableCategoryKeys, categoryFilter]);

  const banner = useMemo(
    () => (
      <View>
        <View style={styles.bannerWrap}>
          <View style={styles.bannerImageWrap}>
            <FoodImage
              emoji={visual.emoji}
              color={visual.color}
              size="lg"
              imageUri={imageUri}
              style={styles.bannerImage}
            />
            <LinearGradient
              colors={['transparent', 'rgba(15,23,42,0.7)']}
              style={styles.bannerGradient}
            />
            <View style={styles.bannerEmojiBadge}>
              <Text style={styles.bannerEmoji}>{visual.emoji}</Text>
            </View>
          </View>
          <View style={styles.bannerBody}>
            <Text style={styles.bannerName}>{restaurant?.name ?? restaurantName}</Text>
            {restaurant?.rating_average != null ? (
              <Pressable
                style={styles.reviewsRow}
                onPress={() => navigation.navigate('RestaurantReviews', { restaurantId, restaurantName: restaurant?.name ?? restaurantName })}
                hitSlop={8}
              >
                <Ionicons name="star" size={16} color="#F59E0B" />
                <Text style={styles.reviewsText}>
                  {restaurant.rating_average}
                  {restaurant.reviews_count != null ? ` (${restaurant.reviews_count} reseñas)` : ''}
                </Text>
                <Text style={styles.reviewsLink}>Ver reseñas</Text>
                <Ionicons name="chevron-forward" size={16} color={colors.primary} />
              </Pressable>
            ) : (
              <Pressable
                style={styles.reviewsRow}
                onPress={() => navigation.navigate('RestaurantReviews', { restaurantId, restaurantName: restaurant?.name ?? restaurantName })}
                hitSlop={8}
              >
                <Ionicons name="star-outline" size={16} color={colors.textMuted} />
                <Text style={[styles.reviewsText, { color: colors.textSecondary }]}>Sin reseñas aún</Text>
                <Text style={styles.reviewsLink}>Ver</Text>
                <Ionicons name="chevron-forward" size={16} color={colors.primary} />
              </Pressable>
            )}
            {bannerMeta ? (
              <View style={styles.bannerMeta}>
                <Ionicons name="time-outline" size={14} color={colors.textSecondary} />
                <Text style={styles.bannerMetaText}>{bannerMeta}</Text>
              </View>
            ) : null}
            {restaurant?.is_open === false && (
              <View style={styles.closedBanner}>
                <Text style={styles.closedBannerText}>Cerrado — no recibe pedidos ahora</Text>
              </View>
            )}
            {isCustomer && (
              <Pressable
                style={[styles.notifyRow, favorited && styles.notifyRowActive]}
                onPress={handleToggleFavorite}
                disabled={togglingFavorite}
              >
                <Ionicons
                  name={favorited ? 'notifications' : 'notifications-outline'}
                  size={16}
                  color={favorited ? colors.primary : colors.textSecondary}
                />
                <Text style={[styles.notifyText, favorited && styles.notifyTextActive]}>
                  {favorited ? 'Te avisamos cuando abra' : 'Avísame cuando abra'}
                </Text>
              </Pressable>
            )}
          </View>
        </View>
        {categoryChips}
      </View>
    ),
    [visual.color, visual.emoji, restaurantName, restaurant, imageUri, bannerMeta, isCustomer, favorited, togglingFavorite, handleToggleFavorite, restaurantId, navigation, categoryChips],
  );

  const listFooter = useMemo(
    () => (
      <ListFooter loadingMore={loadingMore} hasMore={hasMore} itemCount={products.length} />
    ),
    [loadingMore, hasMore, products.length],
  );

  const goToCart = useCallback(() => {
    (navigation as { navigate: (a: string, b?: object) => void }).navigate('Main', {
      screen: 'Carrito',
    });
  }, [navigation]);

  const renderSectionHeader = useCallback(
    ({ section }: { section: { title: string } }) => (
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>{section.title}</Text>
      </View>
    ),
    [],
  );

  return (
    <ScreenContainer
      loading={loading && products.length === 0}
      loadingSkeleton={
        <View style={[styles.list, { paddingBottom: listPaddingBottom }]}>
          <ListSkeleton count={5} variant="restaurant" />
        </View>
      }
      error={error}
      onRetry={refresh}
    >
      <SectionList
        sections={sections}
        keyExtractor={(item) => String(item.id)}
        contentContainerStyle={[
          styles.list,
          { paddingBottom: listPaddingBottom },
          products.length === 0 && !loading ? styles.listEmpty : null,
        ]}
        onEndReached={loadMore}
        onEndReachedThreshold={0.3}
        ListFooterComponent={listFooter}
        ListHeaderComponent={banner}
        renderItem={renderItem}
        renderSectionHeader={renderSectionHeader}
        stickySectionHeadersEnabled={false}
        ListEmptyComponent={
          !loading ? (
            <EmptyState emoji="🍽️" title="Menú vacío" subtitle="Este restaurante aún no tiene platillos publicados." />
          ) : null
        }
        {...FLATLIST_TUNING}
      />

      {isCustomer && (
        <FloatingCartBar itemCount={itemCount} total={total} onPress={goToCart} />
      )}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  list: { padding: spacing.screen, paddingTop: 0 },
  listEmpty: { flexGrow: 1, justifyContent: 'center' },
  categoryChips: {
    gap: spacing.sm,
    paddingBottom: spacing.md,
    paddingRight: spacing.screen,
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  chipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  chipText: { fontSize: 13, fontWeight: '700', color: colors.textSecondary },
  chipTextActive: { color: '#FFF' },
  sectionHeader: {
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
    backgroundColor: colors.background,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: colors.text,
    letterSpacing: -0.2,
  },
  bannerWrap: {
    marginHorizontal: -spacing.screen,
    marginBottom: spacing.lg,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
    overflow: 'hidden',
    ...cardShadow,
  },
  bannerImageWrap: {
    height: 160,
    backgroundColor: colors.primaryLight,
    position: 'relative',
  },
  bannerImage: { width: '100%', height: 160, borderRadius: 0 },
  bannerGradient: { ...StyleSheet.absoluteFillObject },
  bannerEmojiBadge: {
    position: 'absolute',
    bottom: 12,
    left: spacing.screen,
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bannerEmoji: { fontSize: 24 },
  bannerBody: { padding: spacing.lg, paddingTop: spacing.md },
  bannerName: { fontSize: 22, fontWeight: '800', color: colors.text, letterSpacing: -0.3 },
  reviewsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 10,
    flexWrap: 'wrap',
  },
  reviewsText: { fontSize: 14, fontWeight: '700', color: colors.text },
  reviewsLink: { fontSize: 13, fontWeight: '600', color: colors.primary, marginLeft: 4 },
  bannerMeta: { flexDirection: 'row', alignItems: 'flex-start', gap: 6, marginTop: 8 },
  bannerMetaText: { flex: 1, fontSize: 13, color: colors.textSecondary, fontWeight: '500', lineHeight: 18 },
  closedBanner: {
    marginTop: 10,
    backgroundColor: colors.error + '14',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    alignSelf: 'flex-start',
  },
  closedBannerText: { fontSize: 12, fontWeight: '700', color: colors.error },
  notifyRow: {
    marginTop: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    alignSelf: 'flex-start',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 24,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  notifyRowActive: {
    borderColor: colors.primary + '55',
    backgroundColor: colors.primaryLight,
  },
  notifyText: { fontSize: 13, fontWeight: '700', color: colors.textSecondary },
  notifyTextActive: { color: colors.primary },
});
