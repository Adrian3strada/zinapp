import { useEffect, useRef } from 'react';
import { AppState, type AppStateStatus } from 'react-native';

/** Corre al volver a primer plano (no en el mount). */
export function useOnAppActive(onActive: () => void): void {
  const appState = useRef<AppStateStatus>(AppState.currentState);
  const onActiveRef = useRef(onActive);
  onActiveRef.current = onActive;

  useEffect(() => {
    const sub = AppState.addEventListener('change', (next) => {
      const wasBackground = appState.current === 'background' || appState.current === 'inactive';
      appState.current = next;
      if (wasBackground && next === 'active') {
        onActiveRef.current();
      }
    });
    return () => sub.remove();
  }, []);
}
