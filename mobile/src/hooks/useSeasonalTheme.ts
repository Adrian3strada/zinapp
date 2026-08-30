import { useMemo } from 'react';

import {
  getSeasonalCopy,
  isMexicanCategory,
  isSeasonalActive,
  isSeasonalMexicanCategory,
  SEASONAL_THEME,
} from '../config/seasonalTheme';

/** Lee la ambientación de temporada. Barato: se recalcula en cada render. */
export function useSeasonalTheme() {
  const active = isSeasonalActive();
  return useMemo(
    () => ({
      active,
      type: SEASONAL_THEME.type,
      colors: SEASONAL_THEME.colors,
      copy: getSeasonalCopy(),
      isMexicanCategory,
      isSeasonalMexicanCategory,
    }),
    [active],
  );
}
