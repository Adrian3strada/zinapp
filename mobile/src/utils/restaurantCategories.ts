import type { Restaurant } from '../types';

/** Categorías visibles en filtros del inicio / comida (sin `general`). */
export const RESTAURANT_CATEGORIES = [
  { label: 'Todos', key: null, emoji: '✨' },
  { label: 'Mexicana', key: 'mexicana', emoji: '🌮' },
  { label: 'Tacos', key: 'tacos', emoji: '🌯' },
  { label: 'Antojitos', key: 'antojitos', emoji: '🫔' },
  { label: 'Pizzas', key: 'pizzas', emoji: '🍕' },
  { label: 'Hamburguesas', key: 'hamburguesas', emoji: '🍔' },
  { label: 'Pollos', key: 'pollos', emoji: '🍗' },
  { label: 'Mariscos', key: 'mariscos', emoji: '🦐' },
  { label: 'Carnes', key: 'carnes', emoji: '🥩' },
  { label: 'Makis', key: 'makis', emoji: '🍣' },
  { label: 'Asiática', key: 'asiatica', emoji: '🥡' },
  { label: 'Italiana', key: 'italiana', emoji: '🍝' },
  { label: 'Tortas', key: 'tortas', emoji: '🥪' },
  { label: 'Desayunos', key: 'desayunos', emoji: '🍳' },
  { label: 'Fondas', key: 'fondas', emoji: '🍲' },
  { label: 'Postres', key: 'postres', emoji: '🍰' },
  { label: 'Café', key: 'cafe', emoji: '☕' },
  { label: 'Bebidas', key: 'bebidas', emoji: '🥤' },
  { label: 'Vinatería', key: 'vinateria', emoji: '🍷' },
  { label: 'Saludable', key: 'saludable', emoji: '🥗' },
  { label: 'Alitas', key: 'alitas', emoji: '🔥' },
  { label: 'Rápida', key: 'comida_rapida', emoji: '⚡' },
] as const;

export type RestaurantCategoryKey = typeof RESTAURANT_CATEGORIES[number]['key'];

const CATEGORY_KEYWORDS: Record<Exclude<RestaurantCategoryKey, null>, string[]> = {
  mexicana: [
    'mexican', 'mexicana', 'comida mexicana', 'enchilada', 'mole', 'pozole',
    'birria', 'barbacoa', 'carnitas', 'guiso', 'bistec', 'milanesa', 'milanes',
  ],
  tacos: ['taco', 'tacos', 'taqueria', 'taquería', ' pastor', 'suadero', 'volcan'],
  antojitos: [
    'antojito', 'quesadilla', 'gordita', 'sope', 'tlacoyo', 'huarache',
    'elote', 'esquite', 'churro', 'empanada',
  ],
  pizzas: ['pizza', 'pizzas', 'pizzeria', 'pizzería', 'boneless', 'calzone'],
  hamburguesas: [
    'hamburguesa', 'hamburguesas', 'burger', 'burgers', 'hamburguer', 'smash',
  ],
  pollos: [
    'pollo', 'pollos', 'rostizado', 'broaster', 'broasted', 'alitas y papas',
    'pechuga', 'nugget', 'nuggets',
  ],
  mariscos: [
    'marisco', 'mariscos', 'camaron', 'camarón', 'pescado', 'ceviche', 'aguachile',
    'pulpo', 'ostion', 'ostión', 'seafood', 'sushi bar',
  ],
  carnes: [
    'parrilla', 'asador', 'arrachera', 'ribeye', 'carne asada', 'grill', 'steak',
    'costilla', 'costillas', 'corte', 'cortes',
  ],
  makis: [
    'maki', 'makis', 'rollo', 'roll', 'sushi', 'japon', 'japonesa', 'japones',
    'sashimi', 'nigiri', 'temaki',
  ],
  asiatica: [
    'china', 'chino', 'chinese', 'coreana', 'coreano', 'tailand', 'wok', 'pad thai',
    'ramen', 'dim sum', 'mongol', 'oriental',
  ],
  italiana: ['italiana', 'italiano', 'pasta', 'lasagna', 'lasaña', 'ravioli', 'risotto'],
  tortas: ['torta', 'tortas', 'lonche', 'lonches', 'tortas ahogadas'],
  desayunos: [
    'desayuno', 'desayunos', 'chilaquil', 'chilaquiles', 'huevo', 'hot cake',
    'hotcake', 'pan dulce', 'mollete',
  ],
  fondas: ['fonda', 'fondas', 'comida corrida', 'comida casera', 'cocina economica'],
  postres: [
    'postre', 'postres', 'reposteria', 'repostería', 'pastel', 'panaderia',
    'panadería', 'donut', 'dona', 'helado', 'neveria', 'nevería',
  ],
  cafe: [
    'cafe', 'café', 'cafeteria', 'cafetería', 'coffee', 'espresso', 'capuccino',
    'cappuccino', 'latte',
  ],
  bebidas: [
    'bebida', 'bebidas', 'jugo', 'jugos', 'licuado', 'licuados', 'smoothie',
    'malteada', 'agua fresca', 'michelada',
  ],
  vinateria: [
    'vinateria', 'vinatería', 'vino', 'vinos', 'cerveza', 'cerveceria', 'cervecería',
    'cantina', 'bar', 'mixologia', 'mixología', 'mezcal',
  ],
  saludable: [
    'saludable', 'ensalada', 'ensaladas', 'vegano', 'vegetariano', 'bowl',
    'fit', 'light', 'organico', 'orgánico',
  ],
  alitas: ['alita', 'alitas', 'wings', 'buffalo', 'boneless'],
  comida_rapida: [
    'rapida', 'rápida', 'fast food', 'hot dog', 'perro caliente', 'nuggets',
    'combo', 'combos',
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

export function categoryEmoji(key: string | null | undefined): string {
  const found = RESTAURANT_CATEGORIES.find((item) => item.key === key);
  return found?.emoji ?? '🍽️';
}

const CATEGORY_TINTS: Record<string, string> = {
  mexicana: '#FFE8CC',
  tacos: '#FFE4C4',
  antojitos: '#FDE68A',
  pizzas: '#FED7AA',
  hamburguesas: '#FECACA',
  pollos: '#FDE68A',
  mariscos: '#A5F3FC',
  carnes: '#FECACA',
  makis: '#BBF7D0',
  asiatica: '#FECACA',
  italiana: '#FDE68A',
  tortas: '#FED7AA',
  desayunos: '#FDE68A',
  fondas: '#FED7AA',
  postres: '#FBCFE8',
  cafe: '#E7E5E4',
  bebidas: '#C7D2FE',
  vinateria: '#FECACA',
  saludable: '#BBF7D0',
  alitas: '#FED7AA',
  comida_rapida: '#FDE68A',
};

export function categoryTint(key: string | null | undefined): string {
  if (!key) return '#E8F1FB';
  return CATEGORY_TINTS[key] ?? '#E8F1FB';
}

export const RESTAURANT_CATEGORY_LABELS: Record<string, string> = {
  general: 'General',
  mexicana: 'Mexicana',
  tacos: 'Tacos',
  antojitos: 'Antojitos',
  pizzas: 'Pizzas',
  hamburguesas: 'Hamburguesas',
  pollos: 'Pollos',
  mariscos: 'Mariscos',
  carnes: 'Carnes y parrilla',
  makis: 'Makis y sushi',
  asiatica: 'Asiática',
  italiana: 'Italiana',
  tortas: 'Tortas',
  desayunos: 'Desayunos',
  fondas: 'Fondas',
  postres: 'Postres',
  cafe: 'Café',
  bebidas: 'Bebidas y jugos',
  vinateria: 'Vinatería',
  saludable: 'Saludable',
  alitas: 'Alitas',
  comida_rapida: 'Comida rápida',
};
