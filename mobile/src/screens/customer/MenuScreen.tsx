import Ionicons from '@expo/vector-icons/Ionicons';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
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
import { buildMenuBannerMeta } from '../../utils/restaurantMeta';
import { FLATLIST_TUNING } from '../../utils/responsive';
import FoodImage from '../../components/FoodImage';

const MenuProductRow = React.memo(function MenuProductRow({
  product,
  quantity,
  onAdd,
  onDecrease,
}: {
  product: Product;
  quantity: number;
  onAdd: (product: Product) => void;
  onDecrease: (product: Product) => void;
}) {
  return (
    <ProductCard
      product={product}
      quantity={quantity}
      onAdd={() => onAdd(product)}
      onDecrease={() => onDecrease(product)}
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
      map.set(item.product.id, item.quantity);
    }
    return map;
  }, [items]);

  const handleAdd = useCallback((product: Product) => {
    try {
      addItem(product);
      void impactLight();
    } catch {
      // Evita cierre nativo si algo falla al agregar
    }
  }, [addItem]);

  const handleDecrease = useCallback((product: Product) => {
    const current = quantityByProduct.get(product.id) ?? 0;
    if (current <= 1) {
      updateQuantity(product.id, 0);
    } else {
      updateQuantity(product.id, current - 1);
    }
    void impactLight();
  }, [quantityByProduct, updateQuantity]);

  const renderItem = useCallback(
    ({ item }: { item: Product }) => (
      <MenuProductRow
        product={item}
        quantity={quantityByProduct.get(item.id) ?? 0}
        onAdd={handleAdd}
        onDecrease={handleDecrease}
      />
    ),
    [handleAdd, handleDecrease, quantityByProduct],
  );

  const listPaddingBottom = useMemo(
    () => (isCustomer ? spacing.floatingBar + insets.bottom + spacing.xxl : spacing.xxl),
    [isCustomer, insets.bottom],
  );

  const bannerMeta = restaurant ? buildMenuBannerMeta(restaurant) : null;

  const banner = useMemo(
    () => (
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
    ),
    [visual.color, visual.emoji, restaurantName, restaurant, imageUri, bannerMeta, isCustomer, favorited, togglingFavorite, handleToggleFavorite],
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
      <FlatList
        data={products}
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
