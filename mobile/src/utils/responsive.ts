import { Dimensions, Platform } from 'react-native';

import { spacing } from '../theme/spacing';

/** Ancho máximo del marco en móvil web (pantallas muy anchas). */
export const WEB_MOBILE_FRAME_MAX = 520;
/** Breakpoint: desde aquí layout desktop (sidebar, grillas). */
export const WEB_BREAKPOINT_DESKTOP = 768;
/** Ancho máximo del contenido en laptop/desktop. */
export const WEB_DESKTOP_MAX_WIDTH = 1280;
export const WEB_DESKTOP_SIDEBAR_WIDTH = 240;

/** @deprecated Usar WEB_MOBILE_FRAME_MAX o contentMaxWidth del hook. */
export const WEB_MAX_WIDTH = WEB_MOBILE_FRAME_MAX;

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const BASE_WIDTH = 375;

function layoutWidth(): number {
  if (Platform.OS === 'web') {
    if (SCREEN_WIDTH >= WEB_BREAKPOINT_DESKTOP) {
      return Math.min(SCREEN_WIDTH - WEB_DESKTOP_SIDEBAR_WIDTH, WEB_DESKTOP_MAX_WIDTH);
    }
    return Math.min(SCREEN_WIDTH, WEB_MOBILE_FRAME_MAX);
  }
  return SCREEN_WIDTH;
}

function layoutHeight(): number {
  return SCREEN_HEIGHT;
}

export function scale(size: number): number {
  const scaled = (layoutWidth() / BASE_WIDTH) * size;
  return Math.round(scaled);
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

export function mapHeight(fraction = 0.38): number {
  return clamp(layoutHeight() * fraction, 220, 420);
}

export function contentWidth(padding = spacing.screen): number {
  return layoutWidth() - padding * 2;
}

export const FLATLIST_TUNING = {
  initialNumToRender: 10,
  maxToRenderPerBatch: 8,
  windowSize: 7,
  // false: evita que botones en headers/footers dejen de responder al toque
  removeClippedSubviews: false,
} as const;
