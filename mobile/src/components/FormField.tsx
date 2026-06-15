import Ionicons from '@expo/vector-icons/Ionicons';
import React from 'react';
import { StyleSheet, Text, TextInput, View, ViewStyle } from 'react-native';

import { colors } from '../theme/colors';

interface Props {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  icon?: keyof typeof Ionicons.glyphMap;
  placeholder?: string;
  hint?: string;
  required?: boolean;
  secureTextEntry?: boolean;
  multiline?: boolean;
  keyboardType?: 'default' | 'email-address' | 'phone-pad' | 'decimal-pad';
  autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters';
  autoCorrect?: boolean;
  embedded?: boolean;
  rightElement?: React.ReactNode;
  style?: ViewStyle;
}

export default function FormField({
  label,
  value,
  onChangeText,
  icon = 'ellipse-outline',
  placeholder,
  hint,
  required,
  secureTextEntry,
  multiline,
  keyboardType = 'default',
  autoCapitalize = 'sentences',
  autoCorrect = true,
  embedded = false,
  rightElement,
  style,
}: Props) {
  return (
    <View style={[styles.wrap, style]}>
      <Text style={styles.label}>
        {label}
        {required ? ' *' : ''}
      </Text>
      <View
        style={[
          styles.inputWrap,
          embedded && styles.inputWrapEmbedded,
          multiline && styles.inputWrapMultiline,
        ]}
      >
        <Ionicons name={icon} size={18} color={colors.textMuted} style={multiline ? styles.iconTop : undefined} />
        <TextInput
          style={[styles.input, multiline && styles.inputMultiline]}
          placeholder={placeholder ?? label}
          placeholderTextColor={colors.textMuted}
          value={value}
          onChangeText={onChangeText}
          secureTextEntry={secureTextEntry}
          multiline={multiline}
          keyboardType={keyboardType}
          autoCapitalize={autoCapitalize}
          autoCorrect={autoCorrect}
        />
        {rightElement}
      </View>
      {hint ? <Text style={styles.hint}>{hint}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginBottom: 4 },
  label: { fontSize: 13, fontWeight: '600', color: colors.textSecondary, marginBottom: 6, marginTop: 4 },
  inputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: 14,
    paddingHorizontal: 14,
    marginBottom: 6,
    gap: 10,
    minHeight: 50,
    borderWidth: 1,
    borderColor: colors.border,
  },
  inputWrapEmbedded: { backgroundColor: colors.background },
  inputWrapMultiline: { alignItems: 'flex-start', paddingVertical: 12 },
  iconTop: { marginTop: 2 },
  input: { flex: 1, fontSize: 15, color: colors.text },
  inputMultiline: { minHeight: 72, textAlignVertical: 'top' },
  hint: { fontSize: 11, color: colors.textMuted, marginBottom: 8, lineHeight: 16 },
});
