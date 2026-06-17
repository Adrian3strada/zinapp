import React, { useState } from 'react';
import { Image, ImageStyle, StyleSheet, Text, View, ViewStyle } from 'react-native';

import { colors } from '../theme/colors';

interface Props {
  emoji: string;
  color: string;
  size?: 'sm' | 'md' | 'lg';
  imageUri?: string | null;
  style?: ViewStyle | ImageStyle;
}

const SIZES = { sm: 56, md: 80, lg: 120 };

function isSafeImageUri(uri: string): boolean {
  const trimmed = uri.trim();
  return trimmed.startsWith('https://') || trimmed.startsWith('http://') || trimmed.startsWith('file://');
}

export default function FoodImage({ emoji, color, size = 'md', imageUri, style }: Props) {
  const dim = SIZES[size];
  const [failed, setFailed] = useState(false);

  const showImage = Boolean(imageUri && isSafeImageUri(imageUri) && !failed);

  if (showImage) {
    return (
      <Image
        source={{ uri: imageUri! }}
        style={[{ width: dim, height: dim, borderRadius: dim * 0.2 }, style as ImageStyle]}
        onError={() => setFailed(true)}
        resizeMode="cover"
      />
    );
  }

  return (
    <View
      style={[
        styles.placeholder,
        { width: dim, height: dim, borderRadius: dim * 0.2, backgroundColor: color + '22' },
        style,
      ]}
    >
      <Text style={[styles.emoji, { fontSize: dim * 0.45 }]}>{emoji}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  placeholder: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  emoji: { textAlign: 'center' },
});
