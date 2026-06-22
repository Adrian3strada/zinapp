import Ionicons from '@expo/vector-icons/Ionicons';
import React from 'react';
import { Image, ImageStyle, StyleSheet, Text, View, ViewStyle } from 'react-native';

import { colors } from '../theme/colors';

const LOGO_ASSET = require('../../assets/logo.png');

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

interface MarkProps {
  size: number;
  fg: string;
  bg: string;
  pinInner: string;
}

/** Isotipo Z + pin sin fondo blanco ni recorte circular blanco en el pin. */
function LogoMark({ size, fg, bg, pinInner }: MarkProps) {
  const pinW = size * 0.36;
  const pinH = size * 0.44;
  return (
    <View style={[styles.markWrap, { width: size, height: size, borderRadius: size * 0.26, backgroundColor: bg }]}>
      <Text style={[styles.markZ, { fontSize: size * 0.5, color: fg }]}>Z</Text>
      <View
        style={[
          styles.pin,
          {
            width: pinW,
            height: pinH,
            borderRadius: pinW * 0.5,
            backgroundColor: fg,
            top: size * 0.04,
            right: size * 0.02,
          },
        ]}
      >
        <View
          style={{
            width: pinW * 0.38,
            height: pinW * 0.38,
            borderRadius: pinW * 0.19,
            backgroundColor: pinInner,
          }}
        />
      </View>
      <View style={[styles.speedLine, { backgroundColor: fg, width: size * 0.22, top: size * 0.48, left: size * 0.08 }]} />
      <View style={[styles.speedLine, { backgroundColor: fg, width: size * 0.16, top: size * 0.56, left: size * 0.14, opacity: 0.7 }]} />
    </View>
  );
}

function resolvePalette(variant: BrandLogoVariant) {
  if (variant === 'light') {
    return {
      fg: '#FFFFFF',
      bg: 'rgba(255,255,255,0.16)',
      pinInner: 'rgba(255,255,255,0.16)',
      title: '#FFFFFF',
      tagline: 'rgba(255,255,255,0.82)',
      useAsset: false,
    };
  }
  return {
    fg: colors.primary,
    bg: colors.primaryLight,
    pinInner: colors.primaryLight,
    title: colors.primary,
    tagline: colors.textSecondary,
    useAsset: false,
  };
}

export default function BrandLogo({
  width = 260,
  variant = 'dark',
  showTagline = false,
  compact = false,
  style,
  imageStyle,
}: Props) {
  const palette = resolvePalette(variant);
  const markSize = width * (compact ? 0.22 : 0.2);
  const titleSize = width * (compact ? 0.13 : 0.115);
  const taglineSize = width * 0.042;

  if (palette.useAsset) {
    return (
      <View style={[styles.wrap, style]}>
        <Image
          source={LOGO_ASSET}
          style={[styles.asset, { width, height: width * 0.38 }, imageStyle]}
          resizeMode="contain"
          accessibilityLabel="ZinApp"
        />
      </View>
    );
  }

  return (
    <View style={[styles.wrap, styles.row, { width, gap: markSize * 0.35 }, style]}>
      <LogoMark size={markSize} fg={palette.fg} bg={palette.bg} pinInner={palette.pinInner} />
      <View style={styles.wordmark}>
        <View style={styles.titleRow}>
          <Text style={[styles.title, { fontSize: titleSize, color: palette.title }]}>ZinApp</Text>
          {variant === 'light' && (
            <Ionicons name="flash" size={titleSize * 0.65} color="rgba(255,255,255,0.75)" style={styles.flash} />
          )}
        </View>
        {showTagline && !compact && (
          <Text style={[styles.tagline, { fontSize: taglineSize, color: palette.tagline }]}>
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
  const palette = resolvePalette(variant);
  return (
    <View style={style}>
      <LogoMark size={size} fg={palette.fg} bg={palette.bg} pinInner={palette.pinInner} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center' },
  row: { flexDirection: 'row', alignItems: 'center' },
  asset: {},
  markWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'visible',
  },
  markZ: {
    fontWeight: '900',
    letterSpacing: -1.5,
    marginTop: 2,
  },
  pin: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 2,
  },
  speedLine: {
    position: 'absolute',
    height: 2.5,
    borderRadius: 2,
    opacity: 0.85,
  },
  wordmark: { flex: 1, justifyContent: 'center' },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  title: { fontWeight: '900', letterSpacing: -0.8 },
  flash: { marginTop: 2 },
  tagline: {
    fontWeight: '600',
    letterSpacing: 1.2,
    marginTop: 2,
  },
});
