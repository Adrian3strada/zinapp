import Ionicons from '@expo/vector-icons/Ionicons';
import React from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';

import { colors } from '../theme/colors';
import { HIT_SLOP } from '../theme/spacing';
import { elevatedShadow } from '../theme/shadows';
import { webTextInputStyle } from '../utils/webPlatform';

interface Props {
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  onClear?: () => void;
  /** Estilo flotante sobre hero (fondo blanco, sombra). */
  elevated?: boolean;
  accessibilityLabel?: string;
  onSubmitEditing?: () => void;
}

export default function SearchField({
  value,
  onChangeText,
  placeholder = 'Buscar…',
  onClear,
  elevated = false,
  accessibilityLabel,
  onSubmitEditing,
}: Props) {
  return (
    <View style={[styles.wrap, elevated && styles.wrapElevated]}>
      <Ionicons
        name="search"
        size={20}
        color={elevated ? colors.primary : colors.textMuted}
        accessible={false}
      />
      <TextInput
        style={[styles.input, webTextInputStyle()]}
        placeholder={placeholder}
        placeholderTextColor={colors.textMuted}
        value={value}
        onChangeText={onChangeText}
        autoCapitalize="none"
        autoCorrect={false}
        returnKeyType="search"
        onSubmitEditing={onSubmitEditing}
        accessibilityLabel={accessibilityLabel || placeholder}
        accessibilityRole="search"
      />
      {value.length > 0 && (
        <Pressable
          onPress={() => (onClear ? onClear() : onChangeText(''))}
          hitSlop={HIT_SLOP}
          accessibilityRole="button"
          accessibilityLabel="Limpiar búsqueda"
          style={styles.clearBtn}
        >
          <Ionicons name="close-circle" size={20} color={colors.textMuted} />
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: 16,
    paddingHorizontal: 16,
    gap: 10,
    minHeight: 52,
    borderWidth: 1,
    borderColor: colors.border,
  },
  wrapElevated: {
    borderWidth: 0,
    ...elevatedShadow,
  },
  input: { flex: 1, fontSize: 15, color: colors.text, fontWeight: '500' },
  clearBtn: {
    minWidth: 44,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
