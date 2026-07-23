import Ionicons from '@expo/vector-icons/Ionicons';
import React, { useCallback, useMemo, useState } from 'react';
import {
  FlatList,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import ActiveDeliveryStrip from '../../components/ActiveDeliveryStrip';
import CustomerHomeHeader from '../../components/CustomerHomeHeader';
import EmptyState from '../../components/EmptyState';
import FeaturedDishesStrip from '../../components/FeaturedDishesStrip';
import ListFooter from '../../components/ListFooter';
import ListSkeleton from '../../components/ListSkeleton';
import RestaurantCard from '../../components/RestaurantCard';
import ScreenContainer from '../../components/ScreenContainer';
import { useAuth } from '../../context/AuthContext';
import type { ActiveDeliveryItem } from '../../context/CustomerActiveDeliveriesContext';
import { useCustomerActiveDeliveries } from '../../context/CustomerActiveDeliveriesContext';
import { usePaginatedList } from '../../hooks/usePaginatedList';
import { useTabScreenInsets } from '../../hooks/useTabScreenInsets';
import type { HomeScreenProps } from '../../navigation/types';
import { productApi, restaurantApi } from '../../services/api';
import { colors } from '../../theme/colors';
import { spacing } from '../../theme/spacing';
import type { Product, Restaurant } from '../../types';
import { resolveMediaUrl } from '../../utils/media';
import {
  RESTAURANT_CATEGORIES,
  restaurantMatchesCategory,
  type RestaurantCategoryKey,
} from '../../utils/restaurantCategories';

const FEATURED_DISHES_COUNT = 8;
const CATEGORIES = [...RESTAURANT_CATEGORIES];

export default function HomeScreen({ navigation }: HomeScreenProps) {
  const { user } = useAuth();
  const { insets, listPaddingBottom, pagePadding } = useTabScreenInsets();
  const {
    liveItems,
    trackingItems,
    refreshError,
    refresh,
  } = useCustomerActiveDeliveries();

  const [search, setSearch] = useState('');
  const [category, setCategory] = useState<RestaurantCategoryKey>(null);
  const [featuredDishes, setFeaturedDishes] = useState<Product[]>([]);

  const fetchPage = useCallback(async (page: number) => {
    const { data } = await restaurantApi.list(page, category ?? undefined);
    return data;
  }, [category]);

  const {
    items: restaurants,
    loading,
    refreshing,
    loadingMore,
    error,
    hasMore,
    refresh: refreshRestaurants,
    loadMore,
  } = usePaginatedList(fetchPage, [fetchPage], 'No se pudieron cargar los restaurantes');

  const loadFeatured = useCallback(async () => {
    try {
      const { data } = await productApi.featured(FEATURED_DISHES_COUNT);
      setFeaturedDishes(data);
    } catch {
      setFeaturedDishes([]);
    }
  }, []);

  React.useEffect(() => {
    void loadFeatured();
  }, [loadFeatured]);

  const filtered = useMemo(() => {
    const list = restaurants.filter((r) => {
      const matchSearch =
        !search
        || r.name.toLowerCase().includes(search.toLowerCase())
        || (r.description ?? '').toLowerCase().includes(search.toLowerCase());
      const matchCat = category ? restaurantMatchesCategory(r, category) : true;
      return matchSearch && matchCat;
    });
    return [...list].sort((a, b) => {
      const aOpen = a.is_open === false ? 0 : 1;
      const bOpen = b.is_open === false ? 0 : 1;
      if (aOpen !== bOpen) return bOpen - aOpen;
      return a.name.localeCompare(b.name, 'es');
    });
  }, [restaurants, search, category]);

  const onRefresh = useCallback(async () => {
    await Promise.all([refresh(), refreshRestaurants(), loadFeatured()]);
  }, [refresh, refreshRestaurants, loadFeatured]);

  const openRestaurant = useCallback(
    (restaurant: Restaurant) => {
      navigation.navigate('Menu', {
        restaurantId: restaurant.id,
        restaurantName: restaurant.name,
      });
    },
    [navigation],
  );

  const handleDeliveryPress = (item: ActiveDeliveryItem) => {
    navigation.navigate('OrderDetail', { orderId: item.id });
  };

  const handleDishPress = useCallback(
    (product: Product) => {
      navigation.navigate('ProductDetail', {
        product,
        restaurantName: product.restaurant_name,
      });
    },
    [navigation],
  );

  const stripItems = liveItems.length > 0 ? liveItems : trackingItems.slice(0, 3);
  const initialLoading = loading && restaurants.length === 0;

  return (
    <ScreenContainer
      loading={initialLoading}
      loadingSkeleton={
        <View style={[styles.skeleton, { paddingTop: insets.top + 12 }, listPaddingBottom()]}>
          <ListSkeleton count={4} variant="order" />
        </View>
      }
      error={error && restaurants.length === 0 ? error : null}
      onRetry={() => {
        void refreshRestaurants();
      }}
    >
      <FlatList
        data={filtered}
        keyExtractor={(item) => String(item.id)}
        contentContainerStyle={[
          styles.list,
          { paddingHorizontal: pagePadding },
          listPaddingBottom(),
        ]}
        refreshing={refreshing}
        onRefresh={() => {
          void onRefresh();
        }}
        onEndReached={() => {
          if (hasMore && !loadingMore) loadMore();
        }}
        onEndReachedThreshold={0.4}
        ListHeaderComponent={
          <>
            <CustomerHomeHeader
              topInset={insets.top}
              firstName={user?.first_name}
              avatarUrl={resolveMediaUrl(user?.avatar_url ?? user?.avatar)}
              search={search}
              onSearchChange={setSearch}
              onProfilePress={() => navigation.navigate('Perfil')}
              onSeeAllPress={() => navigation.navigate('Comida')}
            />

            {stripItems.length > 0 ? (
              <ActiveDeliveryStrip items={stripItems} onPress={handleDeliveryPress} />
            ) : null}

            {refreshError ? (
              <Pressable style={styles.refreshError} onPress={() => { void onRefresh(); }}>
                <Text style={styles.refreshErrorText}>
                  {refreshError} · Toca para reintentar
                </Text>
              </Pressable>
            ) : null}

            <View style={styles.secondaryRow}>
              <SecondaryChip
                icon="pricetag-outline"
                label="Ofertas"
                color={colors.accent}
                onPress={() => navigation.navigate('Ofertas')}
              />
              <SecondaryChip
                icon="storefront-outline"
                label="Servicios"
                color={colors.serviceStart}
                onPress={() => navigation.navigate('Servicios')}
              />
            </View>

            {featuredDishes.length > 0 && !search ? (
              <FeaturedDishesStrip
                products={featuredDishes}
                onPressProduct={handleDishPress}
                onPressSeeAll={() => navigation.navigate('Comida')}
              />
            ) : null}

            <ScrollCategories category={category} onChange={setCategory} />

            <View style={styles.sectionHead}>
              <Text style={styles.sectionTitle}>Restaurantes</Text>
              <Text style={styles.sectionSub}>
                {filtered.length} cerca de ti
              </Text>
            </View>
          </>
        }
        renderItem={({ item }) => (
          <RestaurantCard restaurant={item} onPress={() => openRestaurant(item)} />
        )}
        ListFooterComponent={
          <ListFooter loadingMore={loadingMore} hasMore={hasMore} itemCount={filtered.length} />
        }
        ListEmptyComponent={
          !loading ? (
            <EmptyState
              emoji="🍽️"
              title="Sin restaurantes"
              subtitle={
                search
                  ? 'Prueba otra búsqueda o quita los filtros.'
                  : 'Aún no hay locales disponibles en esta categoría.'
              }
              actionLabel="Ver todos"
              onAction={() => {
                setSearch('');
                setCategory(null);
              }}
            />
          ) : null
        }
      />
    </ScreenContainer>
  );
}

function SecondaryChip({
  icon,
  label,
  color,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  color: string;
  onPress: () => void;
}) {
  return (
    <Pressable style={styles.secondaryChip} onPress={onPress}>
      <View style={[styles.secondaryIcon, { backgroundColor: color + '22' }]}>
        <Ionicons name={icon} size={18} color={color} />
      </View>
      <Text style={styles.secondaryLabel}>{label}</Text>
      <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
    </Pressable>
  );
}

function ScrollCategories({
  category,
  onChange,
}: {
  category: RestaurantCategoryKey;
  onChange: (key: RestaurantCategoryKey) => void;
}) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.catRow}
      style={styles.catWrap}
    >
      {CATEGORIES.map((cat) => {
        const active = category === cat.key;
        return (
          <Pressable
            key={cat.label}
            style={[styles.catChip, active && styles.catChipActive]}
            onPress={() => onChange(cat.key)}
          >
            <Text style={styles.catEmoji}>{cat.emoji}</Text>
            <Text style={[styles.catText, active && styles.catTextActive]}>
              {cat.label}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  list: { flexGrow: 1, backgroundColor: colors.background },
  skeleton: { flex: 1, paddingHorizontal: spacing.screen },
  refreshError: {
    backgroundColor: colors.primaryLight,
    borderRadius: 14,
    padding: 12,
    marginBottom: spacing.sm,
  },
  refreshErrorText: {
    fontSize: 12,
    color: colors.textSecondary,
    textAlign: 'center',
    fontWeight: '600',
  },
  secondaryRow: { flexDirection: 'row', gap: 10, marginBottom: spacing.sm },
  secondaryChip: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.surface,
    borderRadius: 14,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  secondaryIcon: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryLabel: { flex: 1, fontSize: 13, fontWeight: '800', color: colors.text },
  catWrap: { marginBottom: spacing.sm, flexGrow: 0 },
  catRow: { gap: 8, paddingVertical: 4 },
  catChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  catChipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  catEmoji: { fontSize: 14 },
  catText: { fontSize: 13, fontWeight: '700', color: colors.textSecondary },
  catTextActive: { color: '#FFF' },
  sectionHead: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
    marginTop: spacing.xs,
  },
  sectionTitle: { fontSize: 18, fontWeight: '900', color: colors.text },
  sectionSub: { fontSize: 12, fontWeight: '600', color: colors.textMuted },
});
