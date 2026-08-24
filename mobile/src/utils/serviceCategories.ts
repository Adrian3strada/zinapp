import type { Ionicons } from '@expo/vector-icons';
import type { LocalService } from '../types';
import { colors } from '../theme/colors';

export type ServiceCategoryIcon = keyof typeof Ionicons.glyphMap;

export const SERVICE_CATEGORIES = [
  { label: 'Todos', key: null, icon: 'apps-outline' as ServiceCategoryIcon },
  { label: 'Belleza', key: 'beauty', icon: 'cut-outline' as ServiceCategoryIcon },
  { label: 'Mecánicos', key: 'auto', icon: 'car-outline' as ServiceCategoryIcon },
  { label: 'Albañilería', key: 'construction', icon: 'hammer-outline' as ServiceCategoryIcon },
  { label: 'Plomería', key: 'plumbing', icon: 'water-outline' as ServiceCategoryIcon },
  { label: 'Electricista', key: 'electrical', icon: 'flash-outline' as ServiceCategoryIcon },
  { label: 'Hogar', key: 'home', icon: 'home-outline' as ServiceCategoryIcon },
  { label: 'Jardinería', key: 'garden', icon: 'leaf-outline' as ServiceCategoryIcon },
  { label: 'Tecnología', key: 'tech', icon: 'phone-portrait-outline' as ServiceCategoryIcon },
  { label: 'Mascotas', key: 'pets', icon: 'paw-outline' as ServiceCategoryIcon },
  { label: 'Salud', key: 'health', icon: 'medkit-outline' as ServiceCategoryIcon },
  { label: 'Alimentos', key: 'food', icon: 'cafe-outline' as ServiceCategoryIcon },
  { label: 'Lavandería', key: 'laundry', icon: 'shirt-outline' as ServiceCategoryIcon },
  { label: 'Clases', key: 'education', icon: 'school-outline' as ServiceCategoryIcon },
  { label: 'Otros', key: 'other', icon: 'storefront-outline' as ServiceCategoryIcon },
] as const;

export type ServiceCategoryKey = typeof SERVICE_CATEGORIES[number]['key'];

const CATEGORY_ICONS: Record<Exclude<ServiceCategoryKey, null>, ServiceCategoryIcon> = {
  beauty: 'cut-outline',
  auto: 'car-outline',
  construction: 'hammer-outline',
  plumbing: 'water-outline',
  electrical: 'flash-outline',
  home: 'home-outline',
  garden: 'leaf-outline',
  tech: 'phone-portrait-outline',
  pets: 'paw-outline',
  health: 'medkit-outline',
  food: 'cafe-outline',
  laundry: 'shirt-outline',
  education: 'school-outline',
  other: 'storefront-outline',
};

const CATEGORY_COLORS: Record<Exclude<ServiceCategoryKey, null>, string> = {
  beauty: colors.serviceEnd,
  auto: '#64748B',
  construction: '#B45309',
  plumbing: '#0284C7',
  electrical: '#CA8A04',
  home: '#0EA5E9',
  garden: '#16A34A',
  tech: '#6366F1',
  pets: '#DB2777',
  health: colors.success,
  food: colors.accent,
  laundry: '#8B5CF6',
  education: '#0D9488',
  other: colors.primary,
};

/** Palabras clave para emparejar servicios mal categorizados o genéricos. */
const CATEGORY_KEYWORDS: Record<Exclude<ServiceCategoryKey, null>, string[]> = {
  beauty: [
    'belleza', 'estetica', 'estética', 'barber', 'barberia', 'barbería',
    'peluqueria', 'peluquería', 'salon', 'salón', 'uñas', 'unas', 'spa',
    'maquillaje', 'corte',
  ],
  auto: [
    'mecanico', 'mecánico', 'mecanica', 'mecánica', 'taller', 'automotriz',
    'llanta', 'refaccion', 'refacción', 'auto', 'carro', 'moto', 'hojalateria',
    'hojalatería', 'pintura automotriz',
  ],
  construction: [
    'albanil', 'albañil', 'albanileria', 'albañilería', 'construccion',
    'construcción', 'yeso', 'tablaroca', 'obra', 'remodelacion', 'remodelación',
    'pintor', 'pintura casa',
  ],
  plumbing: [
    'plomeria', 'plomería', 'plomero', 'fontanero', 'tuberia', 'tubería',
    'fuga', 'drenaje', 'sanitario',
  ],
  electrical: [
    'electricista', 'electrico', 'eléctrico', 'instalacion electrica',
    'instalación eléctrica', 'cableado', 'corto',
  ],
  home: [
    'hogar', 'limpieza', 'aseo', 'doméstico', 'domestico', 'empleada',
    'mudanza', 'cerrajeria', 'cerrajería', 'cerrajero',
  ],
  garden: [
    'jardin', 'jardín', 'jardineria', 'jardinería', 'pasto', 'poda', 'plantas',
  ],
  tech: [
    'tecnologia', 'tecnología', 'celular', 'computadora', 'laptop', 'iphone',
    'android', 'reparacion celular', 'reparación', 'software', 'impresora',
  ],
  pets: [
    'mascota', 'veterinaria', 'veterinario', 'perro', 'gato', 'pet', 'estetica canina',
  ],
  health: [
    'salud', 'medico', 'médico', 'dental', 'dentista', 'farmacia', 'clinica',
    'clínica', 'fisioterapia', 'optica', 'óptica',
  ],
  food: [
    'alimento', 'panaderia', 'panadería', 'tortilleria', 'tortillería',
    'abarrotes', 'comida', 'catering', 'reposteria', 'repostería',
  ],
  laundry: [
    'lavanderia', 'lavandería', 'tintoreria', 'tintorería', 'lavado', 'planchado',
  ],
  education: [
    'clase', 'clases', 'escuela', 'curso', 'tutor', 'ingles', 'inglés',
    'musica', 'música', 'tarea',
  ],
  other: [],
};

function normalizeText(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

export function getServiceCategoryIcon(category?: string | null): ServiceCategoryIcon {
  if (category && category in CATEGORY_ICONS) {
    return CATEGORY_ICONS[category as Exclude<ServiceCategoryKey, null>];
  }
  return 'storefront-outline';
}

export function getServiceCategoryColor(category?: string | null): string {
  if (category && category in CATEGORY_COLORS) {
    return CATEGORY_COLORS[category as Exclude<ServiceCategoryKey, null>];
  }
  return colors.serviceStart;
}

export function serviceMatchesCategory(
  service: LocalService,
  categoryKey: ServiceCategoryKey,
): boolean {
  if (!categoryKey) return true;
  if (service.category === categoryKey) return true;

  // Solo fuzzy-match si el servicio está en "Otros" o sin categoría útil.
  const stored = (service.category || 'other').trim();
  if (stored !== 'other') return false;

  const haystack = normalizeText(
    [service.name, service.description ?? '', service.category_display ?? '', service.address ?? ''].join(' '),
  );
  const keywords = CATEGORY_KEYWORDS[categoryKey] ?? [];
  return keywords.some((kw) => {
    const needle = normalizeText(kw);
    return needle.length >= 4 && haystack.includes(needle);
  });
}

export const SERVICE_CATEGORY_LABELS: Record<string, string> = Object.fromEntries(
  SERVICE_CATEGORIES.filter((c) => c.key != null).map((c) => [c.key!, c.label]),
);
