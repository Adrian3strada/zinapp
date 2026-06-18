import { useMemo } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { spacing } from '../theme/spacing';
import {
  keyboardOffsetHeaderless,
  keyboardOffsetWithHeader,
  tabScreenBottomPadding,
} from '../utils/screenInsets';

/** Insets + helpers para pantallas con tab bar inferior. */
export function useTabScreenInsets() {
  const insets = useSafeAreaInsets();

  return useMemo(
    () => ({
      insets,
      tabBottomPadding: (extra: number = spacing.lg) => tabScreenBottomPadding(insets, extra),
      keyboardHeaderless: () => keyboardOffsetHeaderless(insets),
      keyboardWithHeader: () => keyboardOffsetWithHeader(insets),
      listPaddingBottom: (extra: number = spacing.lg) => ({
        paddingBottom: tabScreenBottomPadding(insets, extra),
      }),
      scrollPaddingBottom: (extra: number = spacing.lg) => ({
        paddingBottom: tabScreenBottomPadding(insets, extra),
      }),
    }),
    [insets],
  );
}
