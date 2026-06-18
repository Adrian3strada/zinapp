import { useEffect, useState } from 'react';

import { configApi, type AppConfig } from '../services/api';

const DEFAULT_CONFIG: AppConfig = {
  online_payments_enabled: false,
  support_whatsapp: '',
  password_reset_via_whatsapp: false,
  coverage_label: 'Zinapécuaro, Michoacán',
};

let cachedConfig: AppConfig | null = null;
let loadPromise: Promise<AppConfig> | null = null;

async function fetchConfig(): Promise<AppConfig> {
  if (cachedConfig) return cachedConfig;
  if (loadPromise) return loadPromise;

  loadPromise = configApi
    .get()
    .then(({ data }) => {
      cachedConfig = data;
      return data;
    })
    .catch(() => DEFAULT_CONFIG)
    .finally(() => {
      loadPromise = null;
    });

  return loadPromise;
}

export function prefetchAppConfig(): Promise<AppConfig> {
  return fetchConfig();
}

export function useAppConfig() {
  const [config, setConfig] = useState<AppConfig>(cachedConfig ?? DEFAULT_CONFIG);
  const [loading, setLoading] = useState(!cachedConfig);

  useEffect(() => {
    let mounted = true;
    fetchConfig().then((data) => {
      if (mounted) {
        setConfig(data);
        setLoading(false);
      }
    });
    return () => {
      mounted = false;
    };
  }, []);

  return { config, loading };
}
