import React, { useEffect, useMemo, useRef } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';

import { useSeasonalTheme } from '../../hooks/useSeasonalTheme';

function FallingBit({
  left,
  delay,
  color,
  emoji,
}: {
  left: string;
  delay: number;
  color: string;
  emoji: string;
}) {
  const y = useRef(new Animated.Value(-8)).current;
  const spin = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const fall = Animated.loop(
      Animated.sequence([
        Animated.delay(delay),
        Animated.timing(y, {
          toValue: 168,
          duration: 3800,
          easing: Easing.linear,
          useNativeDriver: true,
        }),
        Animated.timing(y, { toValue: -8, duration: 0, useNativeDriver: true }),
      ]),
    );
    const twist = Animated.loop(
      Animated.timing(spin, {
        toValue: 1,
        duration: 2200,
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

  const rotate = spin.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  return (
    <Animated.Text
      style={[
        styles.confetti,
        { left, color, transform: [{ translateY: y }, { rotate }] },
      ]}
    >
      {emoji}
    </Animated.Text>
  );
}

function PicadoFlag({ color, index }: { color: string; index: number }) {
  const sway = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(sway, {
          toValue: 1,
          duration: 900 + (index % 4) * 80,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(sway, {
          toValue: 0,
          duration: 900 + (index % 4) * 80,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [index, sway]);

  const rotate = sway.interpolate({
    inputRange: [0, 1],
    outputRange: ['-12deg', '12deg'],
  });

  return (
    <Animated.View style={{ transform: [{ rotate }] }}>
      <View style={[styles.flag, { borderTopColor: color }]} />
    </Animated.View>
  );
}

/** Papel picado, franja de temporada y confeti animado. No tapa botones. */
export default function SeasonalHeaderDecor() {
  const { active, colors, confettiEmojis } = useSeasonalTheme();
  const picado = useMemo(
    () => (colors ? Array.from({ length: 16 }, (_, i) => colors.stripe[i % 3]) : []),
    [colors],
  );
  const bits = useMemo(() => {
    if (!colors || !confettiEmojis) return [];
    const lefts = ['8%', '22%', '38%', '58%', '74%', '88%'];
    const delays = [0, 400, 180, 720, 260, 540];
    const tones = [colors.accent, colors.accentAlt, colors.white, colors.accent, colors.accentAlt, colors.white];
    return lefts.map((left, i) => ({
      left,
      delay: delays[i],
      color: tones[i],
      emoji: confettiEmojis[i % confettiEmojis.length],
    }));
  }, [colors, confettiEmojis]);

  if (!active || !colors) return null;

  return (
    <View pointerEvents="none" style={styles.layer} accessible={false} importantForAccessibility="no">
      <View style={styles.topStripe}>
        {colors.stripe.map((tone, index) => (
          <View key={`top-${tone}-${index}`} style={[styles.stripeBand, { backgroundColor: tone }]} />
        ))}
      </View>

      {bits.map((bit) => (
        <FallingBit key={bit.left} {...bit} />
      ))}

      <View style={styles.picadoRow}>
        {picado.map((color, index) => (
          <PicadoFlag key={`flag-${index}`} color={color} index={index} />
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
  topStripe: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 7,
    flexDirection: 'row',
  },
  stripeBand: { flex: 1 },
  confetti: {
    position: 'absolute',
    top: 8,
    fontSize: 13,
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
    borderLeftWidth: 11,
    borderRightWidth: 11,
    borderTopWidth: 18,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
  },
});
