import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { Alert } from 'react-native';

import type { CartItem, Product } from '../types';

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
    if (restaurantId && restaurantId !== product.restaurant) {
      Alert.alert(
        'Cambiar restaurante',
        'Tu carrito tiene productos de otro restaurante. ¿Vaciar y agregar este?',
        [
          { text: 'Cancelar', style: 'cancel' },
          {
            text: 'Vaciar y agregar',
            onPress: () => {
              setItems([{ product, quantity }]);
              setRestaurantId(product.restaurant);
            },
          },
        ],
      );
      return;
    }

    setRestaurantId(product.restaurant);
    setItems((prev) => {
      const existing = prev.find((i) => i.product.id === product.id);
      if (existing) {
        return prev.map((i) =>
          i.product.id === product.id
            ? { ...i, quantity: i.quantity + quantity }
            : i
        );
      }
      return [...prev, { product, quantity }];
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
        const price = parseFloat(i.product.price);
        return sum + (Number.isFinite(price) ? price : 0) * i.quantity;
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
