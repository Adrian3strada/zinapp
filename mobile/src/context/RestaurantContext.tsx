import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

import { restaurantApi } from '../services/api';
import type { Product, Restaurant } from '../types';

type MyRestaurant = Restaurant & { products?: Product[] };

interface RestaurantContextValue {
  restaurant: MyRestaurant | null;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

const RestaurantContext = createContext<RestaurantContextValue | null>(null);

export function RestaurantProvider({ children }: { children: React.ReactNode }) {
  const [restaurant, setRestaurant] = useState<MyRestaurant | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setError(null);
    try {
      const { data } = await restaurantApi.mine();
      setRestaurant(data);
    } catch {
      setRestaurant(null);
      setError('No se pudo cargar tu restaurante');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const value = useMemo(
    () => ({ restaurant, loading, error, refresh }),
    [restaurant, loading, error, refresh],
  );

  return <RestaurantContext.Provider value={value}>{children}</RestaurantContext.Provider>;
}

export function useRestaurantContext() {
  const ctx = useContext(RestaurantContext);
  if (!ctx) {
    throw new Error('useRestaurantContext must be used within RestaurantProvider');
  }
  return ctx;
}

export function useOptionalRestaurantContext() {
  return useContext(RestaurantContext);
}
