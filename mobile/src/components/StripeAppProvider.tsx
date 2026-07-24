import React from 'react';
import { StripeProvider } from '@stripe/stripe-react-native';

import { useAppConfig } from '../hooks/useAppConfig';

/** Stripe nativo (Payment Sheet). En web se usa el stub .web.tsx. */
export default function StripeAppProvider({ children }: { children: React.ReactElement }) {
  const { config } = useAppConfig();
  const key = (config.stripe_publishable_key || '').trim();

  if (!key) {
    return children;
  }

  return (
    <StripeProvider publishableKey={key} urlScheme="zinapp">
      {children}
    </StripeProvider>
  );
}
