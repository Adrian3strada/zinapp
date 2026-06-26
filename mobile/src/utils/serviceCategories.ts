import type { Ionicons } from '@expo/vector-icons';
import type { LocalService } from '../types';
import { colors } from '../theme/colors';

export type ServiceCategoryIcon = keyof typeof Ionicons.glyphMap;

export const SERVICE_CATEGORIES = [
  { label: 'Todos', key: null, icon: 'apps-outline' as ServiceCategoryIcon },
  { label: 'Belleza', key: 'beauty', icon: 'cut-outline' as ServiceCategoryIcon },
  { label: 'Hogar', key: 'home', icon: 'home-outline' as ServiceCategoryIcon },
  { label: 'Automotriz', key: 'auto', icon: 'construct-outline' as ServiceCategoryIcon },
  { label: 'Salud', key: 'health', icon: 'medkit-outline' as ServiceCategoryIcon },
  { label: 'Alimentos', key: 'food', icon: 'cafe-outline' as ServiceCategoryIcon },
  { label: 'Otros', key: 'other', icon: 'storefront-outline' as ServiceCategoryIcon },
] as const;

export type ServiceCategoryKey = typeof SERVICE_CATEGORIES[number]['key'];

const CATEGORY_ICONS: Record<string, ServiceCategoryIcon> = {
  beauty: 'cut-outline',
  home: 'home-outline',
  auto: 'construct-outline',
  health: 'medkit-outline',
  food: 'cafe-outline',
  other: 'storefront-outline',
};

const CATEGORY_COLORS: Record<string, string> = {
  beauty: colors.serviceEnd,
  home: '#0EA5E9',
  auto: '#64748B',
  health: colors.success,
  food: colors.accent,
  other: colors.primary,
};

export function getServiceCategoryIcon(category?: string | null): ServiceCategoryIcon {
  if (category && category in CATEGORY_ICONS) {
    return CATEGORY_ICONS[category];
  }
  return 'storefront-outline';
}

export function getServiceCategoryColor(category?: string | null): string {
  if (category && category in CATEGORY_COLORS) {
    return CATEGORY_COLORS[category];
  }
  return colors.serviceStart;
}

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
