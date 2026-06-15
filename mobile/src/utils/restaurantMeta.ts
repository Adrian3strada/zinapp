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

export function buildMenuBannerMeta(restaurant: Restaurant): string {
  const parts: string[] = [];
  const rating = formatRatingLabel(restaurant);
  if (rating) parts.push(`★ ${rating}`);
  const hours = formatRestaurantHours(restaurant.opening_time, restaurant.closing_time);
  if (hours) parts.push(hours);
  parts.push(`Envío ${formatCurrency(DELIVERY_FEE)}`);
  if (restaurant.is_open === false) parts.push('Cerrado ahora');
  return parts.join(' · ');
}

export type RestaurantMetaChip = {
  icon: 'star' | 'time-outline' | 'bicycle-outline' | 'fast-food-outline';
  text: string;
};

export function buildRestaurantMetaChips(restaurant: Restaurant): RestaurantMetaChip[] {
  const chips: RestaurantMetaChip[] = [];
  const rating = formatRatingLabel(restaurant);
  if (rating) chips.push({ icon: 'star', text: rating });
  const hours = formatRestaurantHours(restaurant.opening_time, restaurant.closing_time);
  if (hours) chips.push({ icon: 'time-outline', text: hours });
  chips.push({ icon: 'bicycle-outline', text: formatCurrency(DELIVERY_FEE) });
  if (restaurant.products_count > 0) {
    chips.push({ icon: 'fast-food-outline', text: String(restaurant.products_count) });
  }
  return chips;
}
