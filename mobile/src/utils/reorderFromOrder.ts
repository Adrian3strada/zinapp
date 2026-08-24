import type { CartItem, Order, Product, ReorderPreview } from '../types';
import { normalizeCartNotes } from '../context/CartContext';

export type ReorderResult = {
  items: CartItem[];
  added: number;
  skipped: number;
  restaurantId: number | null;
  restaurantName: string;
};

function resolveProductRestaurant(product: Product, fallbackRestaurantId: number): Product {
  const current = product.restaurant;
  if (typeof current === 'number' && Number.isFinite(current) && current > 0) {
    return product;
  }
  return { ...product, restaurant: fallbackRestaurantId };
}

export function previewToCartItems(preview: ReorderPreview): CartItem[] {
  const restaurantId = preview.restaurant_id ?? 0;
  return preview.items.map((line) => ({
    product: resolveProductRestaurant(line.product, restaurantId),
    quantity: Math.max(1, line.quantity || 1),
    notes: normalizeCartNotes(line.notes) || undefined,
    selectedOptions: line.selected_options?.length ? line.selected_options : undefined,
  }));
}

export function reorderUnavailableMessage(preview: ReorderPreview): string {
  if (!preview.unavailable.length) return '';
  return preview.unavailable.map((row) => `• ${row.reason}`).join('\n');
}

/** Arma líneas de carrito a partir de un pedido (omite no disponibles). */
export function buildReorderCartItems(order: Order): ReorderResult {
  const restaurantId = order.restaurant_detail?.id ?? order.restaurant ?? 0;
  const restaurantName = order.restaurant_detail?.name ?? 'Restaurante';
  const items: CartItem[] = [];
  let skipped = 0;

  for (const line of order.items ?? []) {
    const detail = line.product_detail;
    if (!detail?.id || detail.is_available === false || !restaurantId) {
      skipped += 1;
      continue;
    }
    items.push({
      product: resolveProductRestaurant(detail, restaurantId),
      quantity: Math.max(1, line.quantity || 1),
      notes: normalizeCartNotes(line.notes) || undefined,
      selectedOptions: line.selected_options?.length ? line.selected_options : undefined,
    });
  }

  return {
    items,
    added: items.length,
    skipped,
    restaurantId: restaurantId || null,
    restaurantName,
  };
}
