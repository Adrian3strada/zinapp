import Ionicons from '@expo/vector-icons/Ionicons';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, InteractionManager, StyleSheet, Text, View } from 'react-native';

import { useStreetRoute } from '../hooks/useStreetRoutes';
import { colors } from '../theme/colors';
import { formatRouteSummary } from '../utils/format';
import type { MapCoordinate } from '../utils/maps';

interface Props {
  from: MapCoordinate | null;
  to: MapCoordinate | null;
  label?: string;
  dynamic?: boolean;
}

export default function DeliveryEtaBanner({
  from,
  to,
  label = 'Tiempo estimado',
  dynamic = true,
}: Props) {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const task = InteractionManager.runAfterInteractions(() => setReady(true));
    return () => task.cancel();
  }, []);

  const { stats, loading } = useStreetRoute(ready ? from : null, ready ? to : null, { dynamic });

  if (!ready) return null;

  if (loading) {
    return (
      <View style={styles.banner}>
        <ActivityIndicator size="small" color={colors.primary} />
        <Text style={styles.loadingText}>Calculando ruta…</Text>
      </View>
    );
  }

  if (!stats?.distanceMeters || !stats.durationSeconds) return null;

  return (
    <View style={styles.banner}>
      <Ionicons name="time-outline" size={20} color={colors.primary} />
      <View style={styles.body}>
        <Text style={styles.label}>{label}</Text>
        <Text style={styles.value}>
          {formatRouteSummary(stats.distanceMeters, stats.durationSeconds)}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: colors.primaryLight,
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
  },
  body: { flex: 1 },
  label: { fontSize: 11, fontWeight: '700', color: colors.textMuted, textTransform: 'uppercase' },
  value: { fontSize: 15, fontWeight: '800', color: colors.primary, marginTop: 2 },
  loadingText: { fontSize: 13, color: colors.textSecondary, fontWeight: '600' },
});
