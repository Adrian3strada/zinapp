import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { colors } from '../theme/colors';

export type MapPinType = 'restaurant' | 'delivery' | 'driver' | 'pickup';

const PIN_CONFIG: Record<MapPinType, { color: string; emoji: string; size: number }> = {
  restaurant: { color: colors.primary, emoji: '🍽️', size: 40 },
  delivery: { color: colors.success, emoji: '📍', size: 40 },
  pickup: { color: colors.accentDark, emoji: '📦', size: 40 },
  driver: { color: colors.secondary, emoji: '🛵', size: 44 },
};

/** Punto de anclaje: la punta del pin coincide con la coordenada GPS. */
export const MAP_PIN_ANCHOR = { x: 0.5, y: 1 } as const;

interface Props {
  type: MapPinType;
}

export default function MapPin({ type }: Props) {
  const { color, emoji, size } = PIN_CONFIG[type];

  return (
    <View style={[styles.wrap, { width: size, height: size + 6 }]}>
      <View style={[styles.bubble, { backgroundColor: color, width: size, height: size }]}>
        <Text style={[styles.emoji, { fontSize: size * 0.42 }]}>{emoji}</Text>
      </View>
      <View style={[styles.pointer, { backgroundColor: color }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  bubble: {
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2.5,
    borderColor: '#FFF',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.12,
    shadowRadius: 2,
  },
  emoji: { textAlign: 'center' },
  pointer: {
    width: 12,
    height: 12,
    marginTop: -6,
    transform: [{ rotate: '45deg' }],
    borderWidth: 2,
    borderColor: '#FFF',
  },
});
