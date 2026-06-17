import { wakeBackend } from '../services/apiWake';
import { isRetryableNetworkError, sleep } from '../services/apiWake';

/**
 * Ejecuta una acción con despertar del servidor y un reintento si falla la red.
 */
export async function runWithRetry<T>(
  action: () => Promise<T>,
  options?: { retries?: number; wake?: boolean },
): Promise<T> {
  const retries = options?.retries ?? 1;
  const wake = options?.wake ?? true;

  if (wake) {
    await wakeBackend(true);
  }

  let lastError: unknown;
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      return await action();
    } catch (err) {
      lastError = err;
      if (attempt < retries && isRetryableNetworkError(err)) {
        await sleep(1800 * (attempt + 1));
        if (wake) await wakeBackend(true);
        continue;
      }
      throw err;
    }
  }
  throw lastError;
}
