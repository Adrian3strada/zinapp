const RESTAURANT_VISUALS: Record<string, { emoji: string; color: string }> = {
  pizzas: { emoji: '🍕', color: '#E85D04' },
  beer: { emoji: '🍕', color: '#E85D04' },
  maki: { emoji: '🍣', color: '#2A9D8F' },
  shukrani: { emoji: '🍣', color: '#2A9D8F' },
  jardines: { emoji: '🌿', color: '#588157' },
  tacos: { emoji: '🌮', color: '#1E5DB8' },
  birria: { emoji: '🍖', color: '#C45C26' },
  birriería: { emoji: '🍖', color: '#C45C26' },
  nevería: { emoji: '🍦', color: '#FF6B9D' },
  neveria: { emoji: '🍦', color: '#FF6B9D' },
};

const PRODUCT_KEYWORDS: [string, string][] = [
  ['taco', '🌮'],
  ['birria', '🍖'],
  ['quesa', '🧀'],
  ['consomé', '🍲'],
  ['consome', '🍲'],
  ['nieve', '🍦'],
  ['paleta', '🍧'],
  ['agua', '🥤'],
  ['refresco', '🥤'],
  ['yogurt', '🥛'],
  ['volcán', '🌋'],
  ['volcan', '🌋'],
  ['pizza', '🍕'],
  ['rollo', '🍣'],
  ['maki', '🍣'],
  ['enchilada', '🌶️'],
  ['chilaquil', '🍳'],
  ['bistec', '🥩'],
  ['boneless', '🍗'],
];

export function getRestaurantVisual(name: string) {
  const lower = name.toLowerCase();
  for (const [key, visual] of Object.entries(RESTAURANT_VISUALS)) {
    if (lower.includes(key)) return visual;
  }
  return { emoji: '🍽️', color: '#1E5DB8' };
}

export function getProductEmoji(name: string): string {
  const lower = name.toLowerCase();
  for (const [keyword, emoji] of PRODUCT_KEYWORDS) {
    if (lower.includes(keyword)) return emoji;
  }
  return '🍴';
}
