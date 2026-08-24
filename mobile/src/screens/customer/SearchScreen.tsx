import Ionicons from '@expo/vector-icons/Ionicons';
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
import FoodImage from '../../components/FoodImage';
import HomeRestaurantCard from '../../components/HomeRestaurantCard';
import ListSkeleton from '../../components/ListSkeleton';
import ScreenContainer from '../../components/ScreenContainer';
import SearchField from '../../components/SearchField';
import ServiceBusinessCard from '../../components/ServiceBusinessCard';
import { useAuth } from '../../context/AuthContext';
import { useTabScreenInsets } from '../../hooks/useTabScreenInsets';
import type { SearchScreenProps } from '../../navigation/types';
import { homeApi, restaurantApi } from '../../services/api';
import { colors } from '../../theme/colors';
import { radii } from '../../theme/radii';
import { cardShadow } from '../../theme/shadows';
import { spacing } from '../../theme/spacing';
import type { HomeRestaurant, Product, SearchPayload } from '../../types';
import { trackEvent } from '../../utils/analytics';
import { getApiErrorMessage } from '../../utils/apiErrors';
import { appAlert } from '../../utils/appAlert';
import { formatCurrency } from '../../utils/format';
import { getProductEmoji } from '../../utils/foodVisuals';
import { resolveMediaUrl } from '../../utils/media';
import { categoryEmoji } from '../../utils/restaurantCategories';

const EMPTY: SearchPayload = {
  q: '',
  categories: [],
  restaurants: [],
  products: [],
  services: [],
};

export default function SearchScreen({ navigation, route }: SearchScreenProps) {
  const { user, isGuest, requestLogin } = useAuth();
  const { listPaddingBottom, pagePadding } = useTabScreenInsets();
  const canFavorite = !!user && !isGuest && user.role === 'customer';
  const [query, setQuery] = useState(route.params?.q ?? '');
  const [debounced, setDebounced] = useState((route.params?.q ?? '').trim());
  const [data, setData] = useState<SearchPayload>(EMPTY);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const incoming = route.params?.q;
    if (incoming == null) return;
    setQuery(incoming);
    setDebounced(incoming.trim());
  }, [route.params?.q]);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(query.trim()), 300);
    return () => clearTimeout(t);
  }, [query]);

  const load = useCallback(async (silent = false) => {
    if (debounced.length < 2) {
      setData(EMPTY);
      setError(null);
      setLoading(false);
      return;
    }
    if (!silent) setLoading(true);
    try {
      const { data: payload } = await homeApi.search(debounced);
      setData(payload);
      setError(null);
      if (!silent) trackEvent('search_submitted', { q: debounced });
    } catch (err) {
      setError(getApiErrorMessage(err, 'No se pudo buscar.'));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [debounced]);

  useEffect(() => {
    void load();
  }, [load]);

  const toggleRestaurant = useCallback(async (item: HomeRestaurant) => {
    if (!canFavorite) {
      requestLogin();
      return;
    }
    const next = item.is_favorited !== true;
    setData((current) => ({
      ...current,
      restaurants: current.restaurants.map((row) =>
        row.id === item.id ? { ...row, is_favorited: next } : row,
      ),
    }));
    try {
      const { data: result } = await restaurantApi.toggleFavorite(item.id);
      trackEvent(result.is_favorited ? 'favorite_added' : 'favorite_removed', {
        kind: 'restaurant',
        id: item.id,
      });
    } catch (err) {
      setData((current) => ({
        ...current,
        restaurants: current.restaurants.map((row) =>
          row.id === item.id ? { ...row, is_favorited: !next } : row,
        ),
      }));
      appAlert('Favoritos', getApiErrorMessage(err, 'No se pudo actualizar el favorito.'));
    }
  }, [canFavorite, requestLogin]);

  const openRestaurant = (item: HomeRestaurant) => {
    trackEvent('home_restaurant_clicked', { restaurant_id: item.id, source: 'search' });
    navigation.navigate('Menu', { restaurantId: item.id, restaurantName: item.name });
  };

  const hasResults =
    data.categories.length > 0
    || data.restaurants.length > 0
    || data.products.length > 0
    || data.services.length > 0;

  return (
    <ScreenContainer>
      <ScrollView
        contentContainerStyle={[styles.list, { paddingHorizontal: pagePadding }, listPaddingBottom()]}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              void load(true);
            }}
          />
        }
      >
        <SearchField
          value={query}
          onChangeText={setQuery}
          placeholder="Tacos, pizza, veterinario…"
          onSubmitEditing={() => setDebounced(query.trim())}
        />

        {loading && !hasResults ? <ListSkeleton count={4} variant="restaurant" /> : null}
        {error ? <Text style={styles.error}>{error}</Text> : null}

        {!loading && debounced.length >= 2 && !hasResults && !error ? (
          <EmptyState
            emoji="🔍"
            title="Sin resultados"
            subtitle="Prueba con el nombre de un platillo, restaurante o servicio."
          />
        ) : null}

        {debounced.length < 2 && !loading ? (
          <Text style={styles.hint}>Escribe al menos 2 letras para buscar comida y servicios.</Text>
        ) : null}

        {data.categories.length > 0 ? (
          <View style={styles.section}>
            <Text style={styles.title}>Categorías</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.hScroll}>
              {data.categories.map((cat) => (
                <Pressable
                  key={cat.key}
                  style={styles.catChip}
                  onPress={() => navigation.navigate('Comida', { category: cat.key })}
                >
                  <Text style={styles.catEmoji}>{categoryEmoji(cat.key)}</Text>
                  <Text style={styles.catText}>{cat.label}</Text>
                </Pressable>
              ))}
            </ScrollView>
          </View>
        ) : null}

        {data.restaurants.length > 0 ? (
          <View style={styles.section}>
            <Text style={styles.title}>Restaurantes</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.hScroll}>
              {data.restaurants.map((item) => (
                <HomeRestaurantCard
                  key={item.id}
                  restaurant={item}
                  showFavorite={canFavorite}
                  onPress={() => openRestaurant(item)}
                  onToggleFavorite={() => { void toggleRestaurant(item); }}
                />
              ))}
            </ScrollView>
          </View>
        ) : null}

        {data.products.length > 0 ? (
          <View style={styles.section}>
            <Text style={styles.title}>Platillos</Text>
            {data.products.map((product) => (
              <ProductRow
                key={product.id}
                product={product}
                onPress={() =>
                  navigation.navigate('ProductDetail', {
                    product,
                    restaurantName: product.restaurant_name,
                  })
                }
              />
            ))}
          </View>
        ) : null}

        {data.services.length > 0 ? (
          <View style={styles.section}>
            <Text style={styles.title}>Servicios</Text>
            {data.services.map((service) => (
              <ServiceBusinessCard key={service.id} service={service} />
            ))}
          </View>
        ) : null}
      </ScrollView>
    </ScreenContainer>
  );
}

function ProductRow({ product, onPress }: { product: Product; onPress: () => void }) {
  return (
    <Pressable style={styles.productRow} onPress={onPress}>
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
      </View>
      <Text style={styles.productPrice}>{formatCurrency(product.price)}</Text>
      <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  list: { paddingTop: spacing.md, paddingBottom: spacing.xxl, gap: spacing.md },
  hint: { fontSize: 14, fontWeight: '600', color: colors.textSecondary, textAlign: 'center', marginTop: spacing.lg },
  error: { fontSize: 13, color: colors.error, fontWeight: '600' },
  section: { gap: spacing.sm },
  title: { fontSize: 18, fontWeight: '800', color: colors.text },
  hScroll: { gap: spacing.sm, paddingVertical: 2 },
  catChip: {
    alignItems: 'center',
    width: 86,
    paddingVertical: 12,
    borderRadius: radii.card,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderLight,
    gap: 6,
  },
  catEmoji: { fontSize: 24 },
  catText: { fontSize: 12, fontWeight: '800', color: colors.text, textAlign: 'center' },
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
  productPrice: { fontSize: 14, fontWeight: '800', color: colors.primary },
});
