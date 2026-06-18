import Ionicons from '@expo/vector-icons/Ionicons';
import React from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { colors } from '../theme/colors';
import { spacing } from '../theme/spacing';

interface Props {
  children?: React.ReactNode;
  loading?: boolean;
  /** Si se pasa, muestra skeleton en lugar del spinner a pantalla completa. */
  loadingSkeleton?: React.ReactNode;
  error?: string | null;
  onRetry?: () => void;
}

export default function ScreenContainer({ children, loading, loadingSkeleton, error, onRetry }: Props) {
  if (loading && loadingSkeleton) {
    return <View style={styles.container}>{loadingSkeleton}</View>;
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <View style={styles.loadingCard}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Cargando…</Text>
          <Text style={styles.loadingHint}>Si tarda, el servidor puede estar despertando</Text>
        </View>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.center}>
        <View style={styles.errorCircle}>
          <Ionicons name="cloud-offline-outline" size={36} color={colors.error} />
        </View>
        <Text style={styles.error}>{error}</Text>
        {onRetry && (
          <Pressable style={styles.retryBtn} onPress={onRetry}>
            <Ionicons name="refresh" size={18} color="#FFF" />
            <Text style={styles.retryText}>Reintentar</Text>
          </Pressable>
        )}
      </View>
    );
  }

  return <View style={styles.container}>{children}</View>;
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xxl,
    backgroundColor: colors.background,
  },
  loadingCard: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    padding: spacing.xxl,
    borderRadius: 22,
    minWidth: 180,
    gap: spacing.md,
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  loadingText: { color: colors.textSecondary, fontSize: 15, fontWeight: '600' },
  loadingHint: {
    color: colors.textMuted,
    fontSize: 12,
    textAlign: 'center',
    maxWidth: 240,
    lineHeight: 18,
  },
  errorCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.error + '14',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.lg,
  },
  error: {
    color: colors.text,
    textAlign: 'center',
    fontSize: 16,
    fontWeight: '600',
    lineHeight: 24,
    maxWidth: 300,
  },
  retryBtn: {
    marginTop: spacing.xl,
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    borderRadius: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  retryText: { color: '#FFF', fontWeight: '700', fontSize: 15 },
});
