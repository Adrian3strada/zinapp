import { useEffect } from 'react';
import { Platform } from 'react-native';

import { useCart } from '../context/CartContext';
import { navigateToOrder } from '../navigation/navigationRef';

/**
 * Tras Embedded Checkout, Stripe redirige a /app/?stripe_return=1&order_id=…
 * Debe vivir fuera del carrito: el usuario puede aterrizar en Inicio.
 */
export default function StripeReturnHandler() {
  const { clearCart } = useCart();

  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    if (params.get('stripe_return') !== '1') return;

    const orderId = Number(params.get('order_id') || 0);
    const url = new URL(window.location.href);
    url.searchParams.delete('stripe_return');
    url.searchParams.delete('order_id');
    window.history.replaceState({}, '', `${url.pathname}${url.search}${url.hash}`);

    clearCart();
    if (orderId > 0) {
      navigateToOrder(orderId);
    }
  }, [clearCart]);

  return null;
}
