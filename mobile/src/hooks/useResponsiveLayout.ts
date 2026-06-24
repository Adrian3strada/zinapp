import { useEffect, useMemo, useState } from 'react';
import { Platform, useWindowDimensions } from 'react-native';

import {
  WEB_BREAKPOINT_DESKTOP,
  WEB_DESKTOP_MAX_WIDTH,
  WEB_DESKTOP_SIDEBAR_WIDTH,
} from '../utils/responsive';

function readViewport() {
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    return { width: window.innerWidth, height: window.innerHeight };
  }
  return null;
}

export function useResponsiveLayout() {
  const rnDims = useWindowDimensions();
  const [viewport, setViewport] = useState(readViewport);

  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return;

    const sync = () => setViewport({ width: window.innerWidth, height: window.innerHeight });
    sync();
    window.addEventListener('resize', sync);
    return () => window.removeEventListener('resize', sync);
  }, []);

  const width = viewport?.width || rnDims.width;
  const height = viewport?.height || rnDims.height;

  return useMemo(() => {
    const isWeb = Platform.OS === 'web';
    const isDesktopWeb = isWeb && width >= WEB_BREAKPOINT_DESKTOP;
    const isMobileWeb = isWeb && width < WEB_BREAKPOINT_DESKTOP;
    const gridColumns = !isDesktopWeb ? 1 : width >= 1100 ? 3 : 2;
    const contentMaxWidth = isDesktopWeb
      ? Math.min(width - WEB_DESKTOP_SIDEBAR_WIDTH, WEB_DESKTOP_MAX_WIDTH)
      : width;
    const pagePadding = isDesktopWeb ? 32 : 16;

    return {
      width,
      height,
      isWeb,
      isDesktopWeb,
      isMobileWeb,
      gridColumns,
      contentMaxWidth,
      pagePadding,
      sidebarWidth: WEB_DESKTOP_SIDEBAR_WIDTH,
    };
  }, [width, height]);
}
