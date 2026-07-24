import { useCallback } from 'react';
import { InteractionManager, Platform } from 'react-native';
import { useStripe } from '@stripe/stripe-react-native';

export type NativePaymentResult =
  | { ok: true }
  | { ok: false; canceled?: boolean; message?: string };

function waitForUiIdle(ms = 350): Promise<void> {
  return new Promise((resolve) => {
    InteractionManager.runAfterInteractions(() => {
      setTimeout(resolve, ms);
    });
  });
}

/** Payment Sheet nativo (tarjeta dentro de la app). */
export function useNativeStripePayment() {
  const stripe = useStripe();

  const payWithSheet = useCallback(
    async (clientSecret: string): Promise<NativePaymentResult> => {
      if (Platform.OS === 'web') {
        return { ok: false, message: 'Payment Sheet no disponible en web.' };
      }

      const { initPaymentSheet, presentPaymentSheet } = stripe;
      if (!initPaymentSheet || !presentPaymentSheet) {
        return {
          ok: false,
          message: 'Stripe no está listo. Cierra la app y vuelve a abrirla.',
        };
      }

      const secret = (clientSecret || '').trim();
      if (!secret.startsWith('pi_') || !secret.includes('_secret_')) {
        return { ok: false, message: 'Respuesta de pago inválida. Intenta de nuevo.' };
      }

      // Evita que el sheet se cierre al cambiar de pantalla / animar navegación.
      await waitForUiIdle(400);

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
        return {
          ok: false,
          message: initError.message || `No se pudo preparar el pago (${initError.code})`,
        };
      }

      await waitForUiIdle(150);

      const { error } = await presentPaymentSheet();
      if (error) {
        if (error.code === 'Canceled') {
          return { ok: false, canceled: true, message: 'Pago cancelado.' };
        }
        return {
          ok: false,
          message: error.message || `Error de pago (${error.code})`,
        };
      }
      return { ok: true };
    },
    [stripe],
  );

  return { payWithSheet };
}
