import Ionicons from '@expo/vector-icons/Ionicons';
import type { ImageStyle, ViewStyle } from 'react-native';
import { Image, StyleSheet, View } from 'react-native';

import { colors } from '../theme/colors';
import { resolveMediaUrl } from '../utils/media';
import { getServiceCategoryIcon, getServiceCategoryColor } from '../utils/serviceCategories';

const SIZES = { sm: 56, md: 80 } as const;

interface Props {
  category: string;
  logoUrl?: string | null;
  logo?: string | null;
  size?: keyof typeof SIZES;
  style?: ViewStyle | ImageStyle;
}

function isSafeImageUri(uri: string): boolean {
  const trimmed = uri.trim();
  return trimmed.startsWith('https://') || trimmed.startsWith('http://') || trimmed.startsWith('file://');
}

export default function ServiceLogo({
  category,
  logoUrl,
  logo,
  size = 'md',
  style,
}: Props) {
  const dim = SIZES[size];
  const uri = resolveMediaUrl(logoUrl ?? logo);
  const icon = getServiceCategoryIcon(category);
  const tint = getServiceCategoryColor(category);

  if (uri && isSafeImageUri(uri)) {
    return (
      <Image
        source={{ uri }}
        style={[{ width: dim, height: dim, borderRadius: dim * 0.22 }, style as ImageStyle]}
        resizeMode="cover"
      />
    );
  }

  return (
    <View
      style={[
        styles.placeholder,
        { width: dim, height: dim, borderRadius: dim * 0.22, backgroundColor: tint + '18' },
        style,
      ]}
    >
      <Ionicons name={icon} size={dim * 0.42} color={tint} />
    </View>
  );
}

const styles = StyleSheet.create({
  placeholder: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
