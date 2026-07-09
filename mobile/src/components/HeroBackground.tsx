import { LinearGradient } from 'expo-linear-gradient';
import React from 'react';
import { Platform, StyleSheet, View, type ViewStyle } from 'react-native';

import { colors } from '../theme/colors';
import { webPassThroughPointerEvents } from '../utils/webPlatform';

interface Props {
  colors?: [string, string, ...string[]];
  style?: ViewStyle;
  children: React.ReactNode;
}

/**
 * En algunos Android release, LinearGradient deja la pantalla en gris vacío.
 * Usamos color sólido en Android nativo; gradiente en web e iOS.
 */
export default function HeroBackground({
  colors: gradientColors = [colors.gradientStart, colors.gradientEnd],
  style,
  children,
}: Props) {
  if (Platform.OS === 'android') {
    return (
      <View
        style={[styles.solid, { backgroundColor: gradientColors[0] }, style]}
        pointerEvents={webPassThroughPointerEvents()}
      >
        {children}
      </View>
    );
  }

  return (
    <LinearGradient
      colors={gradientColors}
      style={style}
      pointerEvents={webPassThroughPointerEvents()}
    >
      {children}
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  solid: {
    overflow: 'hidden',
  },
});
