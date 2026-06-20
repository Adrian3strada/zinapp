import type { Restaurant } from '../types';

export const RESTAURANT_CATEGORIES = [
  { label: 'Todos', key: null, emoji: '✨' },
  { label: 'Pizzas', key: 'pizzas', emoji: '🍕' },
  { label: 'Makis', key: 'makis', emoji: '🍣' },
  { label: 'Mexicana', key: 'mexicana', emoji: '🌮' },
] as const;

export type RestaurantCategoryKey = typeof RESTAURANT_CATEGORIES[number]['key'];

const CATEGORY_KEYWORDS: Record<Exclude<RestaurantCategoryKey, null>, string[]> = {
  pizzas: ['pizza', 'pizzas', 'boneless', 'cerveza', 'beer'],
  makis: ['maki', 'makis', 'rollo', 'roll', 'sushi', 'japon', 'japonesa'],
  mexicana: [
    'mexican',
    'mexicana',
    'taco',
    'tacos',
    'enchilada',
    'birria',
    'chilaquil',
    'guiso',
    'antojito',
    'bistec',
    'quesadilla',
  ],
};

function inferCategoryFromText(restaurant: Restaurant): RestaurantCategoryKey {
  const text = `${restaurant.name} ${restaurant.description}`.toLowerCase();
  for (const [key, keywords] of Object.entries(CATEGORY_KEYWORDS) as [
    Exclude<RestaurantCategoryKey, null>,
    string[],
  ][]) {
    if (keywords.some((word) => text.includes(word))) {
      return key;
    }
  }
  return null;
}

export function restaurantMatchesCategory(
  restaurant: Restaurant,
  categoryKey: RestaurantCategoryKey,
): boolean {
  if (!categoryKey) return true;

  const stored = restaurant.category ?? 'general';
  if (stored === categoryKey) return true;

  if (stored === 'general') {
    return inferCategoryFromText(restaurant) === categoryKey;
  }

  return false;
}

export const RESTAURANT_CATEGORY_LABELS: Record<string, string> = {
  general: 'General',
  pizzas: 'Pizzas',
  makis: 'Makis',
  mexicana: 'Mexicana',
};
