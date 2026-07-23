import { DELIVERY_FEE } from '../config/delivery';
import type { Restaurant } from '../types';
import { formatCurrency } from './format';

function formatTimeLabel(value: string): string {
  const [hour, minute] = value.split(':');
  return `${hour}:${minute}`;
}

export function formatRestaurantHours(
  opening?: string | null,
  closing?: string | null,
): string | null {
  if (!opening || !closing) return null;
  return `${formatTimeLabel(opening)} – ${formatTimeLabel(closing)}`;
}

export function formatRatingLabel(restaurant: Restaurant): string | null {
  if (restaurant.rating_average == null) return null;
  const count = restaurant.reviews_count ?? 0;
  return count > 0
    ? `${restaurant.rating_average} (${count})`
    : String(restaurant.rating_average);
}

/** ETA aproximado de entrega en Zinapécuaro (prep + traslado local). */
export function estimateDeliveryEta(restaurant: Restaurant): {
  min: number;
  max: number;
  label: string;
} {
  const category = (restaurant.category ?? 'general').toLowerCase();
  const base: Record<string, [number, number]> = {
    pizzas: [35, 50],
    makis: [30, 45],
    mexicana: [25, 40],
    general: [30, 45],
  };
  const [minBase, maxBase] = base[category] ?? base.general;
  const jitter = restaurant.id % 5;
  const min = minBase + jitter;
  const max = maxBase + jitter;
  return { min, max, label: `${min}–${max} min` };
}

export function formatDeliveryFeeLabel(): string {
  return `Envío ${formatCurrency(DELIVERY_FEE)}`;
}

export function buildMenuBannerMeta(restaurant: Restaurant): string {
  const parts: string[] = [];
  const rating = formatRatingLabel(restaurant);
  if (rating) parts.push(`★ ${rating}`);
  parts.push(estimateDeliveryEta(restaurant).label);
  parts.push(formatDeliveryFeeLabel());
  if (restaurant.is_open === false) parts.push('Cerrado ahora');
  return parts.join(' · ');
}

export type RestaurantMetaChip = {
  icon: 'star' | 'time-outline' | 'bicycle-outline' | 'fast-food-outline';
  text: string;
  emphasize?: boolean;
};

/** Señales de comercio para listados (rating · ETA · fee). */
export function buildRestaurantMetaChips(restaurant: Restaurant): RestaurantMetaChip[] {
  const chips: RestaurantMetaChip[] = [];
  const rating = formatRatingLabel(restaurant);
  if (rating) {
    chips.push({ icon: 'star', text: rating, emphasize: true });
  }
  chips.push({ icon: 'time-outline', text: estimateDeliveryEta(restaurant).label });
  chips.push({ icon: 'bicycle-outline', text: formatDeliveryFeeLabel() });
  return chips;
}
