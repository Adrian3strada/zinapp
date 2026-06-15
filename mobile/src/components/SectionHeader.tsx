import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { colors } from '../theme/colors';
import { spacing } from '../theme/spacing';

interface Props {
  title?: string;
  subtitle?: string;
  action?: React.ReactNode;
}

export default function SectionHeader({ title, subtitle, action }: Props) {
  if (!title && !subtitle && !action) return null;

  return (
    <View style={styles.row}>
      <View style={styles.textWrap}>
        {title && <Text style={styles.title}>{title}</Text>}
        {subtitle && <Text style={[styles.subtitle, !title && styles.subtitleOnly]}>{subtitle}</Text>}
      </View>
      {action}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
    gap: spacing.md,
  },
  textWrap: { flex: 1 },
  title: { fontSize: 18, fontWeight: '800', color: colors.text },
  subtitle: { fontSize: 13, color: colors.textSecondary, marginTop: 2 },
  subtitleOnly: { fontSize: 14, fontWeight: '600', color: colors.primary, marginTop: 0 },
});
