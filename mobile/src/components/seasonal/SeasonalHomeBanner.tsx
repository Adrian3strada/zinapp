import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { SEASONAL_THEME } from '../../config/seasonalTheme';
import { useSeasonalTheme } from '../../hooks/useSeasonalTheme';
import { radii } from '../../theme/radii';
import { spacing } from '../../theme/spacing';

/** Banner compacto del Home. No hace nada si la temporada está apagada. */
export default function SeasonalHomeBanner() {
  const { active, copy, colors } = useSeasonalTheme();
  if (!active || !copy) return null;

  return (
    <View
      style={[styles.card, { backgroundColor: colors.bannerBg, borderColor: colors.bannerBorder }]}
      accessibilityRole="summary"
      accessibilityLabel={`${copy.bannerTitle}. ${copy.bannerSubtitle}`}
    >
      <View style={styles.stripe} pointerEvents="none">
        {SEASONAL_THEME.colors.stripe.map((tone, index) => (
          <View key={`${tone}-${index}`} style={[styles.stripeBand, { backgroundColor: tone }]} />
        ))}
      </View>
      <View style={styles.copy}>
        <Text style={styles.title} numberOfLines={1}>
          🇲🇽  {copy.bannerTitle}
        </Text>
        <Text style={styles.subtitle} numberOfLines={2}>
          {copy.bannerSubtitle}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'stretch',
    borderRadius: radii.card,
    borderWidth: 1,
    overflow: 'hidden',
    minHeight: 64,
  },
  stripe: {
    width: 6,
    flexDirection: 'column',
  },
  stripeBand: {
    flex: 1,
  },
  copy: {
    flex: 1,
    minWidth: 0,
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    gap: 2,
    justifyContent: 'center',
  },
  title: {
    fontSize: 14,
    fontWeight: '800',
    color: '#154A94',
    letterSpacing: -0.2,
  },
  subtitle: {
    fontSize: 12,
    fontWeight: '600',
    color: '#4B5563',
    lineHeight: 16,
  },
});
