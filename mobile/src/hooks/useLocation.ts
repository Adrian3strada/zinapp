import * as Location from 'expo-location';
import { useCallback, useState } from 'react';

import type { MapCoordinate } from '../utils/maps';

export function useLocation() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const getCurrentPosition = useCallback(async (): Promise<MapCoordinate | null> => {
    setLoading(true);
    setError(null);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setError('Permiso de ubicación denegado');
        return null;
      }
      const position = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      return {
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
      };
    } catch {
      setError('No se pudo obtener la ubicación');
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  return { getCurrentPosition, loading, error };
}
