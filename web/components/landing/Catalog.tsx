'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import {
  catalogSearchString,
  EMPTY_FILTER,
  openNameSet,
  parseCatalogSearch,
  type CatalogFilter,
  type CatalogKind,
} from '@/lib/catalog';
import type { BusinessCard } from '@/lib/types';

type CatalogContextValue = {
  filter: CatalogFilter;
  openNames: Set<string>;
  applySearch: (query: string) => void;
  applyKind: (kind: CatalogKind) => void;
  toggleOpenNow: () => void;
  clearFilters: () => void;
  isFiltered: boolean;
};

const CatalogContext = createContext<CatalogContextValue | null>(null);

export function scrollToId(id: string) {
  const node = document.getElementById(id);
  if (!node) return;
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  node.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
}

export function useCatalog() {
  const value = useContext(CatalogContext);
  if (!value) {
    throw new Error('useCatalog necesita CatalogProvider');
  }
  return value;
}

export function CatalogProvider({
  children,
  businesses,
}: {
  children: ReactNode;
  businesses: BusinessCard[];
}) {
  const [filter, setFilter] = useState<CatalogFilter>(EMPTY_FILTER);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setFilter(parseCatalogSearch(window.location.search));
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    const next = `${catalogSearchString(filter)}${window.location.hash}`;
    window.history.replaceState(null, '', next);
  }, [filter, hydrated]);

  const openNames = useMemo(() => openNameSet(businesses), [businesses]);

  const applySearch = useCallback((query: string) => {
    setFilter((current) => ({ ...current, query: query.trim() }));
    window.setTimeout(() => scrollToId('destacados'), 0);
  }, []);

  const applyKind = useCallback((kind: CatalogKind) => {
    setFilter((current) => ({ ...current, kind }));
    window.setTimeout(() => scrollToId('destacados'), 0);
  }, []);

  const toggleOpenNow = useCallback(() => {
    setFilter((current) => ({ ...current, openNow: !current.openNow }));
    window.setTimeout(() => scrollToId('destacados'), 0);
  }, []);

  const clearFilters = useCallback(() => {
    setFilter(EMPTY_FILTER);
  }, []);

  const isFiltered = Boolean(filter.query || filter.openNow || filter.kind !== 'all');

  const value = useMemo(
    () => ({
      filter,
      openNames,
      applySearch,
      applyKind,
      toggleOpenNow,
      clearFilters,
      isFiltered,
    }),
    [filter, openNames, applySearch, applyKind, toggleOpenNow, clearFilters, isFiltered],
  );

  return <CatalogContext.Provider value={value}>{children}</CatalogContext.Provider>;
}

export function FilterBar() {
  const { filter, applyKind, toggleOpenNow, clearFilters, isFiltered } = useCatalog();
  const status = [
    filter.query ? `Resultados para “${filter.query}”` : '',
    filter.openNow ? 'Solo abiertos ahora' : '',
    filter.kind === 'food' ? 'Comida y restaurantes' : '',
    filter.kind === 'service' ? 'Servicios locales' : '',
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <div className="catalog-bar">
      <div className="catalog-chips" role="toolbar" aria-label="Filtrar negocios">
        <button
          type="button"
          className="catalog-chip"
          aria-pressed={filter.kind === 'all'}
          onClick={() => applyKind('all')}
        >
          Todos
        </button>
        <button
          type="button"
          className="catalog-chip catalog-chip-open"
          aria-pressed={filter.openNow}
          onClick={toggleOpenNow}
        >
          Abierto ahora
        </button>
        <button
          type="button"
          className="catalog-chip"
          aria-pressed={filter.kind === 'food'}
          onClick={() => applyKind('food')}
        >
          Comida
        </button>
        <button
          type="button"
          className="catalog-chip"
          aria-pressed={filter.kind === 'service'}
          onClick={() => applyKind('service')}
        >
          Servicios
        </button>
      </div>
      <p className="catalog-status" aria-live="polite">
        {status || 'Filtra esta lista sin salir de la página.'}
        {isFiltered ? (
          <>
            {' '}
            <button type="button" className="catalog-clear" onClick={clearFilters}>
              Quitar filtros
            </button>
          </>
        ) : null}
      </p>
    </div>
  );
}
