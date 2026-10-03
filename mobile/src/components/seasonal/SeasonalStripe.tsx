import React from 'react';
import { StyleSheet, View } from 'react-native';

import { getActiveCampaign, isSeasonalActive } from '../../config/seasonalTheme';

/** Franja de temporada. Se oculta sola fuera de fechas. */
export default function SeasonalStripe({ height = 6 }: { height?: number }) {
  const campaign = getActiveCampaign();
  if (!isSeasonalActive() || !campaign) return null;

  return (
    <View style={[styles.row, { height }]} pointerEvents="none">
      {campaign.colors.stripe.map((tone, index) => (
        <View key={`${tone}-${index}`} style={[styles.band, { backgroundColor: tone }]} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', width: '100%' },
  band: { flex: 1 },
});
