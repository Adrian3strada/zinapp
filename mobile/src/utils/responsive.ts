import { Dimensions } from 'react-native';

import { spacing } from '../theme/spacing';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const BASE_WIDTH = 375;

export function scale(size: number): number {
  const scaled = (SCREEN_WIDTH / BASE_WIDTH) * size;
  return Math.round(scaled);
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

export function mapHeight(fraction = 0.38): number {
  return clamp(SCREEN_HEIGHT * fraction, 220, 420);
}

export function contentWidth(padding = spacing.screen): number {
  return SCREEN_WIDTH - padding * 2;
}

export const FLATLIST_TUNING = {
  initialNumToRender: 10,
  maxToRenderPerBatch: 8,
  windowSize: 7,
  // false: evita que botones en headers/footers dejen de responder al toque
  removeClippedSubviews: false,
} as const;
