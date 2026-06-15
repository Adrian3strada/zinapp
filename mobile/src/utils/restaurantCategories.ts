import type { Restaurant } from '../types';

export const RESTAURANT_CATEGORIES = [
  { label: 'Todos', key: null },
  { label: 'Pizzas', key: 'pizzas' },
  { label: 'Makis', key: 'makis' },
  { label: 'Mexicana', key: 'mexicana' },
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
