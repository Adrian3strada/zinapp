import type { PaginatedResponse } from '../types';

/** Carga todas las páginas de un endpoint paginado (útil para mapas/filtros locales). */
export async function fetchAllPages<T>(
  fetchPage: (page: number) => Promise<PaginatedResponse<T>>,
): Promise<T[]> {
  const all: T[] = [];
  let page = 1;
  let hasMore = true;

  while (hasMore) {
    const data = await fetchPage(page);
    all.push(...data.results);
    hasMore = data.next != null;
    page += 1;
  }

  return all;
}
