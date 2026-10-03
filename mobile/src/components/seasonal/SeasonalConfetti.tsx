import React, { useEffect, useMemo, useRef } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';

import { useSeasonalTheme } from '../../hooks/useSeasonalTheme';

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
  const { active, colors } = useSeasonalTheme();
  const pieces = useMemo(() => {
    if (!colors) return [];
    const lefts = ['6%', '18%', '31%', '47%', '63%', '78%', '91%'];
    const delays = [0, 350, 120, 680, 220, 500, 80];
    const sizes = [8, 6, 7, 5, 8, 6, 7];
    const tones = [
      colors.accent,
      colors.accentAlt,
      colors.white,
      colors.accent,
      colors.accentAlt,
      colors.white,
      colors.accent,
    ];
    return lefts.map((left, i) => ({
      left,
      delay: delays[i],
      color: tones[i],
      size: sizes[i],
    }));
  }, [colors]);

  if (!active || !colors) return null;

  return (
    <View pointerEvents="none" style={styles.layer} accessible={false} importantForAccessibility="no">
      {pieces.map((piece) => (
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
