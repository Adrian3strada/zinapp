import { afterEach, describe, expect, it } from 'vitest';

import {
  calendarDateInZone,
  isMexicanCategory,
  isSeasonalActive,
  seasonalCategoryWash,
  SEASONAL_THEME,
} from './seasonalTheme';

const original = {
  enabled: SEASONAL_THEME.enabled,
  forceActive: SEASONAL_THEME.forceActive,
  startDate: SEASONAL_THEME.startDate,
  endDate: SEASONAL_THEME.endDate,
};

afterEach(() => {
  SEASONAL_THEME.enabled = original.enabled;
  SEASONAL_THEME.forceActive = original.forceActive;
  SEASONAL_THEME.startDate = original.startDate;
  SEASONAL_THEME.endDate = original.endDate;
});

function atMexico(isoLocal: string): Date {
  return new Date(`${isoLocal}-06:00`);
}

describe('seasonalTheme', () => {
  it('usa calendario de Ciudad de México', () => {
    expect(calendarDateInZone(atMexico('2026-09-01T00:00:00'))).toBe('2026-09-01');
    expect(calendarDateInZone(new Date('2026-09-01T05:30:00Z'))).toBe('2026-08-31');
  });

  it('se activa el 1 y se apaga el 18 de septiembre', () => {
    SEASONAL_THEME.forceActive = false;
    SEASONAL_THEME.enabled = true;
    expect(isSeasonalActive(atMexico('2026-08-31T23:59:00'))).toBe(false);
    expect(isSeasonalActive(atMexico('2026-09-01T00:00:00'))).toBe(true);
    expect(isSeasonalActive(atMexico('2026-09-17T23:30:00'))).toBe(true);
    expect(isSeasonalActive(atMexico('2026-09-18T00:00:00'))).toBe(false);
  });

  it('respeta enabled y forceActive', () => {
    SEASONAL_THEME.enabled = false;
    SEASONAL_THEME.forceActive = false;
    expect(isSeasonalActive(atMexico('2026-09-05T12:00:00'))).toBe(false);

    SEASONAL_THEME.enabled = true;
    SEASONAL_THEME.forceActive = true;
    expect(isSeasonalActive(atMexico('2026-08-10T12:00:00'))).toBe(true);
  });

  it('solo marca categorías mexicanas existentes', () => {
    expect(isMexicanCategory('mexicana')).toBe(true);
    expect(isMexicanCategory('tacos')).toBe(true);
    expect(isMexicanCategory('pizzas')).toBe(false);
    expect(isMexicanCategory(null)).toBe(false);
  });

  it('solo lava el tint de categorías mexicanas en temporada', () => {
    SEASONAL_THEME.enabled = true;
    SEASONAL_THEME.forceActive = false;
    SEASONAL_THEME.startDate = '2099-09-01';
    SEASONAL_THEME.endDate = '2099-09-17';
    expect(seasonalCategoryWash('mexicana', '#FFE8CC')).toBe('#FFE8CC');

    SEASONAL_THEME.forceActive = true;
    expect(seasonalCategoryWash('mexicana', '#FFE8CC')).toBe(SEASONAL_THEME.colors.categoryWash);
    expect(seasonalCategoryWash('pizzas', '#FED7AA')).toBe('#FED7AA');
  });
});
