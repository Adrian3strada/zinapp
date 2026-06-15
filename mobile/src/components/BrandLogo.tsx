import React from 'react';
import { Image, ImageStyle, StyleSheet, View, ViewStyle } from 'react-native';

const LOGO = require('../../assets/logo.png');

interface Props {
  width?: number;
  style?: ViewStyle;
  imageStyle?: ImageStyle;
}

export default function BrandLogo({ width = 260, style, imageStyle }: Props) {
  return (
    <View style={[styles.wrap, style]}>
      <Image
        source={LOGO}
        style={[styles.logo, { width, height: width * 0.38 }, imageStyle]}
        resizeMode="contain"
        accessibilityLabel="ZinApp Delivery y Servicios"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center' },
  logo: {},
});
