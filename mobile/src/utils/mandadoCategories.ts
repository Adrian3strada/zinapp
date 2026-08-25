export type MandadoCategory =
  | 'verdura'
  | 'fruta'
  | 'legumbre'
  | 'carnes'
  | 'abarrotes'
  | 'lacteos'
  | 'bebidas'
  | 'limpieza'
  | 'farmacia'
  | 'otro';

export type MandadoUnit = 'kg' | 'g' | 'pza' | 'lt' | 'paq';

export interface MandadoItem {
  id: string;
  name: string;
  quantity?: string;
  unit?: MandadoUnit;
  category: MandadoCategory;
  notes?: string;
}

export const MANDADO_STORE_SUGGESTIONS = [
  'Mercado municipal',
  'Bodega Aurrera',
  '3 B',
] as const;

export const MANDADO_STEPS = [
  { icon: 'list-outline' as const, title: 'Arma tu lista', body: 'Productos sueltos, por pieza o por peso.' },
  { icon: 'storefront-outline' as const, title: 'Elige la tienda', body: 'Dinos dónde comprar.' },
  { icon: 'bicycle-outline' as const, title: 'Te lo llevamos', body: 'Un repartidor compra y entrega.' },
] as const;

export const QUICK_QTY_ARTICLE = [1, 2, 3, 6] as const;
export const QUICK_QTY_WEIGHT_KG = [0.5, 1, 2] as const;

export const MANDADO_CATEGORIES: {
  key: MandadoCategory;
  label: string;
  emoji: string;
  examples: string[];
  defaultMode: 'article' | 'weight';
  articleUnits?: MandadoUnit[];
}[] = [
  {
    key: 'verdura',
    label: 'Verdura',
    emoji: '🥬',
    examples: ['Jitomate', 'Cebolla', 'Lechuga', 'Chile', 'Papa'],
    defaultMode: 'weight',
  },
  {
    key: 'fruta',
    label: 'Fruta',
    emoji: '🍎',
    examples: ['Plátano', 'Manzana', 'Naranja', 'Aguacate', 'Sandía'],
    defaultMode: 'weight',
  },
  {
    key: 'legumbre',
    label: 'Legumbre',
    emoji: '🫘',
    examples: ['Frijol', 'Lenteja', 'Garbanzo', 'Alverja', 'Soya'],
    defaultMode: 'weight',
  },
  {
    key: 'carnes',
    label: 'Carnes',
    emoji: '🥩',
    examples: ['Pollo', 'Res molida', 'Chuleta', 'Longaniza', 'Jamón'],
    defaultMode: 'weight',
  },
  {
    key: 'abarrotes',
    label: 'Abarrotes',
    emoji: '🍞',
    examples: ['Pan', 'Arroz', 'Aceite', 'Azúcar', 'Sal'],
    defaultMode: 'article',
    articleUnits: ['pza', 'paq'],
  },
  {
    key: 'lacteos',
    label: 'Lácteos',
    emoji: '🥛',
    examples: ['Leche', 'Huevo', 'Queso', 'Yogurt', 'Crema'],
    defaultMode: 'article',
    articleUnits: ['pza', 'lt'],
  },
  {
    key: 'bebidas',
    label: 'Bebidas',
    emoji: '🥤',
    examples: ['Refresco', 'Agua', 'Jugo', 'Cerveza', 'Café'],
    defaultMode: 'article',
    articleUnits: ['pza', 'lt', 'paq'],
  },
  {
    key: 'limpieza',
    label: 'Limpieza',
    emoji: '🧴',
    examples: ['Jabón', 'Cloro', 'Detergente', 'Papel', 'Esponja'],
    defaultMode: 'article',
    articleUnits: ['pza', 'paq'],
  },
  {
    key: 'farmacia',
    label: 'Farmacia',
    emoji: '💊',
    examples: ['Paracetamol', 'Alcohol', 'Pañales', 'Vitaminas', 'Curitas'],
    defaultMode: 'article',
  },
  {
    key: 'otro',
    label: 'Otro',
    emoji: '🛒',
    examples: ['Snacks', 'Pilas', 'Focos', 'Utensilios', 'Lo que falte'],
    defaultMode: 'article',
  },
];

export function getCategoryMeta(category: MandadoCategory) {
  return MANDADO_CATEGORIES.find((c) => c.key === category);
}

export function categoryDefaultMode(category: MandadoCategory): 'article' | 'weight' {
  return getCategoryMeta(category)?.defaultMode ?? 'article';
}

export function categoryArticleUnits(category: MandadoCategory): MandadoUnit[] {
  return getCategoryMeta(category)?.articleUnits ?? ['pza', 'paq', 'lt'];
}

export function formatMandadoItem(
  item: Pick<MandadoItem, 'name'> & {
    quantity?: string | number | null;
    unit?: MandadoUnit | string | null;
  },
): string {
  const name = item.name.trim();
  if (!name) return '';

  const rawQty = item.quantity;
  const unit = item.unit;
  if (rawQty == null || rawQty === '' || !unit) {
    return name;
  }

  const qtyStr = String(rawQty).trim().replace(',', '.');
  const qtyNum = parseFloat(qtyStr);
  if (!Number.isFinite(qtyNum) || qtyNum <= 0) {
    return name;
  }

  const label = Number.isInteger(qtyNum) ? String(qtyNum) : qtyStr;

  if (unit === 'pza') {
    return qtyNum === 1 ? name : `${name} (${label} pza)`;
  }
  if (unit === 'paq') {
    return qtyNum === 1 ? name : `${name} (${label} paq)`;
  }
  if (unit === 'lt') {
    return `${name} ${label} lt`;
  }
  return `${name} ${label}${unit}`;
}

export function createMandadoItem(
  partial: Partial<MandadoItem> & Pick<MandadoItem, 'name'>,
): MandadoItem {
  const quantity = partial.quantity?.trim();
  const unit = partial.unit;
  const hasMeasure = Boolean(quantity && unit);
  const notes = partial.notes?.trim();

  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    name: partial.name.trim(),
    quantity: hasMeasure ? quantity : undefined,
    unit: hasMeasure ? unit : undefined,
    category: partial.category ?? 'otro',
    notes: notes || undefined,
  };
}

export type MandadoDraft = {
  name: string;
  notes?: string;
  quantity?: string;
  mode: 'article' | 'weight';
  unit: MandadoUnit;
  articleUnit: MandadoUnit;
  category: MandadoCategory;
};

/** Convierte lo escrito en el formulario. La cantidad es opcional en ambos modos. */
export function mandadoDraftToItem(
  draft: MandadoDraft,
): { ok: true; item: MandadoItem } | { ok: false; reason: 'empty_name' | 'bad_qty' } {
  const name = draft.name.trim().slice(0, 80);
  if (!name) return { ok: false, reason: 'empty_name' };
  const notes = draft.notes?.trim().slice(0, 120) || undefined;
  const qtyText = (draft.quantity ?? '').trim().replace(',', '.');
  if (!qtyText) {
    return { ok: true, item: createMandadoItem({ name, notes, category: draft.category }) };
  }
  const qty = parseFloat(qtyText);
  if (!Number.isFinite(qty) || qty <= 0) return { ok: false, reason: 'bad_qty' };
  const unit =
    draft.mode === 'weight'
      ? (draft.unit === 'g' || draft.unit === 'kg' ? draft.unit : 'kg')
      : draft.articleUnit;
  return {
    ok: true,
    item: createMandadoItem({
      name,
      notes,
      quantity: String(Number.isInteger(qty) ? qty : Number(qty.toFixed(2))),
      unit,
      category: draft.category,
    }),
  };
}

export function mandadoItemToPayload(item: MandadoItem) {
  const payload: {
    name: string;
    category: MandadoCategory;
    quantity?: number;
    unit?: MandadoUnit;
    notes?: string;
  } = {
    name: item.name.slice(0, 80),
    category: item.category,
  };
  if (item.quantity && item.unit) {
    payload.quantity = Number(parseFloat(item.quantity).toFixed(2));
    payload.unit = item.unit;
  }
  if (item.notes?.trim()) {
    payload.notes = item.notes.trim().slice(0, 120);
  }
  return payload;
}
