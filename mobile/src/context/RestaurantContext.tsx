import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

import { restaurantApi } from '../services/api';
import type { Product, Restaurant } from '../types';
import { appAlert } from '../utils/appAlert';
import { getApiErrorMessage } from '../utils/apiErrors';

type MyRestaurant = Restaurant & { products?: Product[] };

interface RestaurantContextValue {
  restaurant: MyRestaurant | null;
  loading: boolean;
  error: string | null;
  togglingOrders: boolean;
  refresh: () => Promise<void>;
  toggleAcceptingOrders: (value: boolean) => Promise<void>;
}

const RestaurantContext = createContext<RestaurantContextValue | null>(null);

export function RestaurantProvider({ children }: { children: React.ReactNode }) {
  const [restaurant, setRestaurant] = useState<MyRestaurant | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [togglingOrders, setTogglingOrders] = useState(false);

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

  const toggleAcceptingOrders = useCallback(async (value: boolean) => {
    if (!restaurant || togglingOrders) return;
    if (!restaurant.is_active) {
      appAlert(
        'Local pendiente',
        'Tu negocio aún no está activo. Completa menú y perfil; el equipo ZinApp lo publicará.',
      );
      return;
    }
    const previous = restaurant.accepting_orders !== false;
    setRestaurant((prev) => (prev ? { ...prev, accepting_orders: value } : prev));
    setTogglingOrders(true);
    try {
      const { data } = await restaurantApi.patch(restaurant.id, { accepting_orders: value });
      setRestaurant((prev) => (prev ? { ...prev, ...data } : data));
    } catch (err) {
      setRestaurant((prev) => (prev ? { ...prev, accepting_orders: previous } : prev));
      appAlert('Error', getApiErrorMessage(err, 'No se pudo actualizar el estado del local'));
    } finally {
      setTogglingOrders(false);
    }
  }, [restaurant, togglingOrders]);

  const value = useMemo(
    () => ({
      restaurant,
      loading,
      error,
      togglingOrders,
      refresh,
      toggleAcceptingOrders,
    }),
    [restaurant, loading, error, togglingOrders, refresh, toggleAcceptingOrders],
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
