import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { isSeasonalMexicanCategory, SEASONAL_THEME } from '../config/seasonalTheme';
import { colors } from '../theme/colors';
import { radii } from '../theme/radii';

interface Props {
  emoji: string;
  label: string;
  tint?: string;
  categoryKey?: string | null;
  selected?: boolean;
  onPress: () => void;
}

/** Icono de categoría estilo listado de comida: círculo de color + emoji grande. */
export default function CategoryIconTile({ emoji, label, tint, categoryKey, selected, onPress }: Props) {
  const festive = isSeasonalMexicanCategory(categoryKey);
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected: !!selected }}
      style={({ pressed }) => [styles.tile, pressed && styles.pressed]}
    >
      <View
        style={[
          styles.circle,
          { backgroundColor: tint || colors.primaryLight },
          selected && styles.circleSelected,
          festive && !selected && { borderWidth: 1.5, borderColor: SEASONAL_THEME.colors.green },
        ]}
      >
        <Text style={styles.emoji}>{emoji}</Text>
      </View>
      <Text style={[styles.label, selected && styles.labelSelected]} numberOfLines={2}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  tile: {
    width: 76,
    alignItems: 'center',
    gap: 8,
  },
  pressed: { opacity: 0.88 },
  circle: {
    width: 64,
    height: 64,
    borderRadius: radii.sheetLg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  circleSelected: {
    borderWidth: 2,
    borderColor: colors.primary,
  },
  emoji: {
    fontSize: 32,
    lineHeight: 38,
    textAlign: 'center',
  },
  label: {
    fontSize: 12,
    fontWeight: '800',
    color: colors.text,
    textAlign: 'center',
    lineHeight: 15,
    minHeight: 30,
  },
  labelSelected: { color: colors.primary },
});
