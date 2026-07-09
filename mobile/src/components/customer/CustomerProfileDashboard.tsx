import Ionicons from '@expo/vector-icons/Ionicons';
import { useNavigation } from '@react-navigation/native';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { CustomerTabParamList } from '../../navigation/types';
import { colors } from '../../theme/colors';
import { HIT_SLOP, spacing } from '../../theme/spacing';
import { cardShadow } from '../../theme/shadows';

interface Props {
  activeOrderCount?: number;
  address?: string | null;
  overlap?: boolean;
}

export default function CustomerProfileDashboard({ activeOrderCount = 0, address, overlap }: Props) {
  const navigation = useNavigation<BottomTabNavigationProp<CustomerTabParamList>>();
  const hasAddress = Boolean(address?.trim());

  return (
    <View style={[styles.card, overlap && styles.cardOverlap]}>
      <View style={styles.topRow}>
        <View style={styles.avatar}>
          <Ionicons name="person" size={26} color={colors.primary} />
        </View>
        <View style={styles.info}>
          <Text style={styles.title}>Tu cuenta ZinApp</Text>
          <Text style={styles.sub} numberOfLines={2}>
            {hasAddress ? address : 'Agrega tu dirección habitual para pedir más rápido'}
          </Text>
        </View>
      </View>

      <View style={styles.metrics}>
        <View style={styles.metric}>
          <Ionicons name="receipt-outline" size={18} color={colors.primary} />
          <Text style={styles.metricValue}>{activeOrderCount}</Text>
          <Text style={styles.metricLabel}>En curso</Text>
        </View>
        <View style={styles.metricDivider} />
        <View style={styles.metric}>
          <Ionicons name="location-outline" size={18} color={colors.primary} />
          <Text style={styles.metricValue}>{hasAddress ? '✓' : '—'}</Text>
          <Text style={styles.metricLabel}>Dirección</Text>
        </View>
        <View style={styles.metricDivider} />
        <View style={styles.metric}>
          <Ionicons name="heart-outline" size={18} color={colors.primary} />
          <Text style={styles.metricValue}>Local</Text>
          <Text style={styles.metricLabel}>Zinapécuaro</Text>
        </View>
      </View>

      <View style={styles.actions}>
        <Pressable
          style={styles.actionBtn}
          onPress={() => navigation.navigate('Pedidos')}
          hitSlop={HIT_SLOP}
        >
          <Ionicons name="time-outline" size={18} color={colors.primary} />
          <Text style={styles.actionText}>Mis pedidos</Text>
        </Pressable>
        <Pressable
          style={[styles.actionBtn, styles.actionBtnPrimary]}
          onPress={() => navigation.navigate('Inicio')}
          hitSlop={HIT_SLOP}
        >
          <Ionicons name="restaurant-outline" size={18} color="#FFF" />
          <Text style={[styles.actionText, styles.actionTextPrimary]}>Pedir comida</Text>
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
  info: { flex: 1, minWidth: 0, gap: 4 },
  title: { fontSize: 17, fontWeight: '800', color: colors.text },
  sub: { fontSize: 12, color: colors.textSecondary, lineHeight: 17, fontWeight: '500' },
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
    borderColor: '#BFDBFE',
  },
  actionBtnPrimary: { backgroundColor: colors.primary, borderColor: colors.primary },
  actionText: { fontSize: 13, fontWeight: '800', color: colors.primary },
  actionTextPrimary: { color: '#FFF' },
});
