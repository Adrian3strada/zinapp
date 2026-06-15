export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  screen: 16,
  card: 16,
  gap: 12,
  tabBar: 56,
  floatingBar: 72,
} as const;

/** Área extra de toque para botones (evita taps perdidos). */
export const HIT_SLOP = { top: 8, bottom: 8, left: 8, right: 8 } as const;
