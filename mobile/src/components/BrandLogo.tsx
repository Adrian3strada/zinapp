import React from 'react';
import { Image, ImageStyle, StyleSheet, Text, View, ViewStyle } from 'react-native';

import { colors } from '../theme/colors';

const LOGO_ON_BLUE = require('../../assets/logo-on-blue.png');
const LOGO_ON_WHITE = require('../../assets/logo-on-white.png');

export type BrandLogoVariant = 'light' | 'dark' | 'auto';

interface Props {
  width?: number;
  variant?: BrandLogoVariant;
  /** @deprecated Tagline oculto por defecto; evita repetir «delivery y servicios». */
  showTagline?: boolean;
  /** Solo icono + «ZinApp», sin tagline (headers compactos) */
  compact?: boolean;
  style?: ViewStyle;
  imageStyle?: ImageStyle;
}

function logoSource(variant: BrandLogoVariant) {
  // light = sobre fondo azul/oscuro → marca blanca sobre azul
  return variant === 'light' ? LOGO_ON_BLUE : LOGO_ON_WHITE;
}

function titleColor(variant: BrandLogoVariant) {
  return variant === 'light' ? '#FFFFFF' : colors.primary;
}

function taglineColor(variant: BrandLogoVariant) {
  return variant === 'light' ? 'rgba(255,255,255,0.82)' : colors.textSecondary;
}

export default function BrandLogo({
  width = 260,
  variant = 'dark',
  showTagline = false,
  compact = false,
  style,
  imageStyle,
}: Props) {
  const markSize = width * (compact ? 0.22 : 0.2);
  const titleSize = width * (compact ? 0.13 : 0.115);
  const taglineSize = width * 0.042;

  return (
    <View style={[styles.wrap, styles.row, { width, gap: markSize * 0.35 }, style]}>
      <Image
        source={logoSource(variant)}
        style={[
          styles.mark,
          {
            width: markSize,
            height: markSize,
            borderRadius: markSize * 0.22,
          },
          imageStyle,
        ]}
        resizeMode="cover"
        accessibilityLabel="ZinApp"
      />
      <View style={styles.wordmark}>
        <Text style={[styles.title, { fontSize: titleSize, color: titleColor(variant) }]}>ZinApp</Text>
        {showTagline && !compact && (
          <Text style={[styles.tagline, { fontSize: taglineSize, color: taglineColor(variant) }]}>
            DELIVERY & SERVICIOS
          </Text>
        )}
      </View>
    </View>
  );
}

/** Isotipo solo (tabs, favicon inline, etc.) */
export function BrandMark({
  size = 40,
  variant = 'dark',
  style,
}: {
  size?: number;
  variant?: BrandLogoVariant;
  style?: ViewStyle;
}) {
  return (
    <View style={style}>
      <Image
        source={logoSource(variant)}
        style={{ width: size, height: size, borderRadius: size * 0.22 }}
        resizeMode="cover"
        accessibilityLabel="ZinApp"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center' },
  row: { flexDirection: 'row', alignItems: 'center' },
  mark: {
    overflow: 'hidden',
  },
  wordmark: { flex: 1, justifyContent: 'center' },
  title: { fontWeight: '900', letterSpacing: -0.8 },
  tagline: {
    fontWeight: '600',
    letterSpacing: 1.2,
    marginTop: 2,
  },
});
