import Ionicons from '@expo/vector-icons/Ionicons';
import React, { useCallback, useEffect, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';

import ScreenContainer from '../../components/ScreenContainer';
import ListSkeleton from '../../components/ListSkeleton';
import { adminApi } from '../../services/api';
import { getApiErrorMessage } from '../../utils/apiErrors';
import { useTabScreenInsets } from '../../hooks/useTabScreenInsets';
import { colors } from '../../theme/colors';
import { cardShadow } from '../../theme/shadows';
import type { AdminStats } from '../../types';

const STAT_ITEMS: { key: keyof AdminStats; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { key: 'users', label: 'Usuarios', icon: 'people' },
  { key: 'restaurants', label: 'Restaurantes', icon: 'restaurant' },
  { key: 'orders', label: 'Pedidos totales', icon: 'receipt' },
  { key: 'orders_pending', label: 'Pendientes', icon: 'time' },
  { key: 'orders_active', label: 'Activos', icon: 'bicycle' },
  { key: 'coupons', label: 'Cupones activos', icon: 'pricetag' },
];

export default function AdminDashboardScreen() {
  const { scrollPaddingBottom } = useTabScreenInsets();
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    else setRefreshing(true);
    setError(null);
    try {
      const { data } = await adminApi.stats();
      setStats(data);
    } catch (err) {
      setError(getApiErrorMessage(err, 'No se pudieron cargar las estadísticas'));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <ScreenContainer
      loading={loading && !stats}
      loadingSkeleton={
        <ScrollView contentContainerStyle={[styles.container, scrollPaddingBottom()]}>
          <View style={styles.titleBone} />
          <View style={styles.subtitleBone} />
          <ListSkeleton variant="stat" />
        </ScrollView>
      }
      error={error}
      onRetry={load}
    >
      <ScrollView
        contentContainerStyle={[styles.container, scrollPaddingBottom()]}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor={colors.primary} />
        }
      >
        <Text style={styles.title}>Panel administrador</Text>
        <Text style={styles.subtitle}>ZinApp · Zinapécuaro</Text>
        <View style={styles.grid}>
          {STAT_ITEMS.map(({ key, label, icon }) => (
            <View key={key} style={styles.statCard}>
              <Ionicons name={icon} size={24} color={colors.primary} />
              <Text style={styles.statValue}>{stats?.[key] ?? '—'}</Text>
              <Text style={styles.statLabel}>{label}</Text>
            </View>
          ))}
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, flexGrow: 1 },
  title: { fontSize: 24, fontWeight: '800', color: colors.text },
  titleBone: {
    width: 220,
    height: 28,
    borderRadius: 8,
    backgroundColor: colors.borderLight,
    marginBottom: 8,
  },
  subtitle: { color: colors.textSecondary, marginBottom: 20 },
  subtitleBone: {
    width: 160,
    height: 16,
    borderRadius: 8,
    backgroundColor: colors.borderLight,
    marginBottom: 20,
  },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  statCard: {
    width: '47%',
    backgroundColor: colors.surface,
    borderRadius: 22,
    padding: 16,
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderColor: colors.borderLight,
    ...cardShadow,
  },
  statValue: { fontSize: 28, fontWeight: '800', color: colors.text },
  statLabel: { fontSize: 12, color: colors.textSecondary, textAlign: 'center' },
});
