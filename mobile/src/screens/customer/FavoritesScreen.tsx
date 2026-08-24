import React, { useCallback, useEffect, useState } from 'react';
import {
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import EmptyState from '../../components/EmptyState';
import FavoriteHeart from '../../components/FavoriteHeart';
import FoodImage from '../../components/FoodImage';
import HomeRestaurantCard from '../../components/HomeRestaurantCard';
import ListSkeleton from '../../components/ListSkeleton';
import ScreenContainer from '../../components/ScreenContainer';
import { useAuth } from '../../context/AuthContext';
import { useTabScreenInsets } from '../../hooks/useTabScreenInsets';
import type { FavoritesScreenProps } from '../../navigation/types';
import { homeApi, productApi, restaurantApi } from '../../services/api';
import { colors } from '../../theme/colors';
import { radii } from '../../theme/radii';
import { cardShadow } from '../../theme/shadows';
import { spacing } from '../../theme/spacing';
import type { FavoritesPayload, HomeRestaurant, Product } from '../../types';
import { trackEvent } from '../../utils/analytics';
import { getApiErrorMessage } from '../../utils/apiErrors';
import { appAlert } from '../../utils/appAlert';
import { formatCurrency } from '../../utils/format';
import { getProductEmoji } from '../../utils/foodVisuals';
import { resolveMediaUrl } from '../../utils/media';

const EMPTY: FavoritesPayload = { restaurants: [], products: [] };

export default function FavoritesScreen({ navigation }: FavoritesScreenProps) {
  const { user, isGuest, requestLogin } = useAuth();
  const { listPaddingBottom, pagePadding } = useTabScreenInsets();
  const canFavorite = !!user && !isGuest && user.role === 'customer';
  const [data, setData] = useState<FavoritesPayload>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!canFavorite) {
      setData(EMPTY);
      setLoading(false);
      return;
    }
    try {
      const { data: payload } = await homeApi.favorites();
      setData(payload);
      setError(null);
    } catch (err) {
      setError(getApiErrorMessage(err, 'No se pudieron cargar tus favoritos.'));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [canFavorite]);

  useEffect(() => {
    void load();
  }, [load]);

  const toggleRestaurant = async (item: HomeRestaurant) => {
    const next = item.is_favorited !== true;
    setData((current) => ({
      ...current,
      restaurants: next
        ? current.restaurants.map((row) => (row.id === item.id ? { ...row, is_favorited: true } : row))
        : current.restaurants.filter((row) => row.id !== item.id),
    }));
    try {
      const { data: result } = await restaurantApi.toggleFavorite(item.id);
      trackEvent(result.is_favorited ? 'favorite_added' : 'favorite_removed', {
        kind: 'restaurant',
        id: item.id,
      });
      if (!result.is_favorited) {
        setData((current) => ({
          ...current,
          restaurants: current.restaurants.filter((row) => row.id !== item.id),
        }));
      }
    } catch (err) {
      appAlert('Favoritos', getApiErrorMessage(err, 'No se pudo actualizar el favorito.'));
      void load();
    }
  };

  const toggleProduct = async (product: Product) => {
    setData((current) => ({
      ...current,
      products: current.products.filter((row) => row.id !== product.id),
    }));
    try {
      const { data: result } = await productApi.toggleFavorite(product.id);
      trackEvent(result.is_favorited ? 'favorite_added' : 'favorite_removed', {
        kind: 'product',
        id: product.id,
      });
      if (result.is_favorited) {
        void load();
      }
    } catch (err) {
      appAlert('Favoritos', getApiErrorMessage(err, 'No se pudo actualizar el favorito.'));
      void load();
    }
  };

  if (!canFavorite) {
    return (
      <ScreenContainer>
        <EmptyState
          emoji="❤️"
          title="Inicia sesión"
          subtitle="Guarda restaurantes y platillos para verlos aquí."
          actionLabel="Entrar"
          onAction={requestLogin}
        />
      </ScreenContainer>
    );
  }

  const empty = data.restaurants.length === 0 && data.products.length === 0;

  return (
    <ScreenContainer
      loading={loading && empty}
      loadingSkeleton={<ListSkeleton count={4} variant="restaurant" />}
      error={error && empty ? error : null}
      onRetry={() => { void load(); }}
    >
      <ScrollView
        contentContainerStyle={[styles.list, { paddingHorizontal: pagePadding }, listPaddingBottom()]}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); void load(); }} />
        }
      >
        {empty && !loading ? (
          <EmptyState
            emoji="❤️"
            title="Aún no tienes favoritos"
            subtitle="Toca el corazón en un restaurante o platillo para guardarlo."
          />
        ) : null}

        {data.restaurants.length > 0 ? (
          <View style={styles.section}>
            <Text style={styles.title}>Restaurantes</Text>
            <View style={styles.wrap}>
              {data.restaurants.map((item) => (
                <HomeRestaurantCard
                  key={item.id}
                  restaurant={item}
                  showFavorite
                  onPress={() =>
                    navigation.navigate('Menu', {
                      restaurantId: item.id,
                      restaurantName: item.name,
                    })
                  }
                  onToggleFavorite={() => { void toggleRestaurant(item); }}
                />
              ))}
            </View>
          </View>
        ) : null}

        {data.products.length > 0 ? (
          <View style={styles.section}>
            <Text style={styles.title}>Platillos</Text>
            {data.products.map((product) => (
              <Pressable
                key={product.id}
                style={styles.productRow}
                onPress={() =>
                  navigation.navigate('ProductDetail', {
                    product,
                    restaurantName: product.restaurant_name,
                  })
                }
              >
                <FoodImage
                  emoji={getProductEmoji(product.name)}
                  color={colors.primary}
                  size="sm"
                  imageUri={resolveMediaUrl(product.image_url ?? product.image)}
                  style={styles.productImage}
                />
                <View style={styles.productCopy}>
                  <Text style={styles.productName} numberOfLines={1}>{product.name}</Text>
                  <Text style={styles.productMeta} numberOfLines={1}>{product.restaurant_name}</Text>
                  <Text style={styles.productPrice}>{formatCurrency(product.price)}</Text>
                </View>
                <FavoriteHeart
                  favorited
                  onPress={() => { void toggleProduct(product); }}
                />
              </Pressable>
            ))}
          </View>
        ) : null}
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  list: { paddingTop: spacing.md, paddingBottom: spacing.xxl, gap: spacing.lg },
  section: { gap: spacing.sm },
  title: { fontSize: 18, fontWeight: '800', color: colors.text },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  productRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: colors.surface,
    borderRadius: radii.card,
    padding: spacing.sm,
    borderWidth: 1,
    borderColor: colors.borderLight,
    ...cardShadow,
  },
  productImage: { width: 56, height: 56, borderRadius: radii.md },
  productCopy: { flex: 1, minWidth: 0 },
  productName: { fontSize: 15, fontWeight: '800', color: colors.text },
  productMeta: { fontSize: 12, fontWeight: '600', color: colors.textSecondary },
  productPrice: { fontSize: 14, fontWeight: '800', color: colors.primary, marginTop: 2 },
});
