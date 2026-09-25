import type { BusinessCard, DishCard, PromoCard } from './types';

export type CatalogKind = 'all' | 'food' | 'service';

export type CatalogFilter = {
  query: string;
  openNow: boolean;
  kind: CatalogKind;
};

export const EMPTY_FILTER: CatalogFilter = {
  query: '',
  openNow: false,
  kind: 'all',
};

export function fold(value: string): string {
  return value
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

export function matchesQuery(parts: Array<string | undefined | null>, query: string): boolean {
  const q = fold(query);
  if (!q) return true;
  const blob = fold(parts.filter(Boolean).join(' '));
  return q.split(' ').every((token) => blob.includes(token));
}

export function isServiceBiz(biz: Pick<BusinessCard, 'source' | 'category' | 'name'>): boolean {
  if (biz.source === 'service') return true;
  if (biz.source === 'restaurant') return false;
  return /servicio|belleza|peluquer|taller|salud|salon/.test(
    fold(`${biz.category} ${biz.name}`),
  );
}

export function matchesKind(biz: BusinessCard, kind: CatalogKind): boolean {
  if (kind === 'all') return true;
  if (kind === 'service') return isServiceBiz(biz);
  return !isServiceBiz(biz);
}

export function matchesBusiness(biz: BusinessCard, filter: CatalogFilter): boolean {
  if (filter.openNow && biz.is_open_now !== true) return false;
  if (!matchesKind(biz, filter.kind)) return false;
  return matchesQuery(
    [biz.name, biz.category, biz.description, biz.location, biz.schedule],
    filter.query,
  );
}

export function openNameSet(businesses: BusinessCard[]): Set<string> {
  return new Set(
    businesses.filter((biz) => biz.is_open_now === true).map((biz) => fold(biz.name)),
  );
}

export function matchesDish(
  dish: DishCard,
  filter: CatalogFilter,
  openNames: Set<string>,
): boolean {
  if (filter.kind === 'service') return false;
  if (filter.openNow && !openNames.has(fold(dish.restaurant))) return false;
  return matchesQuery([dish.name, dish.restaurant, dish.description], filter.query);
}

export function matchesPromo(
  promo: PromoCard,
  filter: CatalogFilter,
  openNames: Set<string>,
): boolean {
  if (filter.kind === 'service') return false;
  if (filter.openNow && !openNames.has(fold(promo.restaurant))) return false;
  return matchesQuery([promo.title, promo.product, promo.restaurant], filter.query);
}

export function whatsappShareUrl(name: string, url: string): string {
  const text = `Mira ${name} en ZinApp (Zinapécuaro)\n${url}`;
  return `https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`;
}

export function parseCatalogSearch(search: string): CatalogFilter {
  const params = new URLSearchParams(search.startsWith('?') ? search.slice(1) : search);
  const tipo = params.get('tipo');
  return {
    query: params.get('q') || '',
    openNow: params.get('abierto') === '1',
    kind: tipo === 'food' || tipo === 'service' ? tipo : 'all',
  };
}

export function catalogSearchString(filter: CatalogFilter): string {
  const params = new URLSearchParams();
  if (filter.query) params.set('q', filter.query);
  if (filter.openNow) params.set('abierto', '1');
  if (filter.kind !== 'all') params.set('tipo', filter.kind);
  const qs = params.toString();
  return qs ? `/?${qs}` : '/';
}
