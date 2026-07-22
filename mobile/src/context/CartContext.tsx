import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { appAlert } from '../utils/appAlert';

import type { CartItem, Product } from '../types';
import { calculatePromoLineTotal } from '../utils/promo';

/** Notas de sabor/toppings; alinea con OrderItem.notes (max 255). */
export function normalizeCartNotes(notes?: string | null): string {
  return (notes ?? '').trim().slice(0, 255);
}

function resolveRestaurantId(product: Product): number {
  const value = product.restaurant as number | { id?: number };
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (value && typeof value === 'object' && typeof value.id === 'number') return value.id;
  return 0;
}

function sameLine(item: CartItem, productId: number, notes?: string | null): boolean {
  return item.product.id === productId && normalizeCartNotes(item.notes) === normalizeCartNotes(notes);
}

interface CartContextValue {
  items: CartItem[];
  restaurantId: number | null;
  addItem: (product: Product, quantity?: number, notes?: string) => void;
  removeItem: (productId: number, notes?: string) => void;
  updateQuantity: (productId: number, quantity: number, notes?: string) => void;
  updateItemNotes: (productId: number, notes: string, nextNotes: string) => void;
  clearCart: () => void;
  total: number;
  itemCount: number;
}

const CartContext = createContext<CartContextValue | undefined>(undefined);

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [restaurantId, setRestaurantId] = useState<number | null>(null);

  const addItem = useCallback((product: Product, quantity = 1, notes?: string) => {
    const productRestaurantId = resolveRestaurantId(product);
    if (!product?.id || !productRestaurantId) {
      appAlert('Error', 'No se pudo agregar este producto. Intenta de nuevo.');
      return;
    }

    const safeQty = Math.max(1, Math.floor(quantity) || 1);
    const lineNotes = normalizeCartNotes(notes);

    if (restaurantId && restaurantId !== productRestaurantId) {
      appAlert(
        'Cambiar restaurante',
        'Tu carrito tiene productos de otro restaurante. ¿Vaciar y agregar este?',
        [
          { text: 'Cancelar', style: 'cancel' },
          {
            text: 'Vaciar y agregar',
            onPress: () => {
              setItems([{ product, quantity: safeQty, notes: lineNotes || undefined }]);
              setRestaurantId(productRestaurantId);
            },
          },
        ],
      );
      return;
    }

    setRestaurantId(productRestaurantId);
    setItems((prev) => {
      const existing = prev.find((i) => sameLine(i, product.id, lineNotes));
      if (existing) {
        return prev.map((i) =>
          sameLine(i, product.id, lineNotes)
            ? { ...i, quantity: i.quantity + safeQty }
            : i,
        );
      }
      return [...prev, { product, quantity: safeQty, notes: lineNotes || undefined }];
    });
  }, [restaurantId]);

  const removeItem = useCallback((productId: number, notes?: string) => {
    const lineNotes = normalizeCartNotes(notes);
    setItems((prev) => {
      const next = prev.filter((i) => !sameLine(i, productId, lineNotes));
      if (next.length === 0) setRestaurantId(null);
      return next;
    });
  }, []);

  const updateQuantity = useCallback((productId: number, quantity: number, notes?: string) => {
    if (quantity <= 0) {
      removeItem(productId, notes);
      return;
    }
    const lineNotes = normalizeCartNotes(notes);
    setItems((prev) =>
      prev.map((i) =>
        sameLine(i, productId, lineNotes) ? { ...i, quantity } : i,
      ),
    );
  }, [removeItem]);

  const updateItemNotes = useCallback((productId: number, notes: string, nextNotes: string) => {
    const from = normalizeCartNotes(notes);
    const to = normalizeCartNotes(nextNotes);
    if (from === to) return;

    setItems((prev) => {
      const source = prev.find((i) => sameLine(i, productId, from));
      if (!source) return prev;

      const target = prev.find((i) => sameLine(i, productId, to));
      if (target) {
        // Fusiona líneas si ya existe el mismo producto+notas.
        return prev
          .filter((i) => !sameLine(i, productId, from))
          .map((i) =>
            sameLine(i, productId, to)
              ? { ...i, quantity: i.quantity + source.quantity }
              : i,
          );
      }

      return prev.map((i) =>
        sameLine(i, productId, from)
          ? { ...i, notes: to || undefined }
          : i,
      );
    });
  }, []);

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
    [items],
  );

  const value = useMemo(
    () => ({
      items,
      restaurantId,
      addItem,
      removeItem,
      updateQuantity,
      updateItemNotes,
      clearCart,
      total,
      itemCount,
    }),
    [items, restaurantId, addItem, removeItem, updateQuantity, updateItemNotes, clearCart, total, itemCount],
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
