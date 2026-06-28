import Ionicons from '@expo/vector-icons/Ionicons';
import React, { useCallback, useEffect, useState } from 'react';
import { Linking, Platform, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';

import Button from '../../components/Button';
import ScreenContainer from '../../components/ScreenContainer';
import { useAuth } from '../../context/AuthContext';
import { adminApi } from '../../services/api';
import { colors } from '../../theme/colors';
import { spacing } from '../../theme/spacing';
import { cardShadow } from '../../theme/shadows';
import type { AdminStats } from '../../types';
import { getPanelLoginUrl } from '../../utils/panelUrl';

function StatCard({ label, value, icon }: { label: string; value: number; icon: keyof typeof Ionicons.glyphMap }) {
  return (
    <View style={[styles.stat, cardShadow]}>
      <Ionicons name={icon} size={22} color={colors.primary} />
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

export default function AdminHomeScreen() {
  const { logout } = useAuth();
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    const { data } = await adminApi.stats();
    setStats(data);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const openPanel = () => {
    const url = getPanelLoginUrl();
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      window.location.assign(url);
      return;
    }
    void Linking.openURL(url);
  };

  return (
    <ScreenContainer>
      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
        }
      >
        <Text style={styles.title}>Panel ZinApp</Text>
        <Text style={styles.subtitle}>Resumen de operación en tiempo real</Text>

        {stats && (
          <View style={styles.grid}>
            <StatCard label="Usuarios" value={stats.users} icon="people-outline" />
            <StatCard label="Restaurantes" value={stats.restaurants} icon="restaurant-outline" />
            <StatCard label="Activos" value={stats.restaurants_active ?? 0} icon="checkmark-circle-outline" />
            <StatCard label="Pendientes" value={stats.restaurants_pending ?? 0} icon="time-outline" />
            <StatCard label="Pedidos" value={stats.orders} icon="receipt-outline" />
            <StatCard label="En curso" value={stats.orders_active} icon="bicycle-outline" />
            <StatCard label="Pendientes" value={stats.orders_pending} icon="hourglass-outline" />
            <StatCard label="Cupones" value={stats.coupons} icon="pricetag-outline" />
            <StatCard label="Disputas" value={stats.disputes_pending ?? 0} icon="alert-circle-outline" />
          </View>
        )}

        <Button title="Abrir panel web completo" onPress={openPanel} size="lg" />
        <Pressable onPress={() => logout()} style={styles.logout}>
          <Text style={styles.logoutText}>Cerrar sesión</Text>
        </Pressable>
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  scroll: { padding: spacing.screen, gap: 16 },
  title: { fontSize: 24, fontWeight: '900', color: colors.text },
  subtitle: { fontSize: 14, color: colors.textSecondary, marginBottom: 8 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  stat: {
    width: '47%',
    backgroundColor: colors.surface,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.borderLight,
    gap: 4,
  },
  statValue: { fontSize: 22, fontWeight: '900', color: colors.text },
  statLabel: { fontSize: 12, color: colors.textMuted, fontWeight: '600' },
  logout: { alignItems: 'center', paddingVertical: 12 },
  logoutText: { color: colors.textMuted, fontSize: 14 },
});
