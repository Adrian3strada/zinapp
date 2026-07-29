/** Categorías de platillo en el menú (deben coincidir con backend ProductCategory). */

export type ProductCategoryKey =
  | 'entradas'
  | 'comida'
  | 'bebidas'
  | 'postres'
  | 'extras';

export const PRODUCT_CATEGORIES: ReadonlyArray<{
  key: ProductCategoryKey;
  label: string;
  emoji: string;
}> = [
  { key: 'entradas', label: 'Entradas', emoji: '🥗' },
  { key: 'comida', label: 'Comida', emoji: '🍽️' },
  { key: 'bebidas', label: 'Bebidas', emoji: '🥤' },
  { key: 'postres', label: 'Postres', emoji: '🍰' },
  { key: 'extras', label: 'Extras', emoji: '✨' },
];

const BY_KEY = Object.fromEntries(
  PRODUCT_CATEGORIES.map((c) => [c.key, c]),
) as Record<ProductCategoryKey, (typeof PRODUCT_CATEGORIES)[number]>;

export function normalizeProductCategory(value?: string | null): ProductCategoryKey {
  if (value && value in BY_KEY) return value as ProductCategoryKey;
  return 'comida';
}

export function productCategoryLabel(
  value?: string | null,
  display?: string | null,
): string {
  if (display?.trim()) return display.trim();
  return BY_KEY[normalizeProductCategory(value)].label;
}

export function productCategoryEmoji(value?: string | null): string {
  return BY_KEY[normalizeProductCategory(value)].emoji;
}

export function sortProductsByCategory<T extends { category?: string | null; name: string }>(
  products: T[],
): T[] {
  const order = new Map(PRODUCT_CATEGORIES.map((c, i) => [c.key, i]));
  return [...products].sort((a, b) => {
    const ai = order.get(normalizeProductCategory(a.category)) ?? 99;
    const bi = order.get(normalizeProductCategory(b.category)) ?? 99;
    if (ai !== bi) return ai - bi;
    return a.name.localeCompare(b.name, 'es');
  });
}

export function groupProductsByCategory<T extends { category?: string | null; name: string }>(
  products: T[],
): Array<{ key: ProductCategoryKey; title: string; emoji: string; data: T[] }> {
  const buckets = new Map<ProductCategoryKey, T[]>();
  for (const product of sortProductsByCategory(products)) {
    const key = normalizeProductCategory(product.category);
    const list = buckets.get(key);
    if (list) list.push(product);
    else buckets.set(key, [product]);
  }
  return PRODUCT_CATEGORIES
    .filter((c) => (buckets.get(c.key)?.length ?? 0) > 0)
    .map((c) => ({
      key: c.key,
      title: c.label,
      emoji: c.emoji,
      data: buckets.get(c.key) ?? [],
    }));
}

/** Clave de sección en el catálogo del dueño (incluye datos antiguos sin categoría válida). */
export type ManageCategoryKey = ProductCategoryKey | 'unknown';

export function resolveManageCategory(value?: string | null): ManageCategoryKey {
  if (value && value in BY_KEY) return value as ProductCategoryKey;
  return 'unknown';
}

export function manageCategoryLabel(value?: string | null, display?: string | null): string {
  const key = resolveManageCategory(value);
  if (key === 'unknown') return display?.trim() || 'Sin categoría';
  return productCategoryLabel(key, display);
}

/** Agrupa para administración: no fuerza categorías inválidas a «comida». */
export function groupProductsForManageCatalog<T extends { category?: string | null; name: string }>(
  products: T[],
): Array<{ key: ManageCategoryKey; title: string; emoji: string; data: T[] }> {
  const order = new Map<ManageCategoryKey, number>([
    ...PRODUCT_CATEGORIES.map((c, i): [ManageCategoryKey, number] => [c.key, i]),
    ['unknown', 99],
  ]);
  const sorted = [...products].sort((a, b) => {
    const ai = order.get(resolveManageCategory(a.category)) ?? 99;
    const bi = order.get(resolveManageCategory(b.category)) ?? 99;
    if (ai !== bi) return ai - bi;
    return a.name.localeCompare(b.name, 'es');
  });
  const buckets = new Map<ManageCategoryKey, T[]>();
  for (const product of sorted) {
    const key = resolveManageCategory(product.category);
    const list = buckets.get(key);
    if (list) list.push(product);
    else buckets.set(key, [product]);
  }
  const sections: Array<{ key: ManageCategoryKey; title: string; emoji: string; data: T[] }> = [];
  for (const c of PRODUCT_CATEGORIES) {
    const data = buckets.get(c.key);
    if (data?.length) {
      sections.push({ key: c.key, title: c.label, emoji: c.emoji, data });
    }
  }
  const unknown = buckets.get('unknown');
  if (unknown?.length) {
    sections.push({ key: 'unknown', title: 'Sin categoría', emoji: '📦', data: unknown });
  }
  return sections;
}
