import Ionicons from '@expo/vector-icons/Ionicons';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useCallback } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import ActiveDeliveryStrip from '../../components/ActiveDeliveryStrip';
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
        { paddingTop: insets.top + spacing.md, paddingBottom: insets.bottom + spacing.tabBar + spacing.lg },
      ]}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
      }
    >
      <LinearGradient
        colors={[colors.gradientStart, colors.gradientEnd]}
        style={styles.hero}
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
            onPress={() => navigation.navigate('Perfil')}
            style={styles.profileBtn}
            accessibilityLabel="Ir a mi perfil"
          >
            <Ionicons name="person-circle-outline" size={28} color="#FFF" />
          </Pressable>
        </View>
        <Text style={styles.heroTagline}>¿Qué necesitas hoy?</Text>
      </LinearGradient>

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
          subtitle="Cupones y promociones para ahorrar"
          emoji="🏷️"
          colors={['#E85D04', '#C44D00']}
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
          subtitle="Chico, mediano o grande · desde $25 en Zinapécuaro"
          emoji="📦"
          colors={['#2A9D8F', '#1F7268']}
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
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.lg,
    paddingBottom: spacing.xxl,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
  },
  heroTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  greeting: { fontSize: 22, fontWeight: '800', color: '#FFF' },
  locationRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 6 },
  location: { color: 'rgba(255,255,255,0.9)', fontSize: 14, fontWeight: '500' },
  profileBtn: { padding: 4, backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 12 },
  heroTagline: {
    fontSize: 15,
    color: 'rgba(255,255,255,0.85)',
    marginTop: spacing.lg,
    fontWeight: '600',
  },
  sections: { gap: spacing.lg },
  refreshError: {
    backgroundColor: colors.primaryLight,
    borderRadius: 10,
    padding: 10,
    marginTop: -8,
  },
  refreshErrorText: { fontSize: 12, color: colors.textSecondary, textAlign: 'center' },
});
