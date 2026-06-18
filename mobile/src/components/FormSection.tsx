import React from 'react';
import { StyleSheet, Text, View, ViewStyle } from 'react-native';

import { colors } from '../theme/colors';
import { spacing } from '../theme/spacing';
import { cardShadow } from '../theme/shadows';

interface Props {
  title: string;
  hint?: string;
  children: React.ReactNode;
  style?: ViewStyle;
  variant?: 'card' | 'plain';
}

export default function FormSection({ title, hint, children, style, variant = 'card' }: Props) {
  return (
    <View style={[variant === 'card' ? styles.sectionCard : styles.sectionPlain, style]}>
      <Text style={styles.title}>{title}</Text>
      {hint ? <Text style={styles.hint}>{hint}</Text> : null}
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  sectionCard: {
    backgroundColor: colors.surface,
    borderRadius: 20,
    padding: spacing.lg,
    marginBottom: spacing.lg,
    borderWidth: 1,
    borderColor: colors.borderLight,
    ...cardShadow,
  },
  sectionPlain: {
    backgroundColor: 'transparent',
    padding: 0,
    marginBottom: 0,
  },
  title: { fontSize: 18, fontWeight: '800', color: colors.text, marginBottom: 4, letterSpacing: -0.2 },
  hint: { fontSize: 13, color: colors.textSecondary, marginBottom: 14, lineHeight: 18 },
});
