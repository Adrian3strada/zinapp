import React, { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';

import { SEASONAL_THEME } from '../../config/seasonalTheme';
import { useSeasonalTheme } from '../../hooks/useSeasonalTheme';

const PIECES = [
  { left: '6%', delay: 0, color: SEASONAL_THEME.colors.green, size: 8 },
  { left: '18%', delay: 350, color: SEASONAL_THEME.colors.red, size: 6 },
  { left: '31%', delay: 120, color: '#FFF', size: 7 },
  { left: '47%', delay: 680, color: SEASONAL_THEME.colors.green, size: 5 },
  { left: '63%', delay: 220, color: SEASONAL_THEME.colors.red, size: 8 },
  { left: '78%', delay: 500, color: '#FFF', size: 6 },
  { left: '91%', delay: 80, color: SEASONAL_THEME.colors.green, size: 7 },
] as const;

function Piece({
  left,
  delay,
  color,
  size,
}: {
  left: string;
  delay: number;
  color: string;
  size: number;
}) {
  const y = useRef(new Animated.Value(0)).current;
  const spin = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const fall = Animated.loop(
      Animated.sequence([
        Animated.delay(delay),
        Animated.timing(y, {
          toValue: 1,
          duration: 5200,
          easing: Easing.linear,
          useNativeDriver: true,
        }),
        Animated.timing(y, { toValue: 0, duration: 0, useNativeDriver: true }),
      ]),
    );
    const twist = Animated.loop(
      Animated.timing(spin, {
        toValue: 1,
        duration: 1800,
        easing: Easing.linear,
        useNativeDriver: true,
      }),
    );
    fall.start();
    twist.start();
    return () => {
      fall.stop();
      twist.stop();
    };
  }, [delay, spin, y]);

  return (
    <Animated.View
      style={[
        styles.piece,
        {
          left,
          width: size,
          height: size,
          backgroundColor: color,
          transform: [
            {
              translateY: y.interpolate({
                inputRange: [0, 1],
                outputRange: [-12, 420],
              }),
            },
            {
              rotate: spin.interpolate({
                inputRange: [0, 1],
                outputRange: ['0deg', '360deg'],
              }),
            },
          ],
        },
      ]}
    />
  );
}

/** Confeti ligero sobre el Home. pointerEvents none. */
export default function SeasonalConfetti() {
  const { active } = useSeasonalTheme();
  if (!active) return null;

  return (
    <View pointerEvents="none" style={styles.layer} accessible={false} importantForAccessibility="no">
      {PIECES.map((piece) => (
        <Piece key={piece.left} {...piece} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  layer: {
    ...StyleSheet.absoluteFillObject,
    overflow: 'hidden',
    zIndex: 2,
  },
  piece: {
    position: 'absolute',
    top: 0,
    borderRadius: 2,
    opacity: 0.85,
  },
});
