/**
 * Ambientación temporal de ZinApp.
 * Campañas por fechas (Ciudad de México). Se apagan solas; o `enabled: false`.
 */

export const SEASONAL = {
  enabled: true,
  /** Forzar preview fuera del periodo. Dejar en false en producción. */
  forceActive: false,
  previewType: 'october_halloween' as SeasonalThemeType,
  timeZone: 'America/Mexico_City',
};

export type SeasonalThemeType = 'september_mexico' | 'october_halloween';

export type SeasonalCampaign = {
  type: SeasonalThemeType;
  startDate: string;
  endDate: string;
  colors: {
    accent: string;
    accentAlt: string;
    white: string;
    categoryWash: string;
    bannerBorder: string;
    locationWash: string;
    stripe: readonly [string, string, string];
  };
  highlightCategoryKeys: readonly string[];
  copy: {
    bannerKicker: string;
    bannerTitle: string;
    bannerSubtitle: string;
    categoriesTitle: string;
    categoriesCaption: string;
    flavorsTitle: string;
    searchPlaceholder: string;
    loadingHint: string;
    emptySubtitle: string;
    headerKicker: string;
    sidebarLine: string;
    emoji: string;
    quickFoodEmoji: string;
    foodEmojis: readonly [string, string, string];
  };
  confettiEmojis: readonly string[];
};

const MEXICAN_CATEGORY_KEYS = ['mexicana', 'tacos', 'antojitos', 'tortas', 'fondas'] as const;

export const CAMPAIGNS: readonly SeasonalCampaign[] = [
  {
    type: 'october_halloween',
    startDate: '2026-10-01',
    endDate: '2026-11-02',
    colors: {
      accent: '#EA580C',
      accentAlt: '#6D28D9',
      white: '#FFF7ED',
      categoryWash: '#FFEDD5',
      bannerBorder: 'rgba(234, 88, 12, 0.55)',
      locationWash: 'rgba(234, 88, 12, 0.38)',
      stripe: ['#EA580C', '#18181B', '#6D28D9'],
    },
    highlightCategoryKeys: ['antojitos', 'postres', 'mexicana', 'tacos', 'bebidas'],
    copy: {
      bannerKicker: 'Octubre en ZinApp',
      bannerTitle: 'Halloween en ZinApp',
      bannerSubtitle: 'Antojos de noche, calabaza y ofrenda. Pide en casa, sin sustos.',
      categoriesTitle: '¿Qué se antoja hoy?',
      categoriesCaption: '🎃 Dulce o antojo',
      flavorsTitle: '🎃 Antojos de octubre',
      searchPlaceholder: 'Tacos, pizza, pan de muerto, postres…',
      loadingHint: 'Se cocina algo embrujado 🎃',
      emptySubtitle: 'Este octubre, pide sin salir',
      headerKicker: 'Halloween',
      sidebarLine: 'Zinapécuaro · Halloween',
      emoji: '🎃',
      quickFoodEmoji: '🎃',
      foodEmojis: ['🎃', '👻', '🍬'],
    },
    confettiEmojis: ['🎃', '👻', '🦇', '💀', '🍬', '✨'],
  },
  {
    type: 'september_mexico',
    startDate: '2027-08-30',
    endDate: '2027-09-17',
    colors: {
      accent: '#006847',
      accentAlt: '#CE1126',
      white: '#FFFFFF',
      categoryWash: '#D8F3E3',
      bannerBorder: 'rgba(206, 17, 38, 0.28)',
      locationWash: 'rgba(0, 104, 71, 0.35)',
      stripe: ['#006847', '#FFFFFF', '#CE1126'],
    },
    highlightCategoryKeys: MEXICAN_CATEGORY_KEYS,
    copy: {
      bannerKicker: 'Orgullo local',
      bannerTitle: '¡Viva México en ZinApp!',
      bannerSubtitle: 'Orgullo local, sabor mexicano. Este mes patrio, pide en casa.',
      categoriesTitle: '¿Qué se antoja hoy?',
      categoriesCaption: '🌮 Sabe a México',
      flavorsTitle: '🇲🇽 Sabores de septiembre',
      searchPlaceholder: 'Tacos, pozole, mole, antojitos…',
      loadingHint: 'Hoy se antoja algo muy mexicano 🇲🇽',
      emptySubtitle: 'Este mes patrio, apoya local',
      headerKicker: 'Mes patrio',
      sidebarLine: 'Zinapécuaro · Mes patrio',
      emoji: '🇲🇽',
      quickFoodEmoji: '🌮',
      foodEmojis: ['🌮', '🫔', '🌶️'],
    },
    confettiEmojis: ['🎉', '✨', '🎊', '⭐', '🎉', '✨'],
  },
];

export function calendarDateInZone(
  now: Date = new Date(),
  timeZone: string = SEASONAL.timeZone,
): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
}

export function campaignForDate(
  now: Date = new Date(),
): SeasonalCampaign | null {
  const today = calendarDateInZone(now, SEASONAL.timeZone);
  return CAMPAIGNS.find((c) => today >= c.startDate && today <= c.endDate) ?? null;
}

export function getActiveCampaign(now: Date = new Date()): SeasonalCampaign | null {
  if (!SEASONAL.enabled) return null;
  const match = campaignForDate(now);
  if (match) return match;
  if (SEASONAL.forceActive) {
    return CAMPAIGNS.find((c) => c.type === SEASONAL.previewType) ?? CAMPAIGNS[0];
  }
  return null;
}

export function isSeasonalActive(now: Date = new Date()): boolean {
  return getActiveCampaign(now) != null;
}

export function isMexicanCategory(key: string | null | undefined): boolean {
  if (!key) return false;
  return (MEXICAN_CATEGORY_KEYS as readonly string[]).includes(key);
}

export function isFeaturedSeasonalCategory(key: string | null | undefined): boolean {
  if (!key) return false;
  const campaign = getActiveCampaign();
  if (!campaign) return false;
  return campaign.highlightCategoryKeys.includes(key);
}

/** @deprecated Usa isFeaturedSeasonalCategory */
export function isSeasonalMexicanCategory(key: string | null | undefined): boolean {
  return isFeaturedSeasonalCategory(key);
}

export function seasonalCategoryWash(key: string | null | undefined, fallback: string): string {
  const campaign = getActiveCampaign();
  if (!campaign || !key || !campaign.highlightCategoryKeys.includes(key)) return fallback;
  return campaign.colors.categoryWash;
}

export function seasonalFeaturedChipStyle(key: string | null | undefined): {
  borderColor: string;
  backgroundColor: string;
} | null {
  const campaign = getActiveCampaign();
  if (!campaign || !key || !campaign.highlightCategoryKeys.includes(key)) return null;
  return {
    borderColor: campaign.colors.accent,
    backgroundColor: campaign.colors.categoryWash,
  };
}

/** @deprecated Usa seasonalFeaturedChipStyle */
export function seasonalMexicanChipStyle(key: string | null | undefined) {
  return seasonalFeaturedChipStyle(key);
}

export function getSeasonalCopy(now: Date = new Date()) {
  return getActiveCampaign(now)?.copy ?? null;
}

/** Compat: campaña activa o la de preview (Halloween). */
export const SEASONAL_THEME = {
  get enabled() {
    return SEASONAL.enabled;
  },
  set enabled(value: boolean) {
    SEASONAL.enabled = value;
  },
  get forceActive() {
    return SEASONAL.forceActive;
  },
  set forceActive(value: boolean) {
    SEASONAL.forceActive = value;
  },
  get timeZone() {
    return SEASONAL.timeZone;
  },
  get type(): SeasonalThemeType {
    return getActiveCampaign()?.type ?? SEASONAL.previewType;
  },
  get colors() {
    return getActiveCampaign()?.colors ?? CAMPAIGNS[0].colors;
  },
  get copy() {
    return getActiveCampaign()?.copy ?? CAMPAIGNS[0].copy;
  },
};
