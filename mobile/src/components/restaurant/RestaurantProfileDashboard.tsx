import Ionicons from '@expo/vector-icons/Ionicons';
import { useNavigation } from '@react-navigation/native';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import React from 'react';
import { Image, Pressable, StyleSheet, Switch, Text, View } from 'react-native';

import type { RestaurantTabParamList } from '../../navigation/types';
import { colors } from '../../theme/colors';
import { HIT_SLOP, spacing } from '../../theme/spacing';
import { cardShadow } from '../../theme/shadows';
import type { Restaurant } from '../../types';
import { formatRestaurantHours } from '../../utils/restaurantMeta';
import { resolveMediaUrl } from '../../utils/media';
import { RESTAURANT_CATEGORY_LABELS } from '../../utils/restaurantCategories';

interface Props {
  restaurant: Restaurant;
  acceptingOrders: boolean;
  togglingOrders: boolean;
  onToggleAcceptingOrders: (value: boolean) => void;
  overlap?: boolean;
}

export default function RestaurantProfileDashboard({
  restaurant,
  acceptingOrders,
  togglingOrders,
  onToggleAcceptingOrders,
  overlap,
}: Props) {
  const navigation = useNavigation<BottomTabNavigationProp<RestaurantTabParamList>>();
  const imageUri = resolveMediaUrl(restaurant.image_url ?? restaurant.image);
  const hours = formatRestaurantHours(restaurant.opening_time, restaurant.closing_time);
  const category = RESTAURANT_CATEGORY_LABELS[restaurant.category ?? 'general'] ?? 'General';
  const setupProgress = restaurant.setup_status
    ? `${restaurant.setup_status.done_count}/${restaurant.setup_status.total_count}`
    : null;

  const statusLabel = !restaurant.is_active
    ? 'Pendiente de activación'
    : acceptingOrders
      ? 'Abierto a pedidos'
      : 'Pausado';

  const statusTone = !restaurant.is_active
    ? colors.warning
    : acceptingOrders
      ? colors.success
      : colors.textMuted;

  return (
    <View style={[styles.card, overlap && styles.cardOverlap]}>
      <View style={styles.topRow}>
        <View style={styles.logoWrap}>
          {imageUri ? (
            <Image source={{ uri: imageUri }} style={styles.logo} />
          ) : (
            <View style={styles.logoPlaceholder}>
              <Ionicons name="storefront-outline" size={32} color={colors.primary} />
            </View>
          )}
        </View>
        <View style={styles.info}>
          <Text style={styles.name} numberOfLines={2}>
            {restaurant.name}
          </Text>
          <Text style={styles.category}>{category}</Text>
          <View style={[styles.statusPill, { backgroundColor: statusTone + '18' }]}>
            <View style={[styles.statusDot, { backgroundColor: statusTone }]} />
            <Text style={[styles.statusText, { color: statusTone }]}>{statusLabel}</Text>
          </View>
        </View>
      </View>

      <View style={styles.metrics}>
        <View style={styles.metric}>
          <Ionicons name="fast-food-outline" size={18} color={colors.primary} />
          <Text style={styles.metricValue}>{restaurant.products_count}</Text>
          <Text style={styles.metricLabel}>Platillos</Text>
        </View>
        <View style={styles.metricDivider} />
        <View style={styles.metric}>
          <Ionicons name="time-outline" size={18} color={colors.primary} />
          <Text style={styles.metricValueSmall} numberOfLines={1}>
            {hours ?? 'Sin horario'}
          </Text>
          <Text style={styles.metricLabel}>Horario</Text>
        </View>
        {setupProgress ? (
          <>
            <View style={styles.metricDivider} />
            <View style={styles.metric}>
              <Ionicons name="construct-outline" size={18} color={colors.primary} />
              <Text style={styles.metricValue}>{setupProgress}</Text>
              <Text style={styles.metricLabel}>Perfil</Text>
            </View>
          </>
        ) : null}
      </View>

      <View style={styles.toggleRow}>
        <View style={styles.toggleInfo}>
          <Text style={styles.toggleLabel}>Recibiendo pedidos</Text>
          <Text style={styles.toggleHint}>
            {!restaurant.is_active
              ? 'Disponible cuando el equipo active tu local.'
              : acceptingOrders
                ? 'Los clientes pueden pedir ahora.'
                : 'Tu local aparece como cerrado.'}
          </Text>
        </View>
        <Switch
          value={acceptingOrders && restaurant.is_active}
          onValueChange={onToggleAcceptingOrders}
          disabled={togglingOrders || !restaurant.is_active}
          trackColor={{ true: colors.primary, false: colors.border }}
        />
      </View>

      <View style={styles.quickActions}>
        <Pressable
          style={styles.quickBtn}
          onPress={() => navigation.navigate('Pedidos')}
          hitSlop={HIT_SLOP}
        >
          <Ionicons name="receipt-outline" size={18} color={colors.primary} />
          <Text style={styles.quickBtnText}>Pedidos</Text>
        </Pressable>
        <Pressable
          style={styles.quickBtn}
          onPress={() => navigation.navigate('MiNegocio')}
          hitSlop={HIT_SLOP}
        >
          <Ionicons name="restaurant-outline" size={18} color={colors.primary} />
          <Text style={styles.quickBtnText}>Menú</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: 22,
    padding: spacing.lg,
    marginHorizontal: spacing.screen,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.borderLight,
    ...cardShadow,
  },
  cardOverlap: { marginTop: -36, zIndex: 2, elevation: 4 },
  topRow: {
    flexDirection: 'row',
    gap: spacing.md,
    alignItems: 'flex-start',
  },
  logoWrap: {
    width: 72,
    height: 72,
    borderRadius: 18,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
  },
  logo: { width: '100%', height: '100%', resizeMode: 'cover' },
  logoPlaceholder: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  info: { flex: 1, minWidth: 0, gap: 4 },
  name: { fontSize: 20, fontWeight: '800', color: colors.text, letterSpacing: -0.3 },
  category: { fontSize: 13, color: colors.textSecondary, fontWeight: '600' },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
    marginTop: 4,
  },
  statusDot: { width: 7, height: 7, borderRadius: 4 },
  statusText: { fontSize: 11, fontWeight: '800' },
  metrics: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.lg,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.borderLight,
  },
  metric: { flex: 1, alignItems: 'center', gap: 2, paddingHorizontal: 4 },
  metricDivider: { width: 1, height: 44, backgroundColor: colors.borderLight },
  metricValue: { fontSize: 18, fontWeight: '800', color: colors.text, marginTop: 2 },
  metricValueSmall: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.text,
    marginTop: 4,
    textAlign: 'center',
  },
  metricLabel: { fontSize: 10, color: colors.textMuted, fontWeight: '600' },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.background,
    borderRadius: 14,
    padding: spacing.md,
    marginTop: spacing.md,
    gap: 12,
  },
  toggleInfo: { flex: 1 },
  toggleLabel: { fontSize: 15, fontWeight: '700', color: colors.text },
  toggleHint: { fontSize: 12, color: colors.textSecondary, marginTop: 2, lineHeight: 17 },
  quickActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: spacing.md,
  },
  quickBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: colors.primaryLight,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.primary + '22',
  },
  quickBtnText: { fontSize: 13, fontWeight: '700', color: colors.primary },
});
