import Ionicons from '@expo/vector-icons/Ionicons';
import React, { useState } from 'react';
import { ActivityIndicator, Linking, StyleSheet, Text, View } from 'react-native';

import { colors } from '../theme/colors';
import { cardShadow } from '../theme/shadows';
import type { Order } from '../types';
import { formatCurrency } from '../utils/format';
import Button from './Button';

interface Props {
  order: Order;
  onRefresh: () => void;
  onPay: () => Promise<string | null>;
}

export default function OnlinePaymentBanner({ order, onRefresh, onPay }: Props) {
  const [paying, setPaying] = useState(false);

  if (order.payment_method !== 'online') return null;

  const isPaid = order.payment_status === 'paid';
  const isPending = !isPaid && order.status !== 'cancelled';

  if (!isPending && !isPaid) return null;

  const handlePay = async () => {
    setPaying(true);
    try {
      const url = await onPay();
      if (url) {
        await Linking.openURL(url);
        onRefresh();
      }
    } finally {
      setPaying(false);
    }
  };

  return (
    <View style={[styles.banner, isPaid ? styles.paid : styles.pending]}>
      <Ionicons
        name={isPaid ? 'checkmark-circle' : 'card-outline'}
        size={28}
        color={isPaid ? colors.success : colors.primary}
      />
      <View style={styles.body}>
        <Text style={styles.title}>
          {isPaid ? 'Pago en línea confirmado' : 'Pago en línea pendiente'}
        </Text>
        <Text style={styles.sub}>
          {isPaid
            ? 'El restaurante puede preparar tu pedido.'
            : `Total ${formatCurrency(order.total)}. Completa el pago para que el restaurante confirme.`}
        </Text>
        {isPending && (
          <Button
            title={paying ? 'Abriendo Mercado Pago…' : 'Pagar ahora'}
            onPress={handlePay}
            disabled={paying}
            size="md"
            style={styles.btn}
          />
        )}
        {paying && <ActivityIndicator color={colors.primary} style={styles.spinner} />}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    gap: 12,
    marginHorizontal: 16,
    marginTop: 12,
    padding: 16,
    borderRadius: 14,
    backgroundColor: colors.surface,
    borderWidth: 1,
    ...cardShadow,
  },
  pending: { borderColor: colors.primary },
  paid: { borderColor: colors.success },
  body: { flex: 1, gap: 6 },
  title: { fontSize: 15, fontWeight: '800', color: colors.text },
  sub: { fontSize: 13, color: colors.textSecondary, lineHeight: 19 },
  btn: { alignSelf: 'flex-start', marginTop: 4 },
  spinner: { marginTop: 4 },
});
