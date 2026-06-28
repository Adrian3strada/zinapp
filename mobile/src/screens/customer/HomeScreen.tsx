import React, { useCallback, useEffect, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';

import ActiveDeliveryStrip from '../../components/ActiveDeliveryStrip';
import FeaturedServicesStrip from '../../components/FeaturedServicesStrip';
import HomeHero from '../../components/HomeHero';
import ResponsiveGrid from '../../components/ResponsiveGrid';
import ServiceSectionCard from '../../components/ServiceSectionCard';
import { useAuth } from '../../context/AuthContext';
import type { ActiveDeliveryItem } from '../../context/CustomerActiveDeliveriesContext';
import { useCustomerActiveDeliveries } from '../../context/CustomerActiveDeliveriesContext';
import type { HomeScreenProps } from '../../navigation/types';
import { useTabScreenInsets } from '../../hooks/useTabScreenInsets';
import { localServiceApi } from '../../services/api';
import { colors } from '../../theme/colors';
import { spacing } from '../../theme/spacing';
import type { LocalService } from '../../types';

const FEATURED_COUNT = 3;

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

  const loadFeatured = useCallback(async () => {
    try {
      const { data } = await localServiceApi.list();
      setFeaturedServices(data.slice(0, FEATURED_COUNT));
    } catch {
      setFeaturedServices([]);
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
    if (item.kind === 'shipment') {
      navigation.navigate('ShipmentDetail', { shipmentId: item.id });
      return;
    }
    navigation.navigate('OrderDetail', { orderId: item.id });
  };

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
        topInset={insets.top}
        onProfilePress={() => navigation.navigate('Perfil')}
        style={[styles.hero, { marginHorizontal: -pagePadding }]}
      >
        <Text style={styles.tagline}>¿Qué necesitas hoy?</Text>
      </HomeHero>

      {stripItems.length > 0 && (
        <ActiveDeliveryStrip items={stripItems} onPress={handleDeliveryPress} />
      )}

      {refreshError && (
        <Pressable style={styles.refreshError} onPress={onRefresh}>
          <Text style={styles.refreshErrorText}>{refreshError} · Toca para reintentar</Text>
        </Pressable>
      )}

      <ResponsiveGrid style={styles.sections}>
        <ServiceSectionCard
          title="Comida"
          subtitle="Locales de tu ciudad"
          icon="restaurant"
          colors={[colors.gradientStart, colors.gradientEnd]}
          badge={activeOrderCount}
          onPress={() => navigation.navigate('Comida')}
        />
        <ServiceSectionCard
          title="Ofertas"
          subtitle="Cupones y promociones"
          icon="pricetag-outline"
          colors={['#F59E0B', '#D97706']}
          onPress={() => navigation.navigate('Ofertas')}
        />
        <ServiceSectionCard
          title="Envíos"
          subtitle="Manda paquetes locales"
          icon="cube-outline"
          colors={['#2A9D8F', '#264653']}
          onPress={() => navigation.navigate('Shipments')}
        />
        <ServiceSectionCard
          title="Servicios"
          subtitle="Peluquerías, talleres y más"
          icon="storefront-outline"
          colors={[colors.serviceStart, colors.serviceEnd]}
          onPress={() => navigation.navigate('Servicios')}
        />
      </ResponsiveGrid>

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
    gap: spacing.lg,
  },
  hero: {},
  tagline: {
    fontSize: 16,
    color: 'rgba(255,255,255,0.9)',
    marginTop: spacing.lg,
    fontWeight: '600',
  },
  sections: { marginTop: spacing.xs },
  refreshError: {
    backgroundColor: colors.primaryLight,
    borderRadius: 14,
    padding: 12,
  },
  refreshErrorText: { fontSize: 12, color: colors.textSecondary, textAlign: 'center', fontWeight: '600' },
});
