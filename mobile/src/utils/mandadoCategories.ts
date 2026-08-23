export type MandadoCategory = 'verdura' | 'fruta' | 'legumbre' | 'otro';

export type MandadoUnit = 'kg' | 'g';

export interface MandadoItem {
  id: string;
  name: string;
  quantity: string;
  unit: MandadoUnit;
  category: MandadoCategory;
}

export const MANDADO_CATEGORIES: {
  key: MandadoCategory;
  label: string;
  emoji: string;
  examples: string[];
}[] = [
  { key: 'verdura', label: 'Verdura', emoji: '🥬', examples: ['Tomate', 'Cebolla', 'Lechuga', 'Chile'] },
  { key: 'fruta', label: 'Fruta', emoji: '🍎', examples: ['Plátano', 'Manzana', 'Naranja', 'Aguacate'] },
  { key: 'legumbre', label: 'Legumbre', emoji: '🫘', examples: ['Frijol', 'Lenteja', 'Garbanzo', 'Alverja'] },
  { key: 'otro', label: 'Otro', emoji: '🛒', examples: ['Huevo', 'Leche', 'Pan', 'Aceite'] },
];

export const MANDADO_STORE_SUGGESTIONS = [
  'Central de abastos',
  'Soriana',
  'Bodega Aurrera',
  'Mercado municipal',
  'Tiendita de la esquina',
];

export function formatMandadoItem(item: Pick<MandadoItem, 'name' | 'quantity' | 'unit'>): string {
  const qty = item.quantity.trim();
  return `${item.name.trim()} ${qty}${item.unit}`;
}

export function createMandadoItem(
  partial: Partial<MandadoItem> & Pick<MandadoItem, 'name'>,
): MandadoItem {
  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    name: partial.name.trim(),
    quantity: partial.quantity?.trim() || '1',
    unit: partial.unit ?? 'kg',
    category: partial.category ?? 'otro',
  };
}
