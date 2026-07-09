import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { appAlert } from '../utils/appAlert';

import type { CartItem, Product } from '../types';
import { calculatePromoLineTotal } from '../utils/promo';

function resolveRestaurantId(product: Product): number {
  const value = product.restaurant as number | { id?: number };
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (value && typeof value === 'object' && typeof value.id === 'number') return value.id;
  return 0;
}

interface CartContextValue {
  items: CartItem[];
  restaurantId: number | null;
  addItem: (product: Product, quantity?: number) => void;
  removeItem: (productId: number) => void;
  updateQuantity: (productId: number, quantity: number) => void;
  clearCart: () => void;
  total: number;
  itemCount: number;
}

const CartContext = createContext<CartContextValue | undefined>(undefined);

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [restaurantId, setRestaurantId] = useState<number | null>(null);

  const addItem = useCallback((product: Product, quantity = 1) => {
    const productRestaurantId = resolveRestaurantId(product);
    if (!product?.id || !productRestaurantId) {
      appAlert('Error', 'No se pudo agregar este producto. Intenta de nuevo.');
      return;
    }

    const safeQty = Math.max(1, Math.floor(quantity) || 1);

    if (restaurantId && restaurantId !== productRestaurantId) {
      appAlert(
        'Cambiar restaurante',
        'Tu carrito tiene productos de otro restaurante. ¿Vaciar y agregar este?',
        [
          { text: 'Cancelar', style: 'cancel' },
          {
            text: 'Vaciar y agregar',
            onPress: () => {
              setItems([{ product, quantity: safeQty }]);
              setRestaurantId(productRestaurantId);
            },
          },
        ],
      );
      return;
    }

    setRestaurantId(productRestaurantId);
    setItems((prev) => {
      const existing = prev.find((i) => i.product.id === product.id);
      if (existing) {
        return prev.map((i) =>
          i.product.id === product.id
            ? { ...i, quantity: i.quantity + safeQty }
            : i
        );
      }
      return [...prev, { product, quantity: safeQty }];
    });
  }, [restaurantId]);

  const removeItem = useCallback((productId: number) => {
    setItems((prev) => {
      const next = prev.filter((i) => i.product.id !== productId);
      if (next.length === 0) setRestaurantId(null);
      return next;
    });
  }, []);

  const updateQuantity = useCallback((productId: number, quantity: number) => {
    if (quantity <= 0) {
      removeItem(productId);
      return;
    }
    setItems((prev) =>
      prev.map((i) => (i.product.id === productId ? { ...i, quantity } : i))
    );
  }, [removeItem]);

  const clearCart = useCallback(() => {
    setItems([]);
    setRestaurantId(null);
  }, []);

  const total = useMemo(
    () =>
      items.reduce((sum, i) => {
        const { total: lineTotal } = calculatePromoLineTotal(i.product, i.quantity);
        return sum + lineTotal;
      }, 0),
    [items],
  );

  const itemCount = useMemo(
    () => items.reduce((sum, i) => sum + i.quantity, 0),
    [items]
  );

  const value = useMemo(
    () => ({
      items,
      restaurantId,
      addItem,
      removeItem,
      updateQuantity,
      clearCart,
      total,
      itemCount,
    }),
    [items, restaurantId, addItem, removeItem, updateQuantity, clearCart, total, itemCount],
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error('useCart debe usarse dentro de CartProvider');
  }
  return context;
}
