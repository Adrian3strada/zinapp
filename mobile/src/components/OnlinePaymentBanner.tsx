import Ionicons from '@expo/vector-icons/Ionicons';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Platform, StyleSheet, Text, View } from 'react-native';

import { colors } from '../theme/colors';
import { cardShadow } from '../theme/shadows';
import type { Order } from '../types';
import { formatCurrency } from '../utils/format';
import { openPaymentCheckout } from '../utils/webPlatform';
import { appAlert } from '../utils/appAlert';
import { useNativeStripePayment } from '../hooks/useNativeStripePayment';
import Button from './Button';
import StripeEmbeddedCheckout from './StripeEmbeddedCheckout';

interface Props {
  order: Order;
  onRefresh: () => void;
  onPay: () => Promise<{
    paymentUrl?: string | null;
    clientSecret?: string | null;
    paymentSheet?: boolean;
  } | null>;
  publishableKey?: string;
  autoStart?: boolean;
  onAutoStartHandled?: () => void;
}

export default function OnlinePaymentBanner({
  order,
  onRefresh,
  onPay,
  publishableKey = '',
  autoStart = false,
  onAutoStartHandled,
}: Props) {
  const [paying, setPaying] = useState(false);
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const { payWithSheet } = useNativeStripePayment();
  const autoStarted = useRef(false);

  const isOnline = order.payment_method === 'online';
  const isPaid = order.payment_status === 'paid';
  const isPending = isOnline && !isPaid && order.status !== 'cancelled';

  const handlePay = useCallback(async () => {
    setPaying(true);
    try {
      const result = await onPay();
      if (!result) return;

      if (Platform.OS === 'web' && result.clientSecret && publishableKey) {
        setClientSecret(result.clientSecret);
        return;
      }

      if (Platform.OS !== 'web' && result.clientSecret) {
        const paid = await payWithSheet(result.clientSecret);
        if (paid.ok) {
          onRefresh();
          return;
        }
        if (paid.message) {
          appAlert(paid.canceled ? 'Pago cancelado' : 'Pago', paid.message);
        }
        return;
      }

      if (result.paymentUrl) {
        try {
          const mode = await openPaymentCheckout(result.paymentUrl);
          if (mode === 'opened') onRefresh();
        } catch {
          appAlert('Pago', 'No se pudo abrir el pago. Intenta de nuevo.');
        }
      } else {
        appAlert('Pago', 'No se pudo iniciar el cobro. Intenta de nuevo.');
      }
    } finally {
      setPaying(false);
    }
  }, [onPay, onRefresh, payWithSheet, publishableKey]);

  useEffect(() => {
    if (!autoStart || !isPending || autoStarted.current || Platform.OS === 'web') {
      return;
    }
    autoStarted.current = true;
    onAutoStartHandled?.();
    void handlePay();
  }, [autoStart, isPending, handlePay, onAutoStartHandled]);

  if (!isOnline || (!isPending && !isPaid)) return null;

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
            : `Total ${formatCurrency(order.total)}. Paga con tarjeta para enviar el pedido al restaurante.`}
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
