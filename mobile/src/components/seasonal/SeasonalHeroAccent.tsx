import React from 'react';
import { StyleSheet, View } from 'react-native';

import { SEASONAL_THEME } from '../../config/seasonalTheme';
import { useSeasonalTheme } from '../../hooks/useSeasonalTheme';
import SeasonalStripe from './SeasonalStripe';

const PICADO = Array.from({ length: 14 }, (_, i) => SEASONAL_THEME.colors.stripe[i % 3]);

/** Franja + papel picado para cualquier hero. Sin confeti (eso queda en Home). */
export default function SeasonalHeroAccent() {
  const { active } = useSeasonalTheme();
  if (!active) return null;

  return (
    <View pointerEvents="none" style={styles.layer} accessible={false} importantForAccessibility="no">
      <View style={styles.top}>
        <SeasonalStripe height={6} />
      </View>
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
  top: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
  },
  picadoRow: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 4,
  },
  flag: {
    width: 0,
    height: 0,
    borderLeftWidth: 9,
    borderRightWidth: 9,
    borderTopWidth: 14,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
  },
});
