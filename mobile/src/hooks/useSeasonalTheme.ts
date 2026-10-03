import { useMemo } from 'react';

import {
  getActiveCampaign,
  getSeasonalCopy,
  isFeaturedSeasonalCategory,
  isMexicanCategory,
  isSeasonalActive,
} from '../config/seasonalTheme';

/** Lee la ambientación de temporada. Barato: se recalcula en cada render. */
export function useSeasonalTheme() {
  const active = isSeasonalActive();
  const campaign = getActiveCampaign();
  return useMemo(
    () => ({
      active,
      type: campaign?.type ?? null,
      colors: campaign?.colors ?? null,
      copy: getSeasonalCopy(),
      confettiEmojis: campaign?.confettiEmojis ?? null,
      isMexicanCategory,
      isFeaturedSeasonalCategory,
      isSeasonalMexicanCategory: isFeaturedSeasonalCategory,
    }),
    [active, campaign],
  );
}
