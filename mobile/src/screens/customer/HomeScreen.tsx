import React, { useCallback } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';

import ActiveDeliveryStrip from '../../components/ActiveDeliveryStrip';
import HomeHero from '../../components/HomeHero';
import ResponsiveGrid from '../../components/ResponsiveGrid';
import ServiceSectionCard from '../../components/ServiceSectionCard';
import { useAuth } from '../../context/AuthContext';
import type { ActiveDeliveryItem } from '../../context/CustomerActiveDeliveriesContext';
import { useCustomerActiveDeliveries } from '../../context/CustomerActiveDeliveriesContext';
import type { HomeScreenProps } from '../../navigation/types';
import { useTabScreenInsets } from '../../hooks/useTabScreenInsets';
import { colors } from '../../theme/colors';
import { spacing } from '../../theme/spacing';

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

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refresh();
    setRefreshing(false);
  }, [refresh]);

  const handleDeliveryPress = (item: ActiveDeliveryItem) => {
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
          emoji="🍽️"
          colors={[colors.gradientStart, colors.gradientEnd]}
          badge={activeOrderCount}
          onPress={() => navigation.navigate('Comida')}
        />
        <ServiceSectionCard
          title="Servicios"
          subtitle="Peluquerías, talleres y más"
          emoji="💇"
          colors={[colors.serviceStart, colors.serviceEnd]}
          onPress={() => navigation.navigate('Servicios')}
        />
      </ResponsiveGrid>
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
