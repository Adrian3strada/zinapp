import { useCallback, useRef } from 'react';

/** Evita doble toque en acciones async (guardar, toggle, aceptar pedido, etc.). */
export function useActionGuard() {
  const inFlight = useRef(false);

  const runGuarded = useCallback(async <T>(action: () => Promise<T>): Promise<T | null> => {
    if (inFlight.current) return null;
    inFlight.current = true;
    try {
      return await action();
    } finally {
      inFlight.current = false;
    }
  }, []);

  const isRunning = useCallback(() => inFlight.current, []);

  return { runGuarded, isRunning };
}
