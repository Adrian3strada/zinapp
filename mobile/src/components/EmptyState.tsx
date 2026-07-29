import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { colors } from '../theme/colors';
import { radii } from '../theme/radii';
import { spacing } from '../theme/spacing';
import { typography } from '../theme/typography';
import Button from './Button';

interface Props {
  emoji: string;
  title: string;
  subtitle?: string;
  actionLabel?: string;
  onAction?: () => void;
}

export default function EmptyState({ emoji, title, subtitle, actionLabel, onAction }: Props) {
  return (
    <View
      style={styles.container}
      accessibilityRole="summary"
      accessibilityLabel={`${title}${subtitle ? `. ${subtitle}` : ''}`}
    >
      <View style={styles.emojiCircle} accessible={false} importantForAccessibility="no">
        <Text style={styles.emoji} accessible={false}>
          {emoji}
        </Text>
      </View>
      <Text style={styles.title} accessibilityRole="header">
        {title}
      </Text>
      {subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}
      {actionLabel && onAction && (
        <Button title={actionLabel} onPress={onAction} style={styles.btn} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.xxl,
    minHeight: 220,
  },
  emojiCircle: {
    width: 64,
    height: 64,
    borderRadius: radii.sheet,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  emoji: { fontSize: 28 },
  title: {
    ...typography.title,
    fontSize: 18,
    textAlign: 'center',
  },
  subtitle: {
    ...typography.subtitle,
    fontSize: 14,
    textAlign: 'center',
    marginTop: spacing.sm,
    maxWidth: 260,
  },
  btn: { marginTop: spacing.lg, minWidth: 180, alignSelf: 'center' },
});
