import type { Restaurant } from '../types';

export const RESTAURANT_CATEGORIES = [
  { label: 'Todos', key: null, emoji: '✨' },
  { label: 'Pizzas', key: 'pizzas', emoji: '🍕' },
  { label: 'Makis', key: 'makis', emoji: '🍣' },
  { label: 'Mexicana', key: 'mexicana', emoji: '🌮' },
] as const;

export type RestaurantCategoryKey = typeof RESTAURANT_CATEGORIES[number]['key'];

export function restaurantMatchesCategory(
  restaurant: Restaurant,
  categoryKey: RestaurantCategoryKey,
): boolean {
  if (!categoryKey) return true;
  return (restaurant.category ?? 'general') === categoryKey;
}

export const RESTAURANT_CATEGORY_LABELS: Record<string, string> = {
  general: 'General',
  pizzas: 'Pizzas',
  makis: 'Makis',
  mexicana: 'Mexicana',
};
