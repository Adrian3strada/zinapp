import React, { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, Text, View } from 'react-native';

import { useSeasonalTheme } from '../../hooks/useSeasonalTheme';
import { colors } from '../../theme/colors';
import { radii } from '../../theme/radii';
import { spacing } from '../../theme/spacing';

/** Banner de temporada: marca ZinApp + acento del mes. */
export default function SeasonalHomeBanner() {
  const { active, copy, colors: festive } = useSeasonalTheme();
  const pulse = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (!active) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1.12,
          duration: 700,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 1,
          duration: 700,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [active, pulse]);

  if (!active || !copy || !festive) return null;

  return (
    <View
      style={[styles.card, { borderColor: festive.accent }]}
      accessibilityRole="summary"
      accessibilityLabel={`${copy.bannerTitle}. ${copy.bannerSubtitle}`}
    >
      <View style={styles.tricolorBar}>
        {festive.stripe.map((tone, index) => (
          <View key={`${tone}-${index}`} style={[styles.tricolorBand, { backgroundColor: tone }]} />
        ))}
      </View>
      <View style={styles.body}>
        <View style={styles.brandHalf}>
          <Animated.Text style={[styles.flag, { transform: [{ scale: pulse }] }]}>
            {copy.emoji}
          </Animated.Text>
          <View style={styles.copy}>
            <Text style={styles.kicker}>{copy.bannerKicker}</Text>
            <Text style={styles.title}>{copy.bannerTitle}</Text>
            <Text style={styles.subtitle}>{copy.bannerSubtitle}</Text>
          </View>
        </View>
        <View style={styles.emojiRow}>
          {copy.foodEmojis.map((food, index) => (
            <Text key={`${food}-${index}`} style={styles.food}>{food}</Text>
          ))}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radii.card,
    overflow: 'hidden',
    backgroundColor: colors.primary,
    borderWidth: 2,
  },
  tricolorBar: {
    height: 10,
    flexDirection: 'row',
  },
  tricolorBand: { flex: 1 },
  body: {
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
    gap: 10,
  },
  brandHalf: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  flag: { fontSize: 28, lineHeight: 32 },
  copy: { flex: 1, minWidth: 0, gap: 2 },
  kicker: {
    fontSize: 11,
    fontWeight: '800',
    color: 'rgba(255,255,255,0.82)',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  title: {
    fontSize: 17,
    fontWeight: '900',
    color: '#FFF',
    letterSpacing: -0.3,
  },
  subtitle: {
    fontSize: 13,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.92)',
    lineHeight: 18,
  },
  emojiRow: {
    flexDirection: 'row',
    gap: 8,
  },
  food: { fontSize: 22 },
});
