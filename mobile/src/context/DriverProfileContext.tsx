import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { appAlert } from '../utils/appAlert';

import { deliveryApi } from '../services/api';
import { getApiErrorMessage } from '../utils/apiErrors';

interface DriverProfileContextValue {
  isAvailable: boolean;
  loading: boolean;
  updating: boolean;
  toggleAvailability: (value: boolean) => Promise<void>;
  refresh: () => Promise<void>;
}

const DriverProfileContext = createContext<DriverProfileContextValue | null>(null);

export function DriverProfileProvider({ children }: { children: React.ReactNode }) {
  const [isAvailable, setIsAvailable] = useState(false);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const { data } = await deliveryApi.getProfile();
      setIsAvailable(data.is_available);
    } catch {
      setIsAvailable(false);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const toggleAvailability = useCallback(async (value: boolean) => {
    if (updating) return;
    const previous = isAvailable;
    setIsAvailable(value);
    setUpdating(true);
    try {
      await deliveryApi.setAvailability(value);
    } catch (err) {
      setIsAvailable(previous);
      appAlert('Disponibilidad', getApiErrorMessage(err, 'No se pudo actualizar tu estado.'));
    } finally {
      setUpdating(false);
    }
  }, [isAvailable, updating]);

  const value = useMemo(
    () => ({ isAvailable, loading, updating, toggleAvailability, refresh }),
    [isAvailable, loading, updating, toggleAvailability, refresh],
  );

  return <DriverProfileContext.Provider value={value}>{children}</DriverProfileContext.Provider>;
}

export function useDriverProfileContext(): DriverProfileContextValue {
  const ctx = useContext(DriverProfileContext);
  if (!ctx) {
    throw new Error('useDriverProfileContext must be used within DriverProfileProvider');
  }
  return ctx;
}
