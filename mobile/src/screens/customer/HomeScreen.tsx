import React, { useCallback } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import ActiveDeliveryStrip from '../../components/ActiveDeliveryStrip';
import HomeHero from '../../components/HomeHero';
import ServiceSectionCard from '../../components/ServiceSectionCard';
import { useAuth } from '../../context/AuthContext';
import type { ActiveDeliveryItem } from '../../context/CustomerActiveDeliveriesContext';
import { useCustomerActiveDeliveries } from '../../context/CustomerActiveDeliveriesContext';
import type { HomeScreenProps } from '../../navigation/types';
import { colors } from '../../theme/colors';
import { spacing } from '../../theme/spacing';

export default function HomeScreen({ navigation }: HomeScreenProps) {
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const {
    activeOrderCount,
    activeShipmentCount,
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
    if (item.kind === 'order') {
      navigation.navigate('OrderDetail', { orderId: item.id });
    } else {
      navigation.navigate('ShipmentDetail', { shipmentId: item.id });
    }
  };

  const stripItems = liveItems.length > 0 ? liveItems : trackingItems.slice(0, 3);

  return (
    <ScrollView
      contentContainerStyle={[
        styles.container,
        { paddingBottom: insets.bottom + spacing.tabBar + spacing.lg },
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
        style={styles.hero}
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

      <View style={styles.sections}>
        <ServiceSectionCard
          title="Ofertas"
          subtitle="Cupones y promos para ahorrar"
          emoji="🏷️"
          colors={['#EA580C', '#C2410C']}
          onPress={() => navigation.navigate('Ofertas')}
        />
        <ServiceSectionCard
          title="Comida"
          subtitle="Restaurantes y delivery a domicilio"
          emoji="🍽️"
          colors={[colors.gradientStart, colors.gradientEnd]}
          badge={activeOrderCount}
          onPress={() => navigation.navigate('Comida')}
        />
        <ServiceSectionCard
          title="Envíos"
          subtitle="Chico, mediano o grande · desde $25"
          emoji="📦"
          colors={['#0D9488', '#0F766E']}
          badge={activeShipmentCount}
          onPress={() => navigation.navigate('Envios')}
        />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    backgroundColor: colors.background,
    paddingHorizontal: spacing.screen,
    gap: spacing.lg,
  },
  hero: {
    marginHorizontal: -spacing.screen,
  },
  tagline: {
    fontSize: 16,
    color: 'rgba(255,255,255,0.9)',
    marginTop: spacing.lg,
    fontWeight: '600',
  },
  sections: { gap: spacing.md, marginTop: spacing.xs },
  refreshError: {
    backgroundColor: colors.primaryLight,
    borderRadius: 14,
    padding: 12,
  },
  refreshErrorText: { fontSize: 12, color: colors.textSecondary, textAlign: 'center', fontWeight: '600' },
});
