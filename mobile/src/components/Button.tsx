import { LinearGradient } from 'expo-linear-gradient';
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
import { cardShadow, softShadow } from '../theme/shadows';
import { webPassThroughPointerEvents } from '../utils/webPlatform';

interface Props {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  disabled?: boolean;
  loading?: boolean;
  style?: ViewStyle;
  size?: 'md' | 'lg';
}

/** Equal-width buttons in a row (RN Web needs minWidth + stretch). */
function flexChildStyle(style?: ViewStyle): ViewStyle {
  const flat = StyleSheet.flatten(style);
  if (!flat || (flat.flex !== 1 && flat.flexGrow !== 1)) return {};
  return Platform.OS === 'web'
    ? { flex: 1, minWidth: 0, alignSelf: 'stretch' }
    : { flex: 1, minWidth: 0 };
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
  const rowChild = flexChildStyle(style);

  const inner = loading ? (
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
      numberOfLines={1}
      adjustsFontSizeToFit
      minimumFontScale={0.85}
    >
      {title}
    </Text>
  );

  if (variant === 'primary' && !isDisabled) {
    return (
      <Pressable
        onPress={onPress}
        disabled={isDisabled}
        hitSlop={HIT_SLOP}
        android_ripple={{ color: 'rgba(255,255,255,0.25)' }}
        style={({ pressed }) => [
          styles.base,
          styles[size],
          styles.primaryWrap,
          rowChild,
          softShadow,
          pressed && styles.pressed,
          isDisabled && styles.disabled,
          style,
        ]}
      >
        <LinearGradient
          colors={[colors.primary, colors.primaryDark]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          pointerEvents={webPassThroughPointerEvents()}
          style={[
            styles.primaryGradient,
            size === 'lg' && styles.primaryGradientLg,
            rowChild.flex === 1 && styles.primaryGradientFlex,
          ]}
        >
          {inner}
        </LinearGradient>
      </Pressable>
    );
  }

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
        rowChild,
        variant === 'primary' && softShadow,
        pressed && !isDisabled && styles.pressed,
        isDisabled && styles.disabled,
        style,
      ]}
    >
      {inner}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
    ...(Platform.OS === 'android' ? { overflow: 'hidden' as const } : {}),
  },
  md: { paddingVertical: 14, paddingHorizontal: 20 },
  lg: { paddingVertical: 18, paddingHorizontal: 24 },
  primaryWrap: { padding: 0, backgroundColor: 'transparent', overflow: 'hidden' },
  primaryGradient: {
    alignSelf: 'stretch',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 16,
    minHeight: 48,
  },
  primaryGradientFlex: {
    width: '100%',
    flex: 1,
  },
  primaryGradientLg: { paddingVertical: 18, paddingHorizontal: 24 },
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
