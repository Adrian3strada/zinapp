import { useCallback, useEffect, useState } from 'react';

import { rewardsApi } from '../services/api';
import type { RewardsPayload } from '../types';

export function useRewards(enabled = true) {
  const [rewards, setRewards] = useState<RewardsPayload | null>(null);
  const [loading, setLoading] = useState(enabled);

  const refresh = useCallback(async () => {
    if (!enabled) {
      setRewards(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const { data } = await rewardsApi.me();
      setRewards(data);
    } catch {
      setRewards(null);
    } finally {
      setLoading(false);
    }
  }, [enabled]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { rewards, loading, refresh };
}
