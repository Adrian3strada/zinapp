import { useCallback } from 'react';
import { Platform } from 'react-native';
import { useStripe } from '@stripe/stripe-react-native';

export type NativePaymentResult =
  | { ok: true }
  | { ok: false; canceled?: boolean; message?: string };

/** Payment Sheet nativo (tarjeta dentro de la app). */
export function useNativeStripePayment() {
  const { initPaymentSheet, presentPaymentSheet } = useStripe();

  const payWithSheet = useCallback(
    async (clientSecret: string): Promise<NativePaymentResult> => {
      if (Platform.OS === 'web') {
        return { ok: false, message: 'Payment Sheet no disponible en web.' };
      }
      const secret = (clientSecret || '').trim();
      if (!secret) {
        return { ok: false, message: 'No se pudo iniciar el pago.' };
      }

      const { error: initError } = await initPaymentSheet({
        merchantDisplayName: 'ZinApp',
        paymentIntentClientSecret: secret,
        returnURL: 'zinapp://stripe-redirect',
        allowsDelayedPaymentMethods: false,
        defaultBillingDetails: {
          address: { country: 'MX' },
        },
      });
      if (initError) {
        return { ok: false, message: initError.message };
      }

      const { error } = await presentPaymentSheet();
      if (error) {
        if (error.code === 'Canceled') {
          return { ok: false, canceled: true };
        }
        return { ok: false, message: error.message };
      }
      return { ok: true };
    },
    [initPaymentSheet, presentPaymentSheet],
  );

  return { payWithSheet };
}
