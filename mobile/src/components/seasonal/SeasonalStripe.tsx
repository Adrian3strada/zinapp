import React from 'react';
import { StyleSheet, View } from 'react-native';

import { isSeasonalActive, SEASONAL_THEME } from '../../config/seasonalTheme';

/** Franja tricolor. Se oculta sola fuera de temporada. */
export default function SeasonalStripe({ height = 6 }: { height?: number }) {
  if (!isSeasonalActive()) return null;

  return (
    <View style={[styles.row, { height }]} pointerEvents="none">
      {SEASONAL_THEME.colors.stripe.map((tone, index) => (
        <View key={`${tone}-${index}`} style={[styles.band, { backgroundColor: tone }]} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', width: '100%' },
  band: { flex: 1 },
});
