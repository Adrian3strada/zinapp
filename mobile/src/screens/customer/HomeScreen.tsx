import React, { useCallback, useEffect, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';

import ActiveDeliveryStrip from '../../components/ActiveDeliveryStrip';
import FeaturedDishesStrip from '../../components/FeaturedDishesStrip';
import FeaturedServicesStrip from '../../components/FeaturedServicesStrip';
import HomeHero from '../../components/HomeHero';
import ServiceSectionCard from '../../components/ServiceSectionCard';
import { useAuth } from '../../context/AuthContext';
import type { ActiveDeliveryItem } from '../../context/CustomerActiveDeliveriesContext';
import { useCustomerActiveDeliveries } from '../../context/CustomerActiveDeliveriesContext';
import type { HomeScreenProps } from '../../navigation/types';
import { useTabScreenInsets } from '../../hooks/useTabScreenInsets';
import { localServiceApi, productApi } from '../../services/api';
import { colors } from '../../theme/colors';
import { spacing } from '../../theme/spacing';
import type { LocalService, Product } from '../../types';
import { resolveMediaUrl } from '../../utils/media';

const FEATURED_COUNT = 3;
const FEATURED_DISHES_COUNT = 8;

export default function HomeScreen({ navigation }: HomeScreenProps) {
  const { user } = useAuth();
  const { insets, scrollPaddingBottom, pagePadding } = useTabScreenInsets();
  const {
    activeOrderCount,
    liveItems,
    trackingItems,
    refreshError,
    refresh,
  } = useCustomerActiveDeliveries();
  const [refreshing, setRefreshing] = React.useState(false);
  const [featuredServices, setFeaturedServices] = useState<LocalService[]>([]);
  const [featuredDishes, setFeaturedDishes] = useState<Product[]>([]);

  const loadFeatured = useCallback(async () => {
    const [servicesResult, dishesResult] = await Promise.allSettled([
      localServiceApi.list(),
      productApi.featured(FEATURED_DISHES_COUNT),
    ]);
    if (servicesResult.status === 'fulfilled') {
      setFeaturedServices(servicesResult.value.data.slice(0, FEATURED_COUNT));
    } else {
      setFeaturedServices([]);
    }
    if (dishesResult.status === 'fulfilled') {
      setFeaturedDishes(dishesResult.value.data);
    } else {
      setFeaturedDishes([]);
    }
  }, []);

  useEffect(() => {
    loadFeatured();
  }, [loadFeatured]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([refresh(), loadFeatured()]);
    setRefreshing(false);
  }, [refresh, loadFeatured]);

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

  return (
    <ScrollView
      contentContainerStyle={[
        styles.container,
        { paddingHorizontal: pagePadding },
        scrollPaddingBottom(),
      ]}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
      }
    >
      <HomeHero
        firstName={user?.first_name}
        avatarUrl={resolveMediaUrl(user?.avatar_url ?? user?.avatar)}
        topInset={insets.top}
        onProfilePress={() =>
          navigation.navigate('Main', { screen: 'Perfil' })
        }
        style={[styles.hero, { marginHorizontal: -pagePadding }]}
      />

      {stripItems.length > 0 && (
        <ActiveDeliveryStrip items={stripItems} onPress={handleDeliveryPress} />
      )}

      {refreshError && (
        <Pressable style={styles.refreshError} onPress={onRefresh}>
          <Text style={styles.refreshErrorText}>{refreshError} · Toca para reintentar</Text>
        </Pressable>
      )}

      <View style={styles.quickActionsCard}>
        <Text style={styles.quickActionsTitle}>¿Qué necesitas?</Text>
        <View style={styles.sections}>
          <ServiceSectionCard
            title="Comida"
            icon="restaurant"
            colors={[colors.gradientStart, colors.gradientEnd]}
            badge={activeOrderCount}
            onPress={() => navigation.navigate('Comida')}
          />
          <ServiceSectionCard
            title="Ofertas"
            icon="pricetag-outline"
            colors={['#F59E0B', '#D97706']}
            onPress={() => navigation.navigate('Ofertas')}
          />
          <ServiceSectionCard
            title="Servicios"
            icon="storefront-outline"
            colors={[colors.serviceStart, colors.serviceEnd]}
            onPress={() => navigation.navigate('Servicios')}
          />
        </View>
      </View>

      <FeaturedDishesStrip
        products={featuredDishes}
        onPressProduct={handleDishPress}
        onPressSeeAll={() => navigation.navigate('Comida')}
      />

      <FeaturedServicesStrip
        services={featuredServices}
        onPressService={() => navigation.navigate('Servicios')}
        onPressSeeAll={() => navigation.navigate('Servicios')}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    backgroundColor: colors.background,
    gap: spacing.md,
  },
  hero: {
    paddingBottom: spacing.xl,
  },
  quickActionsCard: {
    backgroundColor: colors.surface,
    borderRadius: 20,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.borderLight,
    marginTop: -spacing.sm,
  },
  quickActionsTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: colors.text,
    marginBottom: spacing.xs,
    paddingHorizontal: spacing.xs,
  },
  sections: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  refreshError: {
    backgroundColor: colors.primaryLight,
    borderRadius: 14,
    padding: 12,
  },
  refreshErrorText: { fontSize: 12, color: colors.textSecondary, textAlign: 'center', fontWeight: '600' },
});
