import React, { useMemo } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { loadStripe } from '@stripe/stripe-js';
import { EmbeddedCheckout, EmbeddedCheckoutProvider } from '@stripe/react-stripe-js';

import { colors } from '../theme/colors';

interface Props {
  clientSecret: string;
  publishableKey: string;
}

/** Stripe Embedded Checkout (solo web). */
export default function StripeEmbeddedCheckout({ clientSecret, publishableKey }: Props) {
  const stripePromise = useMemo(
    () => (publishableKey ? loadStripe(publishableKey) : null),
    [publishableKey],
  );

  if (!stripePromise || !clientSecret) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator color={colors.primary} />
        <Text style={styles.hint}>Preparando pago…</Text>
      </View>
    );
  }

  return (
    <View style={styles.wrap}>
      <Text style={styles.title}>Paga con tarjeta</Text>
      <View style={styles.embed}>
        <EmbeddedCheckoutProvider stripe={stripePromise} options={{ clientSecret }}>
          <EmbeddedCheckout />
        </EmbeddedCheckoutProvider>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 10, paddingBottom: 24 },
  title: { fontSize: 20, fontWeight: '900', color: colors.text },
  embed: {
    minHeight: 420,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: colors.surface,
  },
  loading: { alignItems: 'center', gap: 10, paddingVertical: 40 },
  hint: { fontSize: 14, fontWeight: '600', color: colors.textSecondary },
});
