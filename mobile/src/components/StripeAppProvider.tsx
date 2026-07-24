import React from 'react';
import { StripeProvider } from '@stripe/stripe-react-native';

import { useAppConfig } from '../hooks/useAppConfig';

/**
 * Stripe nativo (Payment Sheet).
 * Mantiene el provider montado cuando hay publishable key del API.
 */
export default function StripeAppProvider({ children }: { children: React.ReactElement }) {
  const { config, loading } = useAppConfig();
  const key = (config.stripe_publishable_key || '').trim();

  if (loading && !key) {
    return children;
  }

  if (!key) {
    return children;
  }

  return (
    <StripeProvider publishableKey={key} urlScheme="zinapp">
      {children}
    </StripeProvider>
  );
}
