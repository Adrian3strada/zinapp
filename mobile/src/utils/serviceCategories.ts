import type { LocalService } from '../types';

export const SERVICE_CATEGORIES = [
  { label: 'Todos', key: null, emoji: '✨' },
  { label: 'Belleza', key: 'beauty', emoji: '💇' },
  { label: 'Hogar', key: 'home', emoji: '🏠' },
  { label: 'Automotriz', key: 'auto', emoji: '🔧' },
  { label: 'Salud', key: 'health', emoji: '💊' },
  { label: 'Alimentos', key: 'food', emoji: '🥐' },
  { label: 'Otros', key: 'other', emoji: '📌' },
] as const;

export type ServiceCategoryKey = typeof SERVICE_CATEGORIES[number]['key'];

export function serviceMatchesCategory(
  service: LocalService,
  categoryKey: ServiceCategoryKey,
): boolean {
  if (!categoryKey) return true;
  return service.category === categoryKey;
}

export const SERVICE_CATEGORY_LABELS: Record<string, string> = Object.fromEntries(
  SERVICE_CATEGORIES.filter((c) => c.key != null).map((c) => [c.key!, c.label]),
);
