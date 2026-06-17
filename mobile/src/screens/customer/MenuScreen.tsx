import Ionicons from '@expo/vector-icons/Ionicons';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { appAlert } from '../../utils/appAlert';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

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
import type { Product, Restaurant } from '../../types';
import { getRestaurantVisual } from '../../utils/foodVisuals';
import { resolveMediaUrl } from '../../utils/media';
import { buildMenuBannerMeta } from '../../utils/restaurantMeta';
import { FLATLIST_TUNING } from '../../utils/responsive';
import FoodImage from '../../components/FoodImage';

const MenuProductRow = React.memo(function MenuProductRow({
  product,
  onAdd,
}: {
  product: Product;
  onAdd: (product: Product) => void;
}) {
  return <ProductCard product={product} onAdd={() => onAdd(product)} />;
});

export default function MenuScreen({ route, navigation }: MenuScreenProps) {
  const { restaurantId, restaurantName } = route.params;
  const { user } = useAuth();
  const { addItem, itemCount, total } = useCart();
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

  const handleAdd = useCallback((product: Product) => {
    try {
      addItem(product);
    } catch {
      // Evita cierre nativo si algo falla al agregar
    }
  }, [addItem]);

  const renderItem = useCallback(
    ({ item }: { item: Product }) => <MenuProductRow product={item} onAdd={handleAdd} />,
    [handleAdd],
  );

  const listPaddingBottom = useMemo(
    () => (isCustomer ? spacing.floatingBar + insets.bottom + spacing.xxl : spacing.xxl),
    [isCustomer, insets.bottom],
  );

  const bannerMeta = restaurant ? buildMenuBannerMeta(restaurant) : null;

  const banner = useMemo(
    () => (
      <LinearGradient
        colors={[visual.color + 'CC', visual.color + '44']}
        style={styles.banner}
      >
        <FoodImage emoji={visual.emoji} color={visual.color} size="lg" imageUri={imageUri} />
        <View style={styles.bannerInfo}>
          <Text style={styles.bannerName}>{restaurant?.name ?? restaurantName}</Text>
          {bannerMeta ? (
            <View style={styles.bannerMeta}>
              <Ionicons name="information-circle-outline" size={14} color={colors.textSecondary} />
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
      </LinearGradient>
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
    <ScreenContainer loading={loading && products.length === 0} error={error} onRetry={refresh}>
      <FlatList
        data={products}
        keyExtractor={(item) => String(item.id)}
        contentContainerStyle={[styles.list, { paddingBottom: listPaddingBottom }]}
        onEndReached={loadMore}
        onEndReachedThreshold={0.3}
        ListFooterComponent={listFooter}
        ListHeaderComponent={banner}
        renderItem={renderItem}
        ListEmptyComponent={
          !loading ? <Text style={styles.empty}>Menú vacío por ahora</Text> : null
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
  list: { padding: spacing.screen },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.lg,
    padding: spacing.lg,
    borderRadius: 16,
    marginBottom: spacing.lg,
  },
  bannerInfo: { flex: 1 },
  bannerName: { fontSize: 20, fontWeight: '800', color: colors.text },
  bannerMeta: { flexDirection: 'row', alignItems: 'flex-start', gap: 6, marginTop: 6 },
  bannerMetaText: { flex: 1, fontSize: 13, color: colors.textSecondary, fontWeight: '500', lineHeight: 18 },
  closedBanner: {
    marginTop: 8,
    backgroundColor: colors.error + '18',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    alignSelf: 'flex-start',
  },
  closedBannerText: { fontSize: 12, fontWeight: '700', color: colors.error },
  notifyRow: {
    marginTop: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  notifyRowActive: {
    borderColor: colors.primary + '55',
    backgroundColor: colors.primary + '12',
  },
  notifyText: { fontSize: 12, fontWeight: '600', color: colors.textSecondary },
  notifyTextActive: { color: colors.primary },
  empty: { textAlign: 'center', color: colors.textMuted, marginTop: 40 },
});
