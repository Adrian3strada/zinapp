import Ionicons from '@expo/vector-icons/Ionicons';
import React, { useState } from 'react';
import {
  Platform,
  StyleSheet,
  Text,
  TextInput,
  View,
  type StyleProp,
  type TextInputProps,
  type ViewStyle,
} from 'react-native';

import { colors } from '../theme/colors';
import { radii } from '../theme/radii';
import { webTextInputStyle } from '../utils/webPlatform';
import { useKeyboardForm } from './KeyboardForm';

interface Props {
  label?: string;
  value: string;
  onChangeText: (value: string) => void;
  icon?: keyof typeof Ionicons.glyphMap;
  placeholder?: string;
  hint?: string;
  required?: boolean;
  hideLabel?: boolean;
  secureTextEntry?: boolean;
  multiline?: boolean;
  keyboardType?: TextInputProps['keyboardType'];
  autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters';
  autoCorrect?: boolean;
  embedded?: boolean;
  rightElement?: React.ReactNode;
  autoComplete?: TextInputProps['autoComplete'];
  error?: string;
  style?: StyleProp<ViewStyle>;
  onFocus?: TextInputProps['onFocus'];
  onBlur?: TextInputProps['onBlur'];
}

export default function FormField({
  label,
  value,
  onChangeText,
  icon = 'ellipse-outline',
  placeholder,
  hint,
  required,
  hideLabel = false,
  secureTextEntry,
  multiline,
  keyboardType = 'default',
  autoCapitalize = 'sentences',
  autoCorrect = true,
  embedded = false,
  rightElement,
  autoComplete,
  error,
  style,
  onFocus,
  onBlur,
}: Props) {
  const [focused, setFocused] = useState(false);
  const keyboardForm = useKeyboardForm();

  return (
    <View style={[styles.wrap, style]}>
      {!hideLabel && label ? (
        <Text style={styles.label}>
          {label}
          {required ? <Text style={styles.requiredMark}> *</Text> : null}
        </Text>
      ) : null}
      <View
        style={[
          styles.inputWrap,
          embedded && styles.inputWrapEmbedded,
          multiline && styles.inputWrapMultiline,
          focused && styles.inputWrapFocused,
          !!error && styles.inputWrapError,
        ]}
      >
        <Ionicons
          name={icon}
          size={18}
          color={error ? colors.error : focused ? colors.primary : embedded ? colors.textMuted : colors.primary}
          style={multiline ? styles.iconTop : undefined}
        />
        <TextInput
          style={[styles.input, webTextInputStyle(), multiline && styles.inputMultiline]}
          placeholder={placeholder ?? label ?? ''}
          placeholderTextColor={colors.textMuted}
          value={value}
          onChangeText={onChangeText}
          onFocus={(e) => {
            setFocused(true);
            keyboardForm?.onInputFocus(e);
            onFocus?.(e);
          }}
          onBlur={(e) => {
            setFocused(false);
            onBlur?.(e);
          }}
          secureTextEntry={secureTextEntry}
          multiline={multiline}
          keyboardType={keyboardType}
          autoCapitalize={autoCapitalize}
          autoCorrect={autoCorrect}
          accessibilityLabel={label || placeholder || 'Campo de texto'}
          accessibilityHint={error || hint}
          {...(Platform.OS === 'web' && autoComplete ? { autoComplete } : {})}
        />
        {rightElement ? <View style={styles.rightElement}>{rightElement}</View> : null}
      </View>
      {error ? <Text style={styles.errorText}>{error}</Text> : hint ? <Text style={styles.hint}>{hint}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginBottom: 8 },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textSecondary,
    marginBottom: 8,
    marginTop: 4,
  },
  requiredMark: { color: colors.error, fontWeight: '700' },
  inputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radii.xl,
    paddingHorizontal: 14,
    marginBottom: 6,
    gap: 10,
    minHeight: 52,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  inputWrapFocused: {
    borderColor: colors.primary,
  },
  inputWrapError: {
    borderColor: colors.error,
  },
  inputWrapEmbedded: { backgroundColor: colors.surfaceElevated },
  inputWrapMultiline: { alignItems: 'flex-start', paddingVertical: 12 },
  iconTop: { marginTop: 2 },
  input: {
    flex: 1,
    fontSize: 15,
    color: colors.text,
    fontWeight: '500',
    minWidth: 0,
    paddingVertical: Platform.OS === 'web' ? 12 : 0,
    lineHeight: Platform.OS === 'web' ? 20 : undefined,
  },
  rightElement: {
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    alignSelf: 'stretch',
    paddingLeft: 2,
  },
  inputMultiline: { minHeight: 72, textAlignVertical: 'top' },
  hint: { fontSize: 12, color: colors.textSecondary, marginBottom: 8, lineHeight: 16 },
  errorText: { fontSize: 12, color: colors.error, marginBottom: 8, lineHeight: 16 },
});
