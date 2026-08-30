import Ionicons from '@expo/vector-icons/Ionicons';
import React from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';

import { colors } from '../../theme/colors';
import { spacing } from '../../theme/spacing';
import { cardShadow } from '../../theme/shadows';
import type { Restaurant } from '../../types';
import { formatRestaurantSchedule } from '../../utils/restaurantMeta';
import { resolveMediaUrl } from '../../utils/media';
import { RESTAURANT_CATEGORY_LABELS } from '../../utils/restaurantCategories';

interface Props {
  restaurant: Restaurant;
  acceptingOrders: boolean;
  overlap?: boolean;
  canSwitch?: boolean;
  onPressSwitch?: () => void;
  canAdd?: boolean;
  onPressAdd?: () => void;
}

export default function RestaurantProfileDashboard({
  restaurant,
  acceptingOrders,
  overlap,
  canSwitch,
  onPressSwitch,
  canAdd,
  onPressAdd,
}: Props) {
  const imageUri = resolveMediaUrl(restaurant.image_url ?? restaurant.image);
  const categoryLabel = restaurant.category
    ? RESTAURANT_CATEGORY_LABELS[restaurant.category] ?? restaurant.category
    : null;
  const hours = formatRestaurantSchedule(restaurant);
  const setup = restaurant.setup_status;

  return (
    <View style={[styles.card, overlap && styles.cardOverlap, cardShadow]}>
      <View style={styles.topRow}>
        <View style={styles.logoWrap}>
          {imageUri ? (
            <Image source={{ uri: imageUri }} style={styles.logo} />
          ) : (
            <View style={styles.logoPlaceholder}>
              <Ionicons name="storefront" size={28} color={colors.primary} />
            </View>
          )}
        </View>
        <View style={styles.titleBlock}>
          <Pressable
            style={styles.nameRow}
            onPress={canSwitch ? onPressSwitch : undefined}
            disabled={!canSwitch}
            accessibilityRole={canSwitch ? 'button' : undefined}
            accessibilityLabel={canSwitch ? 'Cambiar de local' : undefined}
          >
            <Text style={styles.name} numberOfLines={2}>
              {restaurant.name}
            </Text>
            {canSwitch ? (
              <Ionicons name="chevron-down" size={18} color={colors.text} />
            ) : null}
          </Pressable>
          {categoryLabel ? <Text style={styles.meta}>{categoryLabel}</Text> : null}
          {hours ? (
            <View style={styles.hoursRow}>
              <Ionicons name="time-outline" size={14} color={colors.textMuted} />
              <Text style={styles.hoursText} numberOfLines={1}>
                {hours}
              </Text>
            </View>
          ) : null}
        </View>
      </View>

      <View style={styles.metrics}>
        <View style={styles.metric}>
          <Text style={styles.metricValue}>{restaurant.is_active ? 'Activo' : 'Pendiente'}</Text>
          <Text style={styles.metricLabel}>Cuenta</Text>
        </View>
        <View style={styles.metricDivider} />
        <View style={styles.metric}>
          <Text style={styles.metricValue}>
            {acceptingOrders && restaurant.is_active ? 'Abierto' : 'Cerrado'}
          </Text>
          <Text style={styles.metricLabel}>Pedidos</Text>
        </View>
        {setup ? (
          <>
            <View style={styles.metricDivider} />
            <View style={styles.metric}>
              <Text style={styles.metricValue}>
                {setup.done_count}/{setup.total_count}
              </Text>
              <Text style={styles.metricLabel}>Perfil</Text>
            </View>
          </>
        ) : null}
      </View>

      <View style={styles.toggleRow}>
        <View style={styles.toggleInfo}>
          <Text style={styles.toggleLabel}>Estado del local</Text>
          <Text style={styles.toggleHint}>
            {!restaurant.is_active
              ? 'Disponible cuando el equipo active tu local.'
              : 'Abre o cierra desde la pestaña Pedidos.'}
          </Text>
        </View>
        <Text
          style={[
            styles.statusHintText,
            { color: acceptingOrders && restaurant.is_active ? colors.success : colors.textMuted },
          ]}
        >
          {!restaurant.is_active ? 'Pendiente' : acceptingOrders ? 'Abierto' : 'Cerrado'}
        </Text>
      </View>
      {canAdd && onPressAdd ? (
        <Pressable
          style={styles.addBtn}
          onPress={onPressAdd}
          accessibilityRole="button"
          accessibilityLabel="Agregar otro local"
        >
          <Ionicons name="add-circle-outline" size={18} color={colors.primary} />
          <Text style={styles.addBtnText}>Agregar otro local</Text>
        </Pressable>
      ) : null}
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
    gap: 14,
    alignItems: 'center',
  },
  logoWrap: {
    width: 64,
    height: 64,
    borderRadius: 18,
    overflow: 'hidden',
    backgroundColor: colors.primaryLight,
  },
  logo: { width: '100%', height: '100%' },
  logoPlaceholder: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  titleBlock: { flex: 1, minWidth: 0, gap: 4 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  name: { flex: 1, fontSize: 18, fontWeight: '700', color: colors.text, letterSpacing: -0.2 },
  meta: { fontSize: 13, color: colors.textSecondary, fontWeight: '500' },
  hoursRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  hoursText: { flex: 1, fontSize: 12, color: colors.textMuted, fontWeight: '500' },
  metrics: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.lg,
    backgroundColor: colors.background,
    borderRadius: 16,
    paddingVertical: 12,
    paddingHorizontal: 8,
  },
  metric: { flex: 1, alignItems: 'center', gap: 2 },
  metricDivider: { width: StyleSheet.hairlineWidth, height: 28, backgroundColor: colors.border },
  metricValue: { fontSize: 15, fontWeight: '700', color: colors.text },
  metricLabel: { fontSize: 12, color: colors.textMuted, fontWeight: '600' },
  toggleRow: {
    marginTop: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingTop: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.borderLight,
  },
  toggleInfo: { flex: 1, minWidth: 0 },
  toggleLabel: { fontSize: 15, fontWeight: '700', color: colors.text },
  toggleHint: { fontSize: 12, color: colors.textSecondary, marginTop: 2, lineHeight: 17 },
  statusHintText: { fontSize: 13, fontWeight: '700' },
  addBtn: {
    marginTop: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingTop: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.borderLight,
  },
  addBtnText: { fontSize: 14, fontWeight: '700', color: colors.primary },
});
