import { useEffect, useMemo, useState } from 'react';
import { Platform, useWindowDimensions } from 'react-native';
import type { EdgeInsets } from 'react-native-safe-area-context';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { spacing } from '../theme/spacing';
import { WEB_BREAKPOINT_DESKTOP } from './responsive';

/** Padding mínimo bajo el home indicator / gesture bar. */
export function safeBottomPadding(insets: EdgeInsets, min: number = spacing.md): number {
  return Math.max(insets.bottom, min);
}

/**
 * Padding inferior para pantallas dentro de tabs.
 * - Web móvil: la tab bar es `position: fixed` y se superpone al contenido.
 * - Native: la escena ya queda encima de la tab bar; solo hace falta respiro.
 */
export function tabScreenBottomPadding(insets: EdgeInsets, extra: number = spacing.lg): number {
  if (Platform.OS === 'web') {
    return spacing.tabBar + Math.max(insets.bottom, 0) + extra;
  }
  return extra;
}

/** Offset de teclado en tabs sin header nativo (Perfil, Menú restaurante). */
export function keyboardOffsetHeaderless(insets: EdgeInsets): number {
  if (Platform.OS !== 'ios') return 0;
  return Math.max(insets.top, 0);
}

/** Offset cuando hay header de stack/tab visible (~44pt + status). */
export function keyboardOffsetWithHeader(insets: EdgeInsets): number {
  if (Platform.OS !== 'ios') return 0;
  return Math.max(insets.top, 0) + 44;
}

function useLayoutTabHints() {
  const rnDims = useWindowDimensions();
  const [viewport, setViewport] = useState<{ width: number; height: number } | null>(() => {
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      return { width: window.innerWidth, height: window.innerHeight };
    }
    return null;
  });

  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return;

    const sync = () => setViewport({ width: window.innerWidth, height: window.innerHeight });
    sync();
    window.addEventListener('resize', sync);
    return () => window.removeEventListener('resize', sync);
  }, []);

  const width = viewport?.width ?? rnDims.width;
  const isDesktopWeb = Platform.OS === 'web' && width >= WEB_BREAKPOINT_DESKTOP;
  const pagePadding = isDesktopWeb ? 32 : 16;

  return { isDesktopWeb, pagePadding };
}

/** Insets + helpers para pantallas con tab bar inferior. */
export function useTabScreenInsets() {
  const insets = useSafeAreaInsets();
  const { isDesktopWeb, pagePadding } = useLayoutTabHints();
  const bottomExtra = spacing.lg;

  return useMemo(
    () => ({
      insets,
      pagePadding,
      isDesktopWeb,
      tabBottomPadding: (extra: number = spacing.lg) =>
        isDesktopWeb ? insets.bottom + extra : tabScreenBottomPadding(insets, extra),
      keyboardHeaderless: () => keyboardOffsetHeaderless(insets),
      keyboardWithHeader: () => keyboardOffsetWithHeader(insets),
      listPaddingBottom: (extra: number = bottomExtra) => ({
        paddingBottom: isDesktopWeb
          ? insets.bottom + extra
          : tabScreenBottomPadding(insets, extra),
      }),
      scrollPaddingBottom: (extra: number = bottomExtra) => ({
        paddingBottom: isDesktopWeb
          ? insets.bottom + extra
          : tabScreenBottomPadding(insets, extra),
      }),
    }),
    [insets, isDesktopWeb, pagePadding, bottomExtra],
  );
}
