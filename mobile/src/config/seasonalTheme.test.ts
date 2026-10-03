import { afterEach, describe, expect, it } from 'vitest';

import {
  calendarDateInZone,
  campaignForDate,
  isFeaturedSeasonalCategory,
  isMexicanCategory,
  isSeasonalActive,
  seasonalCategoryWash,
  SEASONAL,
} from './seasonalTheme';

const original = {
  enabled: SEASONAL.enabled,
  forceActive: SEASONAL.forceActive,
  previewType: SEASONAL.previewType,
};

afterEach(() => {
  SEASONAL.enabled = original.enabled;
  SEASONAL.forceActive = original.forceActive;
  SEASONAL.previewType = original.previewType;
});

function atMexico(isoLocal: string): Date {
  return new Date(`${isoLocal}-06:00`);
}

describe('seasonalTheme', () => {
  it('usa calendario de Ciudad de México', () => {
    expect(calendarDateInZone(atMexico('2026-09-01T00:00:00'))).toBe('2026-09-01');
    expect(calendarDateInZone(new Date('2026-09-01T05:30:00Z'))).toBe('2026-08-31');
  });

  it('Halloween se activa el 1 de octubre y dura hasta Día de Muertos', () => {
    SEASONAL.forceActive = false;
    SEASONAL.enabled = true;
    expect(isSeasonalActive(atMexico('2026-09-30T23:59:00'))).toBe(false);
    expect(isSeasonalActive(atMexico('2026-10-01T00:00:00'))).toBe(true);
    expect(campaignForDate(atMexico('2026-10-31T20:00:00'))?.type).toBe('october_halloween');
    expect(isSeasonalActive(atMexico('2026-11-02T23:30:00'))).toBe(true);
    expect(isSeasonalActive(atMexico('2026-11-03T00:00:00'))).toBe(false);
  });

  it('septiembre 2027 sigue programado', () => {
    expect(campaignForDate(atMexico('2027-08-30T10:00:00'))?.type).toBe('september_mexico');
    expect(campaignForDate(atMexico('2027-09-17T22:00:00'))?.type).toBe('september_mexico');
    expect(campaignForDate(atMexico('2027-09-18T00:00:00'))).toBeNull();
  });

  it('respeta enabled y forceActive', () => {
    SEASONAL.enabled = false;
    SEASONAL.forceActive = false;
    expect(isSeasonalActive(atMexico('2026-10-15T12:00:00'))).toBe(false);

    SEASONAL.enabled = true;
    SEASONAL.forceActive = true;
    expect(isSeasonalActive(atMexico('2026-08-10T12:00:00'))).toBe(true);
  });

  it('solo marca categorías mexicanas existentes', () => {
    expect(isMexicanCategory('mexicana')).toBe(true);
    expect(isMexicanCategory('tacos')).toBe(true);
    expect(isMexicanCategory('pizzas')).toBe(false);
    expect(isMexicanCategory(null)).toBe(false);
  });

  it('en Halloween lava antojitos y postres, no pizzas', () => {
    SEASONAL.enabled = true;
    SEASONAL.forceActive = true;
    expect(isFeaturedSeasonalCategory('antojitos')).toBe(true);
    expect(isFeaturedSeasonalCategory('postres')).toBe(true);
    expect(seasonalCategoryWash('antojitos', '#FED7AA')).not.toBe('#FED7AA');
    expect(seasonalCategoryWash('pizzas', '#FED7AA')).toBe('#FED7AA');
  });
});
