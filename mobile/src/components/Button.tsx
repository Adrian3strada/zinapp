import { LinearGradient } from 'expo-linear-gradient';
import React from 'react';
import {
  ActivityIndicator,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
  ViewStyle,
} from 'react-native';

import { colors } from '../theme/colors';
import { radii } from '../theme/radii';
import { HIT_SLOP } from '../theme/spacing';
import { softShadow } from '../theme/shadows';
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
  const showDisabledLook = !!disabled && !loading;
  const rowChild = flexChildStyle(style);
  const heightStyle = size === 'lg' ? styles.heightLg : styles.heightMd;

  const spinnerColor =
    variant === 'secondary' || variant === 'ghost' ? colors.primary : '#FFF';

  const label = (
    <View style={styles.labelRow}>
      {loading ? <ActivityIndicator color={spinnerColor} /> : null}
      <Text
        style={[
          styles.text,
          styles[`text_${variant}`],
          size === 'lg' && styles.textLg,
          loading && styles.textLoading,
          showDisabledLook && styles.textDisabled,
          showDisabledLook && variant === 'primary' && styles.textDisabledPrimary,
        ]}
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={0.85}
      >
        {title}
      </Text>
    </View>
  );

  if (variant === 'primary' && !showDisabledLook) {
    return (
      <Pressable
        onPress={onPress}
        disabled={isDisabled}
        hitSlop={HIT_SLOP}
        accessibilityRole="button"
        accessibilityLabel={title}
        accessibilityState={{ disabled: isDisabled, busy: !!loading }}
        android_ripple={{ color: 'rgba(255,255,255,0.25)' }}
        style={({ pressed }) => [
          styles.base,
          heightStyle,
          styles.primaryWrap,
          rowChild,
          softShadow,
          pressed && !isDisabled && styles.pressed,
          style,
        ]}
      >
        <LinearGradient
          colors={[colors.primary, colors.primaryDark]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          pointerEvents={webPassThroughPointerEvents()}
          style={styles.primaryFill}
        >
          {label}
        </LinearGradient>
      </Pressable>
    );
  }

  return (
    <Pressable
      onPress={onPress}
      disabled={isDisabled}
      hitSlop={HIT_SLOP}
      accessibilityRole="button"
      accessibilityLabel={title}
      accessibilityState={{ disabled: isDisabled, busy: !!loading }}
      android_ripple={
        variant === 'ghost'
          ? { color: colors.primaryLight }
          : { color: 'rgba(255,255,255,0.2)' }
      }
      style={({ pressed }) => [
        styles.base,
        heightStyle,
        styles[variant],
        rowChild,
        showDisabledLook && variant === 'primary' && styles.primaryDisabled,
        showDisabledLook && variant === 'secondary' && styles.secondaryDisabled,
        showDisabledLook && variant === 'ghost' && styles.ghostDisabled,
        pressed && !isDisabled && styles.pressed,
        style,
      ]}
    >
      {label}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: radii.lg,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 18,
    ...(Platform.OS === 'android' ? { overflow: 'hidden' as const } : {}),
  },
  heightMd: { height: 52 },
  heightLg: { height: 56 },
  primaryWrap: {
    paddingHorizontal: 0,
    backgroundColor: 'transparent',
    overflow: 'hidden',
  },
  primaryFill: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radii.lg,
    paddingHorizontal: 18,
  },
  primary: { backgroundColor: colors.primary },
  primaryDisabled: {
    backgroundColor: colors.borderLight,
  },
  secondary: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.primary,
  },
  secondaryDisabled: {
    borderColor: colors.border,
    backgroundColor: colors.surfaceElevated,
  },
  danger: { backgroundColor: colors.error },
  ghost: { backgroundColor: 'transparent' },
  ghostDisabled: { opacity: 1 },
  pressed: { opacity: 0.92 },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  text: { fontWeight: '600', fontSize: 15, letterSpacing: -0.1 },
  textLg: { fontSize: 16 },
  textLoading: { opacity: 0.85 },
  textDisabled: { color: colors.textMuted },
  textDisabledPrimary: { color: colors.textMuted },
  text_primary: { color: '#FFF' },
  text_secondary: { color: colors.primary },
  text_danger: { color: '#FFF' },
  text_ghost: { color: colors.primary },
});
