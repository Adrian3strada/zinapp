import { useMemo } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { spacing } from '../theme/spacing';
import { useResponsiveLayout } from '../hooks/useResponsiveLayout';
import {
  keyboardOffsetHeaderless,
  keyboardOffsetWithHeader,
  tabScreenBottomPadding,
} from '../utils/screenInsets';

/** Insets + helpers para pantallas con tab bar inferior. */
export function useTabScreenInsets() {
  const insets = useSafeAreaInsets();
  const { isDesktopWeb, pagePadding } = useResponsiveLayout();

  const bottomExtra = isDesktopWeb ? spacing.lg : spacing.lg;

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
