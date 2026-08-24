import { useCallback, useEffect, useState } from 'react';

import { useAuth } from '../context/AuthContext';
import { productApi, restaurantApi } from '../services/api';
import { getApiErrorMessage } from '../utils/apiErrors';
import { appAlert } from '../utils/appAlert';
import { trackEvent } from '../utils/analytics';

type Kind = 'restaurant' | 'product';

export function useFavoriteToggle(kind: Kind, id: number, initial = false) {
  const { user, isGuest, requestLogin } = useAuth();
  const [favorited, setFavorited] = useState(initial);
  const [busy, setBusy] = useState(false);
  const canFavorite = !!user && !isGuest && user.role === 'customer';

  useEffect(() => {
    setFavorited(initial);
  }, [initial]);

  const toggle = useCallback(async () => {
    if (!canFavorite) {
      requestLogin();
      return;
    }
    if (busy || !id) return;
    setBusy(true);
    const previous = favorited;
    setFavorited(!previous);
    try {
      const { data } = kind === 'restaurant'
        ? await restaurantApi.toggleFavorite(id)
        : await productApi.toggleFavorite(id);
      setFavorited(data.is_favorited);
      trackEvent(data.is_favorited ? 'favorite_added' : 'favorite_removed', {
        kind,
        id,
      });
    } catch (err) {
      setFavorited(previous);
      appAlert('Favoritos', getApiErrorMessage(err, 'No se pudo actualizar el favorito.'));
    } finally {
      setBusy(false);
    }
  }, [busy, canFavorite, favorited, id, kind, requestLogin]);

  return { favorited, busy, toggle, canFavorite };
}
