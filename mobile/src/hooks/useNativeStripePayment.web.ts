import { useCallback } from 'react';

export type NativePaymentResult =
  | { ok: true }
  | { ok: false; canceled?: boolean; message?: string };

/** Stub web: el pago embebido usa Stripe.js, no Payment Sheet. */
export function useNativeStripePayment() {
  const payWithSheet = useCallback(async (_clientSecret: string): Promise<NativePaymentResult> => {
    return { ok: false, message: 'Usa el formulario web de Stripe.' };
  }, []);

  return { payWithSheet };
}
