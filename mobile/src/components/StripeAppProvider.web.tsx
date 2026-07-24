import React from 'react';

/** Web: Stripe nativo no aplica; Embedded Checkout usa @stripe/stripe-js. */
export default function StripeAppProvider({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
