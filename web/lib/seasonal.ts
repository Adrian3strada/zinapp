/** Ambientación de temporada en la landing (Ciudad de México). */

const TIME_ZONE = 'America/Mexico_City';

export const HALLOWEEN = {
  startDate: '2026-10-01',
  endDate: '2026-11-02',
  badge: 'Halloween en ZinApp',
  kicker: 'Octubre en ZinApp',
  ticker: 'Antojos de octubre',
  emoji: '🎃',
};

export function calendarDateInMexico(now: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
}

export function isHalloweenActive(now: Date = new Date()): boolean {
  const today = calendarDateInMexico(now);
  return today >= HALLOWEEN.startDate && today <= HALLOWEEN.endDate;
}
