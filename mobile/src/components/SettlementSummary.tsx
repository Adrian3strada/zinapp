import Ionicons from '@expo/vector-icons/Ionicons';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { settlementApi } from '../services/api';
import { colors } from '../theme/colors';
import { formatCurrency } from '../utils/format';
import type { SettlementSummary as SettlementData } from '../types';

interface Props {
  role: 'driver' | 'restaurant';
}

export default function SettlementSummary({ role }: Props) {
  const [data, setData] = useState<SettlementData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const res = role === 'driver'
          ? await settlementApi.driver()
          : await settlementApi.restaurant();
        setData(res.data);
      } catch {
        setData(null);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [role]);

  if (loading) {
    return <ActivityIndicator color={colors.primary} style={{ marginVertical: 12 }} />;
  }
  if (!data) return null;

  return (
    <View style={styles.wrap}>
      <View style={styles.header}>
        <Ionicons name="wallet-outline" size={20} color={colors.primary} />
        <Text style={styles.title}>Liquidación (7 días)</Text>
      </View>
      {role === 'driver' ? (
        <>
          <Text style={styles.row}>Entregas: {data.deliveries_count}</Text>
          <Text style={styles.row}>Envíos: {formatCurrency(String(data.delivery_fees))}</Text>
          <Text style={styles.row}>Propinas: {formatCurrency(String(data.tips))}</Text>
          <Text style={styles.total}>Total estimado: {formatCurrency(String(data.total_payout))}</Text>
        </>
      ) : (
        <>
          <Text style={styles.row}>Pedidos: {data.orders_count}</Text>
          <Text style={styles.row}>Ventas: {formatCurrency(String(data.food_sales))}</Text>
          <Text style={styles.row}>Descuentos: -{formatCurrency(String(data.discounts))}</Text>
          <Text style={styles.total}>Neto estimado: {formatCurrency(String(data.net_sales))}</Text>
        </>
      )}
      {typeof data.note === 'string' && (
        <Text style={styles.note}>{data.note}</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginTop: 12,
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    gap: 4,
  },
  header: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
  title: { fontSize: 15, fontWeight: '800', color: colors.text },
  row: { fontSize: 14, color: colors.textSecondary },
  total: { fontSize: 16, fontWeight: '800', color: colors.primary, marginTop: 6 },
  note: { fontSize: 11, color: colors.textMuted, marginTop: 8, lineHeight: 16 },
});
