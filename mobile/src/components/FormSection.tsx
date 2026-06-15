import React from 'react';
import { StyleSheet, Text, View, ViewStyle } from 'react-native';

import { colors } from '../theme/colors';
import { cardShadow } from '../theme/shadows';

interface Props {
  title: string;
  hint?: string;
  children: React.ReactNode;
  style?: ViewStyle;
}

export default function FormSection({ title, hint, children, style }: Props) {
  return (
    <View style={[styles.section, style]}>
      <Text style={styles.title}>{title}</Text>
      {hint ? <Text style={styles.hint}>{hint}</Text> : null}
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: colors.border,
    ...cardShadow,
  },
  title: { fontSize: 16, fontWeight: '800', color: colors.text, marginBottom: 4 },
  hint: { fontSize: 13, color: colors.textSecondary, marginBottom: 12, lineHeight: 18 },
});
