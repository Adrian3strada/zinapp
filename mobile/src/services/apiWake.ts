import axios from 'axios';

import { API_TIMEOUT_MS, API_URL } from '../config/api';

const WAKE_TIMEOUT_MS = Math.min(API_TIMEOUT_MS, 45000);
const MAX_WAKE_ATTEMPTS = 2;

let wakeInFlight: Promise<boolean> | null = null;
let lastWakeAt = 0;
const WAKE_COOLDOWN_MS = 15_000;

export function isRetryableNetworkError(error: unknown): boolean {
  const err = error as { response?: unknown; message?: string; code?: string };
  if (err.response) return false;
  const msg = err.message ?? '';
  return (
    msg.includes('Network Error')
    || msg.includes('network')
    || err.code === 'ERR_NETWORK'
    || err.code === 'ECONNABORTED'
    || msg.includes('timeout')
  );
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

const POST_NO_RETRY = [
  '/orders/',
  '/shipments/',
  '/auth/register/',
  '/products/',
  '/reviews/',
];

export function canRetryOnNetworkError(method?: string, url?: string): boolean {
  const normalized = (method ?? 'get').toUpperCase();
  if (normalized === 'GET' || normalized === 'HEAD' || normalized === 'OPTIONS') {
    return true;
  }
  if (normalized === 'PATCH' || normalized === 'PUT' || normalized === 'DELETE') {
    return true;
  }
  if (normalized === 'POST') {
    const path = url ?? '';
    if (POST_NO_RETRY.some((segment) => path.includes(segment))) {
      return false;
    }
    return true;
  }
  return false;
}

export function isMutationMethod(method?: string): boolean {
  const normalized = (method ?? 'get').toUpperCase();
  return normalized !== 'GET' && normalized !== 'HEAD' && normalized !== 'OPTIONS';
}

/** Despierta Railway antes de peticiones críticas (cold start). */
export async function wakeBackend(force = false): Promise<boolean> {
  const now = Date.now();
  if (!force && now - lastWakeAt < WAKE_COOLDOWN_MS) {
    return true;
  }
  if (wakeInFlight) return wakeInFlight;

  wakeInFlight = (async () => {
    for (let attempt = 0; attempt < MAX_WAKE_ATTEMPTS; attempt += 1) {
      try {
        await axios.get(`${API_URL}/health/`, { timeout: WAKE_TIMEOUT_MS });
        lastWakeAt = Date.now();
        return true;
      } catch {
        if (attempt < MAX_WAKE_ATTEMPTS - 1) {
          await sleep(2000 * (attempt + 1));
        }
      }
    }
    return false;
  })().finally(() => {
    wakeInFlight = null;
  });

  return wakeInFlight;
}
