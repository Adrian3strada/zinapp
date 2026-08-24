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

const WEEKDAY_SHORT_LABELS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];

export function formatRestaurantSchedule(restaurant: Restaurant): string | null {
  const businessHours = restaurant.business_hours ?? [];
  if (businessHours.length === 0) {
    return formatRestaurantHours(restaurant.opening_time, restaurant.closing_time);
  }
  const openDays = businessHours.filter((day) => !day.is_closed && day.opening_time && day.closing_time);
  if (openDays.length === 0) return 'Horario cerrado';
  if (openDays.length === 7) {
    const first = openDays[0];
    const sameHours = openDays.every(
      (day) => day.opening_time === first.opening_time && day.closing_time === first.closing_time,
    );
    if (sameHours) {
      return `Todos los días ${formatTimeLabel(first.opening_time!)} – ${formatTimeLabel(first.closing_time!)}`;
    }
  }
  return openDays
    .map((day) => (
      `${WEEKDAY_SHORT_LABELS[day.day_of_week] ?? ''} ${formatTimeLabel(day.opening_time!)}–${formatTimeLabel(day.closing_time!)}`
    ))
    .join(' · ');
}

export function formatRatingLabel(restaurant: {
  rating_average?: number | null;
  reviews_count?: number;
}): string | null {
  if (restaurant.rating_average == null) return null;
  const count = restaurant.reviews_count ?? 0;
  return count > 0
    ? `${restaurant.rating_average} (${count})`
    : String(restaurant.rating_average);
}

export function formatDeliveryFeeLabel(): string {
  return `Envío ${formatCurrency(DELIVERY_FEE)}`;
}

export function buildMenuBannerMeta(restaurant: Restaurant): string {
  const parts: string[] = [];
  const rating = formatRatingLabel(restaurant);
  if (rating) parts.push(`★ ${rating}`);
  parts.push(formatDeliveryFeeLabel());
  if (restaurant.is_open === false) parts.push('Cerrado ahora');
  return parts.join(' · ');
}

export type RestaurantMetaChip = {
  icon: 'star' | 'time-outline' | 'bicycle-outline' | 'fast-food-outline';
  text: string;
  emphasize?: boolean;
};

/** Señales reales de comercio para listados (rating · envío). */
export function buildRestaurantMetaChips(restaurant: Restaurant): RestaurantMetaChip[] {
  const chips: RestaurantMetaChip[] = [];
  const rating = formatRatingLabel(restaurant);
  if (rating) {
    chips.push({ icon: 'star', text: rating, emphasize: true });
  }
  chips.push({ icon: 'bicycle-outline', text: formatDeliveryFeeLabel() });
  return chips;
}
