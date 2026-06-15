import React from 'react';
import {
  ActivityIndicator,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  ViewStyle,
} from 'react-native';

import { colors } from '../theme/colors';
import { HIT_SLOP } from '../theme/spacing';
import { cardShadow } from '../theme/shadows';

interface Props {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  disabled?: boolean;
  loading?: boolean;
  style?: ViewStyle;
  size?: 'md' | 'lg';
}

export default function Button({
  title,
  onPress,
  variant = 'primary',
  disabled,
  loading,
  style,
  size = 'md',
}: Props) {
  const isDisabled = disabled || loading;

  return (
    <Pressable
      onPress={onPress}
      disabled={isDisabled}
      hitSlop={HIT_SLOP}
      android_ripple={
        variant === 'ghost'
          ? { color: colors.primaryLight }
          : { color: 'rgba(255,255,255,0.25)' }
      }
      style={({ pressed }) => [
        styles.base,
        styles[size],
        styles[variant],
        variant === 'primary' && cardShadow,
        pressed && !isDisabled && styles.pressed,
        isDisabled && styles.disabled,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator
          color={variant === 'secondary' || variant === 'ghost' ? colors.primary : '#FFF'}
        />
      ) : (
        <Text
          style={[
            styles.text,
            styles[`text_${variant}`],
            size === 'lg' && styles.textLg,
          ]}
        >
          {title}
        </Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
    ...(Platform.OS === 'android' ? { overflow: 'hidden' as const } : {}),
  },
  md: { paddingVertical: 14, paddingHorizontal: 20 },
  lg: { paddingVertical: 18, paddingHorizontal: 24 },
  primary: { backgroundColor: colors.primary },
  secondary: { backgroundColor: colors.primaryLight, borderWidth: 1.5, borderColor: colors.primary },
  danger: { backgroundColor: colors.error },
  ghost: { backgroundColor: 'transparent' },
  pressed: { opacity: 0.9 },
  disabled: { opacity: 0.5 },
  text: { fontWeight: '700', fontSize: 16 },
  textLg: { fontSize: 17 },
  text_primary: { color: '#FFF' },
  text_secondary: { color: colors.primary },
  text_danger: { color: '#FFF' },
  text_ghost: { color: colors.primary },
});
