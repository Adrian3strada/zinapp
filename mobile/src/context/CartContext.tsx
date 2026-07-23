import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { appAlert } from '../utils/appAlert';

import type { CartItem, Product, SelectedProductOption } from '../types';
import { calculateCartLineTotal } from '../utils/promo';

/** Notas de sabor libre; alinea con OrderItem.notes (max 255). */
export function normalizeCartNotes(notes?: string | null): string {
  return (notes ?? '').trim().slice(0, 255);
}

export function optionsKey(options?: SelectedProductOption[] | null): string {
  return (options ?? [])
    .map((o) => o.id)
    .sort((a, b) => a - b)
    .join(',');
}

function resolveRestaurantId(product: Product): number {
  const value = product.restaurant as number | { id?: number };
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (value && typeof value === 'object' && typeof value.id === 'number') return value.id;
  return 0;
}

function sameLine(
  item: CartItem,
  productId: number,
  notes?: string | null,
  selectedOptions?: SelectedProductOption[] | null,
): boolean {
  return (
    item.product.id === productId
    && normalizeCartNotes(item.notes) === normalizeCartNotes(notes)
    && optionsKey(item.selectedOptions) === optionsKey(selectedOptions)
  );
}

interface CartContextValue {
  items: CartItem[];
  restaurantId: number | null;
  addItem: (
    product: Product,
    quantity?: number,
    notes?: string,
    selectedOptions?: SelectedProductOption[],
  ) => void;
  removeItem: (
    productId: number,
    notes?: string,
    selectedOptions?: SelectedProductOption[],
  ) => void;
  updateQuantity: (
    productId: number,
    quantity: number,
    notes?: string,
    selectedOptions?: SelectedProductOption[],
  ) => void;
  updateItemNotes: (
    productId: number,
    notes: string,
    nextNotes: string,
    selectedOptions?: SelectedProductOption[],
  ) => void;
  clearCart: () => void;
  /** Sustituye el carrito de golpe (reordenar pedido). */
  replaceCart: (nextItems: CartItem[]) => void;
  total: number;
  itemCount: number;
}

const CartContext = createContext<CartContextValue | undefined>(undefined);

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [restaurantId, setRestaurantId] = useState<number | null>(null);

  const addItem = useCallback((
    product: Product,
    quantity = 1,
    notes?: string,
    selectedOptions?: SelectedProductOption[],
  ) => {
    const productRestaurantId = resolveRestaurantId(product);
    if (!product?.id || !productRestaurantId) {
      appAlert('Error', 'No se pudo agregar este producto. Intenta de nuevo.');
      return;
    }

    const safeQty = Math.max(1, Math.floor(quantity) || 1);
    const lineNotes = normalizeCartNotes(notes);
    const opts = selectedOptions?.length ? selectedOptions : undefined;
    const nextLine: CartItem = {
      product,
      quantity: safeQty,
      notes: lineNotes || undefined,
      selectedOptions: opts,
    };

    if (restaurantId && restaurantId !== productRestaurantId) {
      appAlert(
        'Cambiar restaurante',
        'Tu carrito tiene productos de otro restaurante. ¿Vaciar y agregar este?',
        [
          { text: 'Cancelar', style: 'cancel' },
          {
            text: 'Vaciar y agregar',
            onPress: () => {
              setItems([nextLine]);
              setRestaurantId(productRestaurantId);
            },
          },
        ],
      );
      return;
    }

    setRestaurantId(productRestaurantId);
    setItems((prev) => {
      const existing = prev.find((i) => sameLine(i, product.id, lineNotes, opts));
      if (existing) {
        return prev.map((i) =>
          sameLine(i, product.id, lineNotes, opts)
            ? { ...i, quantity: i.quantity + safeQty }
            : i,
        );
      }
      return [...prev, nextLine];
    });
  }, [restaurantId]);

  const removeItem = useCallback((
    productId: number,
    notes?: string,
    selectedOptions?: SelectedProductOption[],
  ) => {
    const lineNotes = normalizeCartNotes(notes);
    setItems((prev) => {
      const next = prev.filter((i) => !sameLine(i, productId, lineNotes, selectedOptions));
      if (next.length === 0) setRestaurantId(null);
      return next;
    });
  }, []);

  const updateQuantity = useCallback((
    productId: number,
    quantity: number,
    notes?: string,
    selectedOptions?: SelectedProductOption[],
  ) => {
    if (quantity <= 0) {
      removeItem(productId, notes, selectedOptions);
      return;
    }
    const lineNotes = normalizeCartNotes(notes);
    setItems((prev) =>
      prev.map((i) =>
        sameLine(i, productId, lineNotes, selectedOptions) ? { ...i, quantity } : i,
      ),
    );
  }, [removeItem]);

  const updateItemNotes = useCallback((
    productId: number,
    notes: string,
    nextNotes: string,
    selectedOptions?: SelectedProductOption[],
  ) => {
    const from = normalizeCartNotes(notes);
    const to = normalizeCartNotes(nextNotes);
    if (from === to) return;

    setItems((prev) => {
      const source = prev.find((i) => sameLine(i, productId, from, selectedOptions));
      if (!source) return prev;

      const target = prev.find((i) => sameLine(i, productId, to, selectedOptions));
      if (target) {
        return prev
          .filter((i) => !sameLine(i, productId, from, selectedOptions))
          .map((i) =>
            sameLine(i, productId, to, selectedOptions)
              ? { ...i, quantity: i.quantity + source.quantity }
              : i,
          );
      }

      return prev.map((i) =>
        sameLine(i, productId, from, selectedOptions)
          ? { ...i, notes: to || undefined }
          : i,
      );
    });
  }, []);

  const clearCart = useCallback(() => {
    setItems([]);
    setRestaurantId(null);
  }, []);

  const replaceCart = useCallback((nextItems: CartItem[]) => {
    if (nextItems.length === 0) {
      setItems([]);
      setRestaurantId(null);
      return;
    }
    const rid = resolveRestaurantId(nextItems[0].product);
    setRestaurantId(rid || null);
    setItems(
      nextItems.map((line) => ({
        product: line.product,
        quantity: Math.max(1, Math.floor(line.quantity) || 1),
        notes: normalizeCartNotes(line.notes) || undefined,
        selectedOptions: line.selectedOptions?.length ? line.selectedOptions : undefined,
      })),
    );
  }, []);

  const total = useMemo(
    () => items.reduce((sum, i) => sum + calculateCartLineTotal(i), 0),
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
      replaceCart,
      total,
      itemCount,
    }),
    [
      items,
      restaurantId,
      addItem,
      removeItem,
      updateQuantity,
      updateItemNotes,
      clearCart,
      replaceCart,
      total,
      itemCount,
    ],
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
