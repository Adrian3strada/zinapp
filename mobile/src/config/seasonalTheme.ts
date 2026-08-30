import { colors } from '../theme/colors';

/**
 * Ambientación temporal de septiembre.
 * Un solo lugar para activar, textos, acentos y categorías patrias.
 * Después del 17 de septiembre se apaga sola; o pon `enabled: false`.
 */
export const SEASONAL_THEME = {
  enabled: true,
  /** Forzar preview fuera del periodo. Dejar en false en producción. */
  forceActive: false,
  type: 'september_mexico' as const,
  timeZone: 'America/Mexico_City',
  startDate: '2026-08-30',
  endDate: '2026-09-17',
  colors: {
    green: '#006847',
    white: '#FFFFFF',
    red: '#CE1126',
    categoryWash: '#D8F3E3',
    bannerBg: '#FFF8F0',
    bannerBorder: 'rgba(206, 17, 38, 0.28)',
    stripe: ['#006847', '#FFFFFF', '#CE1126'] as const,
  },
  mexicanCategoryKeys: ['mexicana', 'tacos', 'antojitos', 'tortas', 'fondas'] as const,
  copy: {
    bannerTitle: '¡Viva México en ZinApp!',
    bannerSubtitle: 'Orgullo local, sabor mexicano. Este mes patrio, pide en casa.',
    categoriesTitle: '¿Qué se antoja hoy?',
    categoriesCaption: '🌮 Sabe a México',
    flavorsTitle: '🇲🇽 Sabores de septiembre',
    searchPlaceholder: 'Tacos, pozole, mole, antojitos…',
    loadingHint: 'Hoy se antoja algo muy mexicano 🇲🇽',
    emptySubtitle: 'Este mes patrio, apoya local',
    headerKicker: 'Mes patrio',
  },
};

export type SeasonalThemeType = typeof SEASONAL_THEME.type;

export function calendarDateInZone(
  now: Date = new Date(),
  timeZone: string = SEASONAL_THEME.timeZone,
): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
}

export function isSeasonalActive(now: Date = new Date()): boolean {
  if (!SEASONAL_THEME.enabled) return false;
  if (SEASONAL_THEME.forceActive) return true;
  const today = calendarDateInZone(now, SEASONAL_THEME.timeZone);
  return today >= SEASONAL_THEME.startDate && today <= SEASONAL_THEME.endDate;
}

export function isMexicanCategory(key: string | null | undefined): boolean {
  if (!key) return false;
  return (SEASONAL_THEME.mexicanCategoryKeys as readonly string[]).includes(key);
}

export function isSeasonalMexicanCategory(key: string | null | undefined): boolean {
  return isSeasonalActive() && isMexicanCategory(key);
}

export function seasonalCategoryWash(key: string | null | undefined, fallback: string): string {
  if (!isSeasonalMexicanCategory(key)) return fallback;
  return SEASONAL_THEME.colors.categoryWash;
}

export function seasonalMexicanChipStyle(key: string | null | undefined): {
  borderColor: string;
  backgroundColor: string;
} | null {
  if (!isSeasonalMexicanCategory(key)) return null;
  return {
    borderColor: SEASONAL_THEME.colors.green,
    backgroundColor: SEASONAL_THEME.colors.categoryWash,
  };
}

export function getSeasonalCopy() {
  return isSeasonalActive() ? SEASONAL_THEME.copy : null;
}
