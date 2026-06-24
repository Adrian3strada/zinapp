import Ionicons from '@expo/vector-icons/Ionicons';
import React from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

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
}

export default function SearchField({
  value,
  onChangeText,
  placeholder = 'Buscar…',
  onClear,
  elevated = false,
}: Props) {
  return (
    <View style={[styles.wrap, elevated && styles.wrapElevated]}>
      <Ionicons name="search" size={20} color={elevated ? colors.primary : colors.textMuted} />
      <TextInput
        style={[styles.input, webTextInputStyle()]}
        placeholder={placeholder}
        placeholderTextColor={colors.textMuted}
        value={value}
        onChangeText={onChangeText}
        autoCapitalize="none"
        autoCorrect={false}
        returnKeyType="search"
      />
      {value.length > 0 && (
        <Pressable
          onPress={() => (onClear ? onClear() : onChangeText(''))}
          hitSlop={HIT_SLOP}
          accessibilityLabel="Limpiar búsqueda"
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
    minHeight: 50,
    borderWidth: 1,
    borderColor: colors.border,
  },
  wrapElevated: {
    borderWidth: 0,
    ...elevatedShadow,
  },
  input: { flex: 1, fontSize: 15, color: colors.text, fontWeight: '500' },
});
