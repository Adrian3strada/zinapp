import Ionicons from '@expo/vector-icons/Ionicons';
import React, { useState } from 'react';
import { ActivityIndicator, Platform, StyleSheet, Text, View } from 'react-native';

import { colors } from '../theme/colors';
import { cardShadow } from '../theme/shadows';
import type { Order } from '../types';
import { formatCurrency } from '../utils/format';
import { openPaymentCheckout } from '../utils/webPlatform';
import Button from './Button';
import StripeEmbeddedCheckout from './StripeEmbeddedCheckout';

interface Props {
  order: Order;
  onRefresh: () => void;
  onPay: () => Promise<{ paymentUrl?: string | null; clientSecret?: string | null } | null>;
  publishableKey?: string;
}

export default function OnlinePaymentBanner({
  order,
  onRefresh,
  onPay,
  publishableKey = '',
}: Props) {
  const [paying, setPaying] = useState(false);
  const [clientSecret, setClientSecret] = useState<string | null>(null);

  if (order.payment_method !== 'online') return null;

  const isPaid = order.payment_status === 'paid';
  const isPending = !isPaid && order.status !== 'cancelled';

  if (!isPending && !isPaid) return null;

  const handlePay = async () => {
    setPaying(true);
    try {
      const result = await onPay();
      if (!result) return;
      if (Platform.OS === 'web' && result.clientSecret && publishableKey) {
        setClientSecret(result.clientSecret);
        return;
      }
      if (result.paymentUrl) {
        const mode = await openPaymentCheckout(result.paymentUrl);
        if (mode === 'opened') onRefresh();
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
            ? 'ZinApp ya recibió tu pago. El restaurante puede preparar tu pedido.'
            : `Total ${formatCurrency(order.total)}. El cobro lo recibe ZinApp. Completa el pago con tarjeta.`}
        </Text>
        {isPending && clientSecret && publishableKey ? (
          <StripeEmbeddedCheckout clientSecret={clientSecret} publishableKey={publishableKey} />
        ) : null}
        {isPending && !clientSecret && (
          <Button
            title={paying ? 'Abriendo pago…' : 'Pagar con tarjeta'}
            onPress={handlePay}
            disabled={paying}
            size="md"
            style={styles.btn}
          />
        )}
        {paying && !clientSecret && (
          <ActivityIndicator color={colors.primary} style={styles.spinner} />
        )}
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
