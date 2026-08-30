import React from 'react';
import { StyleSheet, View } from 'react-native';

import { SEASONAL_THEME } from '../../config/seasonalTheme';
import { useSeasonalTheme } from '../../hooks/useSeasonalTheme';

const PICADO = Array.from({ length: 18 }, (_, i) => SEASONAL_THEME.colors.stripe[i % 3]);

const CONFETTI: {
  top?: number;
  right?: number;
  left?: number;
  bottom?: number;
  size: number;
  color: string;
  rotate: string;
}[] = [
  { top: 18, right: 72, size: 5, color: SEASONAL_THEME.colors.green, rotate: '18deg' },
  { top: 36, right: 28, size: 4, color: SEASONAL_THEME.colors.white, rotate: '-12deg' },
  { top: 58, right: 54, size: 4, color: SEASONAL_THEME.colors.red, rotate: '28deg' },
  { top: 22, left: 18, size: 4, color: 'rgba(255,255,255,0.55)', rotate: '-24deg' },
  { bottom: 28, left: 46, size: 5, color: SEASONAL_THEME.colors.green, rotate: '8deg' },
];

/** Papel picado y confeti. pointerEvents none: no tapa botones ni el avatar. */
export default function SeasonalHeaderDecor() {
  const { active } = useSeasonalTheme();
  if (!active) return null;

  return (
    <View pointerEvents="none" style={styles.layer} accessible={false} importantForAccessibility="no">
      {CONFETTI.map((dot, index) => (
        <View
          key={`dot-${index}`}
          style={[
            styles.dot,
            {
              width: dot.size,
              height: dot.size,
              backgroundColor: dot.color,
              transform: [{ rotate: dot.rotate }],
              top: dot.top,
              right: dot.right,
              left: dot.left,
              bottom: dot.bottom,
            },
          ]}
        />
      ))}
      <View style={styles.picadoRow}>
        {PICADO.map((color, index) => (
          <View key={`flag-${index}`} style={[styles.flag, { borderTopColor: color }]} />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  layer: {
    ...StyleSheet.absoluteFillObject,
    overflow: 'hidden',
  },
  dot: {
    position: 'absolute',
    borderRadius: 2,
    opacity: 0.55,
  },
  picadoRow: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: -1,
    flexDirection: 'row',
    justifyContent: 'center',
    opacity: 0.42,
  },
  flag: {
    width: 0,
    height: 0,
    marginHorizontal: 1,
    borderLeftWidth: 7,
    borderRightWidth: 7,
    borderTopWidth: 8,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
  },
});
