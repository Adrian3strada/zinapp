import { useCallback, useEffect, useRef, useState } from 'react';

import type { PaginatedResponse } from '../types';
import { getApiErrorMessage } from '../utils/apiErrors';

type FetchPage<T> = (page: number) => Promise<PaginatedResponse<T>>;

export function dedupeById<T extends { id: number }>(list: T[]): T[] {
  const seen = new Set<number>();
  return list.filter((item) => {
    if (seen.has(item.id)) return false;
    seen.add(item.id);
    return true;
  });
}

export function usePaginatedList<T extends { id: number }>(
  fetchPage: FetchPage<T>,
  deps: unknown[] = [],
  errorFallback = 'No se pudieron cargar los datos',
) {
  const [items, setItems] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const pageRef = useRef(1);
  const generationRef = useRef(0);
  const loadingMoreRef = useRef(false);

  const loadPage = useCallback(
    async (page: number, mode: 'initial' | 'refresh' | 'more', generation: number) => {
      if (mode === 'initial') setLoading(true);
      if (mode === 'refresh') setRefreshing(true);
      if (mode === 'more') {
        setLoadingMore(true);
        loadingMoreRef.current = true;
      }
      if (mode !== 'more') setError(null);

      try {
        const data = await fetchPage(page);
        if (generation !== generationRef.current) return;

        setItems((prev) =>
          dedupeById(page === 1 ? data.results : [...prev, ...data.results]),
        );
        setHasMore(data.next != null);
        pageRef.current = page;
      } catch (err) {
        if (generation !== generationRef.current) return;
        if (mode === 'more') {
          setError(getApiErrorMessage(err, 'No se pudo cargar más datos'));
          return;
        }
        setError(getApiErrorMessage(err, errorFallback));
      } finally {
        if (generation !== generationRef.current) return;
        setLoading(false);
        setRefreshing(false);
        setLoadingMore(false);
        loadingMoreRef.current = false;
      }
    },
    [fetchPage, errorFallback],
  );

  const refresh = useCallback(() => {
    generationRef.current += 1;
    pageRef.current = 1;
    loadingMoreRef.current = false;
    return loadPage(1, 'refresh', generationRef.current);
  }, [loadPage]);

  const loadMore = useCallback(() => {
    if (loadingMoreRef.current || !hasMore || loading || refreshing) return;
    loadPage(pageRef.current + 1, 'more', generationRef.current);
  }, [hasMore, loading, refreshing, loadPage]);

  useEffect(() => {
    generationRef.current += 1;
    pageRef.current = 1;
    loadingMoreRef.current = false;
    setItems([]);
    loadPage(1, 'initial', generationRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return { items, setItems, loading, refreshing, loadingMore, error, hasMore, refresh, loadMore };
}
