import Ionicons from '@expo/vector-icons/Ionicons';
import { LinearGradient } from 'expo-linear-gradient';
import React, { Suspense, useCallback, useMemo, useState } from 'react';
import { ActivityIndicator } from 'react-native';
import {
  Alert,
  FlatList,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { MapMarker } from '../../components/AppMap';
import EmptyState from '../../components/EmptyState';
import ListFooter from '../../components/ListFooter';
import RestaurantCard from '../../components/RestaurantCard';
import ScreenContainer from '../../components/ScreenContainer';
import SearchField from '../../components/SearchField';
import { useAuth } from '../../context/AuthContext';
import { usePaginatedList } from '../../hooks/usePaginatedList';
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
  const insets = useSafeAreaInsets();
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState<RestaurantCategoryKey>(null);
  const [viewMode, setViewMode] = useState<'list' | 'map'>('list');

  const fetchPage = useCallback(async (page: number) => {
    const { data } = await restaurantApi.list(page);
    return data;
  }, []);

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
        r.description.toLowerCase().includes(search.toLowerCase());
      const matchCat = restaurantMatchesCategory(r, category);
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
        Alert.alert('Cerrado', `${restaurant.name} no está recibiendo pedidos en este momento.`);
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
        <LinearGradient
          colors={[colors.gradientStart, colors.gradientEnd]}
          style={[styles.hero, { paddingTop: insets.top + spacing.md }]}
        >
          <View style={styles.heroTop}>
            <View>
              <Text style={styles.greeting}>Hola, {user?.first_name || 'Cliente'} 👋</Text>
              <View style={styles.locationRow}>
                <Ionicons name="location" size={16} color="#FFF" />
                <Text style={styles.location}>Zinapécuaro, Mich.</Text>
              </View>
            </View>
            <Pressable
              onPress={() => navigation.navigate('Main', { screen: 'Perfil' })}
              style={styles.profileBtn}
              accessibilityLabel="Ir a mi perfil"
            >
              <Ionicons name="person-circle-outline" size={28} color="#FFF" />
            </Pressable>
          </View>

          <View style={styles.searchWrap}>
            <SearchField
              value={search}
              onChangeText={setSearch}
              placeholder="Buscar restaurantes o comida…"
            />
          </View>
        </LinearGradient>

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
              <Text style={[styles.chipText, category === cat.key && styles.chipTextActive]}>
                {cat.label}
              </Text>
            </Pressable>
          ))}
        </ScrollView>

        <View style={styles.sectionRow}>
          <Text style={styles.sectionTitle}>Restaurantes cerca de ti</Text>
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
      <ScreenContainer loading={loading && restaurants.length === 0} error={error} onRetry={refresh}>
        <FlatList
          data={filtered}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={styles.list}
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
    <ScreenContainer loading={loading && restaurants.length === 0} error={error} onRetry={refresh}>
      <FlatList
        data={filtered}
        keyExtractor={(item) => String(item.id)}
        contentContainerStyle={styles.list}
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
  list: { paddingHorizontal: spacing.screen, paddingBottom: spacing.xxl },
  hero: {
    marginHorizontal: -spacing.screen,
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.xxl,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
  },
  heroTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  greeting: { fontSize: 22, fontWeight: '800', color: '#FFF' },
  locationRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 6 },
  location: { color: 'rgba(255,255,255,0.9)', fontSize: 14, fontWeight: '500' },
  profileBtn: { padding: 4, backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 12 },
  searchWrap: { marginTop: spacing.xl },
  categories: { paddingVertical: spacing.lg, gap: spacing.sm },
  chip: {
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    marginRight: spacing.sm,
  },
  chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { fontSize: 14, fontWeight: '600', color: colors.textSecondary },
  chipTextActive: { color: '#FFF' },
  sectionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  sectionTitle: { fontSize: 18, fontWeight: '800', color: colors.text },
  viewToggle: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderRadius: 10,
    padding: 4,
    gap: 4,
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
