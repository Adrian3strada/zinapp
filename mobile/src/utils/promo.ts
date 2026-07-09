import type { Product, ProductPromotion, PromoType } from '../types';

export function isPromotionActive(promo: ProductPromotion | null | undefined): boolean {
  if (!promo) return false;
  const until = new Date(promo.valid_until).getTime();
  return Number.isFinite(until) && until >= Date.now();
}

export function promoDisplayLabel(promo: ProductPromotion): string {
  if (promo.display_label?.trim()) return promo.display_label.trim();
  if (promo.label?.trim()) return promo.label.trim();
  if (promo.promo_type === 'two_for_one') return '2x1';
  if (promo.promo_type === 'percent_off' && promo.percent_off) return `${promo.percent_off}% OFF`;
  if (promo.promo_type === 'special_price') return 'Precio promo';
  return promo.promo_type_display ?? 'Promo';
}

export function calculatePromoLineTotal(
  product: Product,
  quantity: number,
): { total: number; promo: ProductPromotion | null } {
  const qty = Math.max(Math.floor(quantity), 0);
  const price = parseFloat(product.price);
  const base = (Number.isFinite(price) ? price : 0) * qty;
  const promo = isPromotionActive(product.active_promotion) ? product.active_promotion! : null;

  if (!promo || qty === 0) {
    return { total: base, promo: null };
  }

  if (promo.promo_type === 'two_for_one') {
    const paidUnits = Math.ceil(qty / 2);
    return { total: (Number.isFinite(price) ? price : 0) * paidUnits, promo };
  }

  if (promo.promo_type === 'percent_off' && promo.percent_off) {
    return { total: base * (100 - promo.percent_off) / 100, promo };
  }

  if (promo.promo_type === 'special_price' && promo.special_price != null) {
    const special = parseFloat(promo.special_price);
    return { total: (Number.isFinite(special) ? special : 0) * qty, promo };
  }

  return { total: base, promo: null };
}

export function promoPriceHint(product: Product): string | null {
  const promo = product.active_promotion;
  if (!isPromotionActive(promo)) return null;

  const price = parseFloat(product.price);
  if (!Number.isFinite(price)) return promoDisplayLabel(promo!);

  if (promo!.promo_type === 'two_for_one') {
    return `${promoDisplayLabel(promo!)} · 2 por ${price.toFixed(2)}`;
  }
  if (promo!.promo_type === 'percent_off' && promo!.percent_off) {
    const discounted = price * (100 - promo!.percent_off) / 100;
    return `${promoDisplayLabel(promo!)} · $${discounted.toFixed(2)}`;
  }
  if (promo!.promo_type === 'special_price' && promo!.special_price != null) {
    return `${promoDisplayLabel(promo!)} · $${parseFloat(promo!.special_price).toFixed(2)}`;
  }
  return promoDisplayLabel(promo!);
}

export const PROMO_TYPE_OPTIONS: { key: PromoType; label: string; hint: string }[] = [
  { key: 'two_for_one', label: '2x1', hint: 'Paga 1 y lleva 2 (por cada par).' },
  { key: 'percent_off', label: '% OFF', hint: 'Descuento porcentual sobre el precio.' },
  { key: 'special_price', label: 'Precio fijo', hint: 'Precio promocional por unidad.' },
];

export function formatPromoUntil(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleString('es-MX', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function buildValidUntilIso(dateStr: string, timeStr: string): string | null {
  const dateMatch = dateStr.trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!dateMatch) return null;
  const timeMatch = (timeStr.trim() || '23:59').match(/^(\d{1,2}):(\d{2})$/);
  if (!timeMatch) return null;
  const year = Number(dateMatch[1]);
  const month = Number(dateMatch[2]);
  const day = Number(dateMatch[3]);
  const hour = Number(timeMatch[1]);
  const minute = Number(timeMatch[2]);
  if (month < 1 || month > 12 || day < 1 || day > 31 || hour > 23 || minute > 59) return null;
  const local = new Date(year, month - 1, day, hour, minute, 0);
  if (Number.isNaN(local.getTime())) return null;
  return local.toISOString();
}

export function defaultPromoEndDate(): string {
  return addDaysToDate(todayIsoDate(), 7);
}

export function todayIsoDate(): string {
  const now = new Date();
  return toIsoDate(now.getFullYear(), now.getMonth() + 1, now.getDate());
}

export function toIsoDate(year: number, month: number, day: number): string {
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

export function parseIsoDate(dateStr: string): { year: number; month: number; day: number } | null {
  const match = dateStr.trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  const probe = new Date(year, month - 1, day);
  if (probe.getFullYear() !== year || probe.getMonth() !== month - 1 || probe.getDate() !== day) return null;
  return { year, month, day };
}

export function addDaysToDate(dateStr: string, days: number): string {
  const parsed = parseIsoDate(dateStr);
  if (!parsed) return dateStr;
  const date = new Date(parsed.year, parsed.month - 1, parsed.day);
  date.setDate(date.getDate() + days);
  return toIsoDate(date.getFullYear(), date.getMonth() + 1, date.getDate());
}

export function formatPromoExpirySummary(dateStr: string, timeStr: string): string {
  const parsed = parseIsoDate(dateStr);
  if (!parsed) return `${dateStr} ${timeStr}`;
  const date = new Date(parsed.year, parsed.month - 1, parsed.day);
  const timeMatch = (timeStr.trim() || '23:59').match(/^(\d{1,2}):(\d{2})$/);
  const hour = timeMatch ? Number(timeMatch[1]) : 23;
  const minute = timeMatch ? Number(timeMatch[2]) : 59;
  date.setHours(hour, minute, 0, 0);
  return date.toLocaleString('es-MX', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function promoUntilParts(iso: string): { day: string; month: string; weekday: string } | null {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  return {
    day: date.toLocaleDateString('es-MX', { day: 'numeric' }),
    month: date.toLocaleDateString('es-MX', { month: 'short' }).replace('.', '').toUpperCase(),
    weekday: date.toLocaleDateString('es-MX', { weekday: 'short' }).replace('.', ''),
  };
}

export const PROMO_TIME_PRESETS = [
  { label: 'Mediodía', value: '12:00' },
  { label: '6 pm', value: '18:00' },
  { label: '9 pm', value: '21:00' },
  { label: 'Fin del día', value: '23:59' },
] as const;

export const PROMO_DURATION_PRESETS = [
  { label: '3 días', days: 3 },
  { label: '1 semana', days: 7 },
  { label: '2 semanas', days: 14 },
  { label: '1 mes', days: 30 },
] as const;
