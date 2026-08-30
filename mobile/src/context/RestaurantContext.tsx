import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

import RestaurantCreateSheet, {
  type CreateRestaurantPayload,
} from '../components/restaurant/RestaurantCreateSheet';
import RestaurantSwitcherSheet from '../components/restaurant/RestaurantSwitcherSheet';
import { restaurantApi } from '../services/api';
import type { OwnedRestaurant, Product, Restaurant } from '../types';
import { appAlert } from '../utils/appAlert';
import { getApiErrorMessage } from '../utils/apiErrors';

type MyRestaurant = Restaurant & { products?: Product[] };

interface RestaurantContextValue {
  restaurant: MyRestaurant | null;
  owned: OwnedRestaurant[];
  canSwitch: boolean;
  canAdd: boolean;
  switching: boolean;
  creating: boolean;
  loading: boolean;
  error: string | null;
  togglingOrders: boolean;
  refresh: () => Promise<void>;
  toggleAcceptingOrders: (value: boolean) => Promise<void>;
  selectRestaurant: (id: number) => Promise<void>;
  openSwitcher: () => void;
  openCreate: () => void;
}

const RestaurantContext = createContext<RestaurantContextValue | null>(null);

export function RestaurantProvider({ children }: { children: React.ReactNode }) {
  const [restaurant, setRestaurant] = useState<MyRestaurant | null>(null);
  const [owned, setOwned] = useState<OwnedRestaurant[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [togglingOrders, setTogglingOrders] = useState(false);
  const [switching, setSwitching] = useState(false);
  const [creating, setCreating] = useState(false);
  const [switcherOpen, setSwitcherOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);

  const refresh = useCallback(async () => {
    setError(null);
    try {
      const [mineRes, ownedRes] = await Promise.all([
        restaurantApi.mine(),
        restaurantApi.owned().catch(() => ({ data: [] as OwnedRestaurant[] })),
      ]);
      setRestaurant(mineRes.data);
      setOwned(ownedRes.data);
    } catch {
      setRestaurant(null);
      setOwned([]);
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
    setOwned((prev) =>
      prev.map((item) =>
        item.id === restaurant.id ? { ...item, accepting_orders: value } : item,
      ),
    );
    setTogglingOrders(true);
    try {
      const { data } = await restaurantApi.patch(restaurant.id, { accepting_orders: value });
      setRestaurant((prev) => (prev ? { ...prev, ...data } : data));
    } catch (err) {
      setRestaurant((prev) => (prev ? { ...prev, accepting_orders: previous } : prev));
      setOwned((prev) =>
        prev.map((item) =>
          item.id === restaurant.id ? { ...item, accepting_orders: previous } : item,
        ),
      );
      appAlert('Error', getApiErrorMessage(err, 'No se pudo actualizar el estado del local'));
    } finally {
      setTogglingOrders(false);
    }
  }, [restaurant, togglingOrders]);

  const selectRestaurant = useCallback(async (id: number) => {
    if (switching || id === restaurant?.id) {
      setSwitcherOpen(false);
      return;
    }
    setSwitching(true);
    try {
      await restaurantApi.select(id);
      await refresh();
      setSwitcherOpen(false);
    } catch (err) {
      appAlert('Error', getApiErrorMessage(err, 'No se pudo cambiar de local'));
    } finally {
      setSwitching(false);
    }
  }, [refresh, restaurant?.id, switching]);

  const openSwitcher = useCallback(() => {
    if (owned.length > 1) setSwitcherOpen(true);
  }, [owned.length]);

  const openCreate = useCallback(() => {
    setSwitcherOpen(false);
    setCreateOpen(true);
  }, []);

  const createRestaurant = useCallback(async (payload: CreateRestaurantPayload) => {
    if (creating) return;
    setCreating(true);
    try {
      await restaurantApi.createOwned(payload);
      await refresh();
      setCreateOpen(false);
      appAlert(
        'Local creado',
        'Quedó pendiente. Completa menú y perfil; el equipo ZinApp lo publicará.',
      );
    } catch (err) {
      appAlert('Error', getApiErrorMessage(err, 'No se pudo crear el local'));
    } finally {
      setCreating(false);
    }
  }, [creating, refresh]);

  const value = useMemo(
    () => ({
      restaurant,
      owned,
      canSwitch: owned.length > 1,
      canAdd: owned.length < 8,
      switching,
      creating,
      loading,
      error,
      togglingOrders,
      refresh,
      toggleAcceptingOrders,
      selectRestaurant,
      openSwitcher,
      openCreate,
    }),
    [
      restaurant,
      owned,
      switching,
      creating,
      loading,
      error,
      togglingOrders,
      refresh,
      toggleAcceptingOrders,
      selectRestaurant,
      openSwitcher,
      openCreate,
    ],
  );

  return (
    <RestaurantContext.Provider value={value}>
      {children}
      <RestaurantSwitcherSheet
        visible={switcherOpen}
        owned={owned}
        switching={switching}
        canAdd={owned.length < 8}
        onClose={() => setSwitcherOpen(false)}
        onSelect={(id) => {
          void selectRestaurant(id);
        }}
        onAdd={openCreate}
      />
      <RestaurantCreateSheet
        visible={createOpen}
        saving={creating}
        onClose={() => setCreateOpen(false)}
        onSubmit={(payload) => {
          void createRestaurant(payload);
        }}
      />
    </RestaurantContext.Provider>
  );
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
