import Ionicons from '@expo/vector-icons/Ionicons';
import React from 'react';
import { Pressable, StyleSheet } from 'react-native';

import { colors } from '../theme/colors';
import { HIT_SLOP } from '../theme/spacing';

interface Props {
  favorited: boolean;
  onPress: () => void;
  disabled?: boolean;
  size?: number;
}

export default function FavoriteHeart({ favorited, onPress, disabled, size = 22 }: Props) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      hitSlop={HIT_SLOP}
      accessibilityRole="button"
      accessibilityLabel={favorited ? 'Quitar de favoritos' : 'Agregar a favoritos'}
      style={({ pressed }) => [styles.btn, pressed && styles.pressed]}
    >
      <Ionicons
        name={favorited ? 'heart' : 'heart-outline'}
        size={size}
        color={favorited ? colors.error : colors.textSecondary}
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  btn: {
    minWidth: 44,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: { opacity: 0.7 },
});
