import Ionicons from '@expo/vector-icons/Ionicons';
import { useNavigation } from '@react-navigation/native';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { RestaurantTabParamList } from '../navigation/types';
import { colors } from '../theme/colors';
import { HIT_SLOP, spacing } from '../theme/spacing';
import type { Restaurant, RestaurantSetupStatus } from '../types';

interface Props {
  restaurant: Restaurant;
  setupStatus: RestaurantSetupStatus;
}

const STEP_TAB: Record<string, keyof RestaurantTabParamList> = {
  menu: 'MiNegocio',
  profile: 'Perfil',
  bank: 'Perfil',
  hours: 'Perfil',
  location: 'Perfil',
};

const STEP_ICONS: Record<string, keyof typeof Ionicons.glyphMap> = {
  menu: 'restaurant-outline',
  profile: 'image-outline',
  bank: 'card-outline',
  hours: 'time-outline',
  location: 'location-outline',
};

export default function RestaurantSetupBanner({ restaurant, setupStatus }: Props) {
  const navigation = useNavigation<BottomTabNavigationProp<RestaurantTabParamList>>();

  if (setupStatus.ready_for_orders) {
    return null;
  }

  const pendingSteps = setupStatus.steps.filter((step) => !step.done);
  const firstPending = pendingSteps[0];
  const waitingActivation = setupStatus.complete && !restaurant.is_active;
  const progress = setupStatus.total_count
    ? setupStatus.done_count / setupStatus.total_count
    : 0;

  const title = waitingActivation
    ? 'Esperando activación'
    : `Configura tu local`;

  const subtitle = waitingActivation
    ? 'Tu perfil está listo. El equipo ZinApp revisará tu local y lo activará en la app.'
    : !restaurant.is_active
      ? 'Completa los pasos para que podamos publicar tu negocio.'
      : pendingSteps.length > 0
        ? `${pendingSteps.length} paso${pendingSteps.length === 1 ? '' : 's'} pendiente${pendingSteps.length === 1 ? '' : 's'}`
        : 'Completa menú y perfil para recibir pedidos.';

  const ctaLabel = waitingActivation
    ? undefined
    : firstPending?.key === 'menu'
      ? 'Ir al menú'
      : 'Completar perfil';

  const goToStep = () => {
    const tab = firstPending ? STEP_TAB[firstPending.key] ?? 'Perfil' : 'Perfil';
    navigation.navigate(tab);
  };

  return (
    <View style={[styles.banner, waitingActivation && styles.bannerWaiting]}>
      <View style={styles.topRow}>
        <View style={[styles.iconWrap, waitingActivation && styles.iconWrapWaiting]}>
          <Ionicons
            name={waitingActivation ? 'hourglass-outline' : 'construct-outline'}
            size={22}
            color={waitingActivation ? colors.warning : colors.primary}
          />
        </View>
        <View style={styles.textWrap}>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.sub}>{subtitle}</Text>
        </View>
        {!waitingActivation ? (
          <Text style={styles.progressLabel}>
            {setupStatus.done_count}/{setupStatus.total_count}
          </Text>
        ) : null}
      </View>

      {!waitingActivation ? (
        <>
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${Math.round(progress * 100)}%` }]} />
          </View>
          <View style={styles.steps}>
            {setupStatus.steps.map((step) => (
              <Pressable
                key={step.key}
                style={[styles.stepChip, step.done && styles.stepChipDone]}
                onPress={() => navigation.navigate(STEP_TAB[step.key] ?? 'Perfil')}
                hitSlop={HIT_SLOP}
              >
                <Ionicons
                  name={step.done ? 'checkmark-circle' : STEP_ICONS[step.key] ?? 'ellipse-outline'}
                  size={14}
                  color={step.done ? colors.success : colors.textMuted}
                />
                <Text
                  style={[styles.stepLabel, step.done && styles.stepLabelDone]}
                  numberOfLines={1}
                >
                  {step.label.replace(/^Al menos un platillo en el menú$/, 'Menú').replace(/^Logo o foto del local$/, 'Logo')}
                </Text>
              </Pressable>
            ))}
          </View>
        </>
      ) : null}

      {ctaLabel ? (
        <Pressable style={styles.cta} onPress={goToStep} accessibilityRole="button">
          <Text style={styles.ctaText}>{ctaLabel}</Text>
          <Ionicons name="arrow-forward" size={16} color="#FFF" />
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    backgroundColor: colors.surface,
    borderRadius: 18,
    padding: spacing.lg,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.primary + '33',
    gap: spacing.sm,
  },
  bannerWaiting: {
    borderColor: colors.warning + '55',
    backgroundColor: '#FFFBEB',
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconWrapWaiting: { backgroundColor: '#FFF3CD' },
  textWrap: { flex: 1, gap: 4 },
  title: { fontSize: 16, fontWeight: '800', color: colors.text },
  sub: { fontSize: 13, color: colors.textSecondary, lineHeight: 18 },
  progressLabel: {
    fontSize: 15,
    fontWeight: '800',
    color: colors.primary,
  },
  progressTrack: {
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.borderLight,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 3,
    backgroundColor: colors.primary,
  },
  steps: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  stepChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 10,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    maxWidth: '48%',
  },
  stepChipDone: {
    backgroundColor: colors.success + '12',
    borderColor: colors.success + '44',
  },
  stepLabel: {
    flex: 1,
    fontSize: 10,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  stepLabelDone: { color: colors.success },
  cta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: colors.primary,
    paddingVertical: 12,
    borderRadius: 12,
    marginTop: 4,
  },
  ctaText: { color: '#FFF', fontSize: 14, fontWeight: '800' },
});
