import Ionicons from '@expo/vector-icons/Ionicons';
import React, { Suspense, useCallback, useMemo, useState } from 'react';
import { ActivityIndicator } from 'react-native';
import {
  FlatList,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { appAlert } from '../../utils/appAlert';

import type { MapMarker } from '../../components/AppMap';
import EmptyState from '../../components/EmptyState';
import HomeHero from '../../components/HomeHero';
import ListFooter from '../../components/ListFooter';
import ListSkeleton from '../../components/ListSkeleton';
import RestaurantCard from '../../components/RestaurantCard';
import ScreenContainer from '../../components/ScreenContainer';
import SearchField from '../../components/SearchField';
import { useAuth } from '../../context/AuthContext';
import { usePaginatedList } from '../../hooks/usePaginatedList';
import { useTabScreenInsets } from '../../hooks/useTabScreenInsets';
import type { RestaurantsScreenProps } from '../../navigation/types';
import { restaurantApi } from '../../services/api';
import { colors } from '../../theme/colors';
import { spacing } from '../../theme/spacing';
import type { Restaurant } from '../../types';
import { regionForCoordinates, toCoordinate } from '../../utils/maps';
import { RESTAURANT_CATEGORIES, restaurantMatchesCategory, type RestaurantCategoryKey } from '../../utils/restaurantCategories';
import { FLATLIST_TUNING, mapHeight } from '../../utils/responsive';

const CATEGORIES = [...RESTAURANT_CATEGORIES];

const AppMap = React.lazy(() => import('../../components/AppMap'));

export default function RestaurantsScreen({ navigation }: RestaurantsScreenProps) {
  const { user } = useAuth();
  const { insets, listPaddingBottom } = useTabScreenInsets();
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState<RestaurantCategoryKey>(null);
  const [viewMode, setViewMode] = useState<'list' | 'map'>('list');

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
    refresh,
    loadMore,
  } = usePaginatedList(fetchPage, [fetchPage], 'No se pudieron cargar los restaurantes');

  const filtered = useMemo(() => {
    return restaurants.filter((r) => {
      const matchSearch =
        !search ||
        r.name.toLowerCase().includes(search.toLowerCase()) ||
        (r.description ?? '').toLowerCase().includes(search.toLowerCase());
      const matchCat = category ? restaurantMatchesCategory(r, category) : true;
      return matchSearch && matchCat;
    });
  }, [restaurants, search, category]);

  const mapMarkers: MapMarker[] = useMemo(() => {
    return filtered
      .map((r) => {
        const coord = toCoordinate(r.latitude, r.longitude);
        if (!coord) return null;
        return {
          id: String(r.id),
          coordinate: coord,
          title: r.name,
          description: r.address,
          pinType: 'restaurant' as const,
        };
      })
      .filter(Boolean) as MapMarker[];
  }, [filtered]);

  const mapRegion = useMemo(
    () => regionForCoordinates(mapMarkers.map((m) => m.coordinate)),
    [mapMarkers],
  );

  const openRestaurant = useCallback(
    (restaurant: Restaurant) => {
      if (restaurant.is_open === false) {
        appAlert('Cerrado', `${restaurant.name} no está recibiendo pedidos en este momento.`);
        return;
      }
      navigation.navigate('Menu', {
        restaurantId: restaurant.id,
        restaurantName: restaurant.name,
      });
    },
    [navigation],
  );

  const handleMarkerPress = useCallback(
    (marker: MapMarker) => {
      const restaurant = filtered.find((r) => String(r.id) === marker.id);
      if (restaurant) openRestaurant(restaurant);
    },
    [filtered, openRestaurant],
  );

  const renderRestaurant = useCallback(
    ({ item }: { item: Restaurant }) => (
      <RestaurantCard restaurant={item} onPress={() => openRestaurant(item)} />
    ),
    [openRestaurant],
  );

  const renderMapListItem = useCallback(
    ({ item }: { item: Restaurant }) => (
      <Pressable style={styles.mapListItem} onPress={() => openRestaurant(item)}>
        <Ionicons name="restaurant" size={18} color={colors.primary} />
        <View style={styles.mapListContent}>
          <Text style={styles.mapListName}>{item.name}</Text>
          <Text style={styles.mapListAddr} numberOfLines={1}>{item.address}</Text>
        </View>
        <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
      </Pressable>
    ),
    [openRestaurant],
  );

  const header = useMemo(
    () => (
      <>
        <HomeHero
          firstName={user?.first_name}
          topInset={insets.top}
          onProfilePress={() => navigation.navigate('Main', { screen: 'Perfil' })}
          style={styles.hero}
        >
          <View style={styles.searchWrap}>
            <SearchField
              value={search}
              onChangeText={setSearch}
              placeholder="Buscar restaurantes o comida…"
              elevated
            />
          </View>
        </HomeHero>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.categories}
        >
          {CATEGORIES.map((cat) => (
            <Pressable
              key={cat.label}
              style={[styles.chip, category === cat.key && styles.chipActive]}
              onPress={() => setCategory(cat.key)}
            >
              <Text style={styles.chipEmoji}>{cat.emoji}</Text>
              <Text style={[styles.chipText, category === cat.key && styles.chipTextActive]}>
                {cat.label}
              </Text>
            </Pressable>
          ))}
        </ScrollView>

        <View style={styles.sectionRow}>
          <Text style={styles.sectionTitle}>Cerca de ti</Text>
          <View style={styles.viewToggle}>
            <Pressable
              style={[styles.toggleBtn, viewMode === 'list' && styles.toggleActive]}
              onPress={() => setViewMode('list')}
            >
              <Ionicons name="list" size={18} color={viewMode === 'list' ? '#FFF' : colors.textMuted} />
            </Pressable>
            <Pressable
              style={[styles.toggleBtn, viewMode === 'map' && styles.toggleActive]}
              onPress={() => setViewMode('map')}
            >
              <Ionicons name="map" size={18} color={viewMode === 'map' ? '#FFF' : colors.textMuted} />
            </Pressable>
          </View>
        </View>
      </>
    ),
    [insets.top, user?.first_name, search, category, viewMode, navigation],
  );

  const mapHeader = useMemo(
    () => (
      <>
        {header}
        <Suspense
          fallback={
            <View style={[styles.mapFallback, { height: mapHeight() }]}>
              <ActivityIndicator color={colors.primary} />
            </View>
          }
        >
          <AppMap
            markers={mapMarkers}
            region={mapRegion}
            height={mapHeight()}
            showsUserLocation
            onMarkerPress={handleMarkerPress}
            emptyMessage="Los restaurantes no tienen ubicación en el mapa todavía."
          />
        </Suspense>
        <Text style={styles.mapHint}>
          {mapMarkers.length === 0
            ? 'Sin restaurantes con ubicación'
            : `${mapMarkers.length} restaurante${mapMarkers.length > 1 ? 's' : ''} en el mapa`}
          {category ? ' · Toca "Todos" para ver más' : ''}
        </Text>
        <Text style={styles.mapSubhint}>Toca un pin 🍽️ para ver el menú</Text>
      </>
    ),
    [header, mapMarkers, mapRegion, handleMarkerPress, category],
  );

  const listFooter = useMemo(
    () => (
      <ListFooter
        loadingMore={loadingMore}
        hasMore={hasMore && viewMode === 'list'}
        itemCount={filtered.length}
      />
    ),
    [loadingMore, hasMore, viewMode, filtered.length],
  );

  if (viewMode === 'map') {
    return (
      <ScreenContainer
        loading={loading && restaurants.length === 0}
        loadingSkeleton={
          <View style={[styles.skeletonWrap, listPaddingBottom()]}>
            <ListSkeleton count={5} variant="restaurant" />
          </View>
        }
        error={error}
        onRetry={refresh}
      >
        <FlatList
          data={filtered}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={[styles.list, listPaddingBottom()]}
          onRefresh={refresh}
          refreshing={refreshing}
          onEndReached={loadMore}
          onEndReachedThreshold={0.3}
          ListHeaderComponent={mapHeader}
          renderItem={renderMapListItem}
          ListEmptyComponent={
            !loading ? (
              <EmptyState
                emoji="🍽️"
                title="Sin resultados"
                subtitle="Prueba otra búsqueda o categoría"
              />
            ) : null
          }
          {...FLATLIST_TUNING}
        />
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer
      loading={loading && restaurants.length === 0}
      loadingSkeleton={
        <View style={[styles.skeletonWrap, listPaddingBottom()]}>
          <ListSkeleton count={5} variant="restaurant" />
        </View>
      }
      error={error}
      onRetry={refresh}
    >
      <FlatList
        data={filtered}
        keyExtractor={(item) => String(item.id)}
        contentContainerStyle={[styles.list, listPaddingBottom()]}
        onRefresh={refresh}
        refreshing={refreshing}
        onEndReached={loadMore}
        onEndReachedThreshold={0.3}
        ListHeaderComponent={header}
        ListFooterComponent={listFooter}
        renderItem={renderRestaurant}
        ListEmptyComponent={
          !loading ? (
            <EmptyState
              emoji="🍽️"
              title="Sin resultados"
              subtitle="Prueba otra búsqueda o categoría"
            />
          ) : null
        }
        {...FLATLIST_TUNING}
      />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  list: { paddingHorizontal: spacing.screen, flexGrow: 1 },
  skeletonWrap: { flex: 1, paddingHorizontal: spacing.screen, paddingTop: spacing.lg },
  hero: { marginHorizontal: -spacing.screen },
  searchWrap: { marginTop: spacing.lg },
  categories: { paddingVertical: spacing.lg, gap: spacing.sm, paddingRight: spacing.screen },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 24,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderLight,
    marginRight: spacing.sm,
  },
  chipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  chipEmoji: { fontSize: 15 },
  chipText: { fontSize: 14, fontWeight: '700', color: colors.textSecondary },
  chipTextActive: { color: '#FFF' },
  sectionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  sectionTitle: { fontSize: 20, fontWeight: '800', color: colors.text, letterSpacing: -0.3 },
  viewToggle: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 4,
    gap: 4,
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  toggleBtn: { padding: 8, borderRadius: 8 },
  toggleActive: { backgroundColor: colors.primary },
  mapFallback: { justifyContent: 'center', alignItems: 'center' },
  mapHint: {
    textAlign: 'center',
    color: colors.textSecondary,
    fontSize: 13,
    fontWeight: '600',
    marginTop: 10,
  },
  mapSubhint: {
    textAlign: 'center',
    color: colors.textMuted,
    fontSize: 12,
    marginBottom: 14,
  },
  mapListItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.surface,
    padding: 14,
    borderRadius: 12,
    marginBottom: spacing.sm,
  },
  mapListContent: { flex: 1 },
  mapListName: { fontSize: 15, fontWeight: '700', color: colors.text },
  mapListAddr: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
});
