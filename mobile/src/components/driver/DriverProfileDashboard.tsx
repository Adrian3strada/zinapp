import Ionicons from '@expo/vector-icons/Ionicons';
import { useNavigation } from '@react-navigation/native';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import React from 'react';
import { Pressable, StyleSheet, Switch, Text, View } from 'react-native';

import type { DriverTabParamList } from '../../navigation/types';
import { colors } from '../../theme/colors';
import { HIT_SLOP, spacing } from '../../theme/spacing';
import { cardShadow } from '../../theme/shadows';
import type { DeliveryProfile } from '../../types';
import { formatCurrency } from '../../utils/format';
import { VEHICLE_OPTIONS } from '../../constants/vehicleTypes';

interface EarningsSummary {
  week_deliveries: number;
  week_earnings: string;
}

interface Props {
  profile: DeliveryProfile | null;
  earnings: EarningsSummary | null;
  updating: boolean;
  onToggleAvailability: (value: boolean) => void;
  /** Si se pasa, manda sobre profile.is_available (fuente de verdad del contexto). */
  isAvailable?: boolean;
  overlap?: boolean;
}

export default function DriverProfileDashboard({
  profile,
  earnings,
  updating,
  onToggleAvailability,
  isAvailable: isAvailableProp,
  overlap,
}: Props) {
  const navigation = useNavigation<BottomTabNavigationProp<DriverTabParamList>>();
  const isAvailable = isAvailableProp ?? profile?.is_available ?? false;
  const isApproved = profile?.verification_status === 'approved';
  const vehicleLabel = profile?.vehicle_type
    ? VEHICLE_OPTIONS.find((v) => v.value === profile.vehicle_type)?.label ?? profile.vehicle_type
    : 'Sin vehículo';

  return (
    <View style={[styles.card, overlap && styles.cardOverlap]}>
      <View style={styles.topRow}>
        <View style={styles.avatar}>
          <Ionicons name="bicycle" size={28} color={colors.primaryDark} />
        </View>
        <View style={styles.info}>
          <Text style={styles.title}>Tu panel de entregas</Text>
          <Text style={styles.sub}>{vehicleLabel}{profile?.license_plate ? ` · ${profile.license_plate}` : ''}</Text>
          <View style={[styles.statusPill, isAvailable ? styles.statusOnline : styles.statusOffline]}>
            <View style={[styles.statusDot, { backgroundColor: isAvailable ? colors.success : colors.textMuted }]} />
            <Text style={[styles.statusText, { color: isAvailable ? colors.success : colors.textMuted }]}>
              {!isApproved ? 'Pendiente de aprobación' : isAvailable ? 'Disponible' : 'Fuera de línea'}
            </Text>
          </View>
        </View>
        <Switch
          value={isAvailable}
          onValueChange={onToggleAvailability}
          disabled={updating || !isApproved}
          trackColor={{ false: colors.border, true: colors.primary + '55' }}
          thumbColor={isAvailable ? colors.primary : colors.textMuted}
        />
      </View>

      <View style={styles.metrics}>
        <View style={styles.metric}>
          <Ionicons name="wallet-outline" size={18} color={colors.primaryDark} />
          <Text style={styles.metricValue}>
            {earnings ? formatCurrency(earnings.week_earnings) : '$0.00'}
          </Text>
          <Text style={styles.metricLabel}>Esta semana</Text>
        </View>
        <View style={styles.metricDivider} />
        <View style={styles.metric}>
          <Ionicons name="checkmark-done-outline" size={18} color={colors.primaryDark} />
          <Text style={styles.metricValue}>{earnings?.week_deliveries ?? 0}</Text>
          <Text style={styles.metricLabel}>Entregas</Text>
        </View>
        <View style={styles.metricDivider} />
        <View style={styles.metric}>
          <Ionicons name="navigate-outline" size={18} color={colors.primaryDark} />
          <Text style={styles.metricValue}>{isAvailable ? 'ON' : 'OFF'}</Text>
          <Text style={styles.metricLabel}>GPS activo</Text>
        </View>
      </View>

      <View style={styles.actions}>
        <Pressable
          style={styles.actionBtn}
          onPress={() => navigation.navigate('Inicio')}
          hitSlop={HIT_SLOP}
        >
          <Ionicons name="map-outline" size={18} color={colors.primaryDark} />
          <Text style={styles.actionText}>Inicio</Text>
        </Pressable>
        <Pressable
          style={[styles.actionBtn, styles.actionBtnPrimary]}
          onPress={() => navigation.navigate('Entregas')}
          hitSlop={HIT_SLOP}
        >
          <Ionicons name="bicycle-outline" size={18} color="#FFF" />
          <Text style={[styles.actionText, styles.actionTextPrimary]}>Mis entregas</Text>
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
  topRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: spacing.md },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 18,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  info: { flex: 1, minWidth: 0, gap: 2 },
  title: { fontSize: 17, fontWeight: '800', color: colors.text },
  sub: { fontSize: 12, color: colors.textSecondary, fontWeight: '600' },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 6,
    marginTop: 4,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
  },
  statusOnline: { backgroundColor: colors.success + '14' },
  statusOffline: { backgroundColor: colors.background },
  statusDot: { width: 7, height: 7, borderRadius: 4 },
  statusText: { fontSize: 11, fontWeight: '800' },
  metrics: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.background,
    borderRadius: 16,
    padding: 12,
    marginBottom: spacing.md,
  },
  metric: { flex: 1, alignItems: 'center', gap: 2 },
  metricDivider: { width: 1, height: 36, backgroundColor: colors.border },
  metricValue: { fontSize: 16, fontWeight: '800', color: colors.text, marginTop: 2 },
  metricLabel: { fontSize: 10, color: colors.textMuted, fontWeight: '700' },
  actions: { flexDirection: 'row', gap: 10 },
  actionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    borderRadius: 14,
    backgroundColor: colors.primaryLight,
    borderWidth: 1,
    borderColor: colors.primary + '55',
  },
  actionBtnPrimary: { backgroundColor: colors.primary, borderColor: colors.primary },
  actionText: { fontSize: 13, fontWeight: '800', color: colors.primaryDark },
  actionTextPrimary: { color: '#FFF' },
});
