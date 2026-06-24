import Ionicons from '@expo/vector-icons/Ionicons';
import { useNavigation } from '@react-navigation/native';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { RestaurantTabParamList } from '../navigation/types';
import { colors } from '../theme/colors';
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

export default function RestaurantSetupBanner({ restaurant, setupStatus }: Props) {
  const navigation = useNavigation<BottomTabNavigationProp<RestaurantTabParamList>>();

  if (setupStatus.ready_for_orders) {
    return null;
  }

  const pendingSteps = setupStatus.steps.filter((step) => !step.done);
  const firstPending = pendingSteps[0];
  const waitingActivation = setupStatus.complete && !restaurant.is_active;

  const title = waitingActivation
    ? 'Esperando activación'
    : `Configura tu local (${setupStatus.done_count}/${setupStatus.total_count})`;

  const subtitle = waitingActivation
    ? 'Tu perfil está listo. El equipo ZinApp revisará tu local y lo activará en la app. Te avisamos cuando esté publicado.'
    : !restaurant.is_active
      ? 'Tu negocio aún no es visible para clientes. Completa los pasos pendientes en Menú y Mi perfil.'
      : pendingSteps.length > 0
      ? `Pendiente: ${pendingSteps.map((s) => s.label.replace(/^Al menos un platillo en el menú$/, 'Menú').replace(/^Logo o foto del local$/, 'Logo')).join(' · ')}`
      : 'Completa tu perfil y menú para empezar a recibir pedidos.';

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
      <View style={styles.iconWrap}>
        <Ionicons
          name={waitingActivation ? 'hourglass-outline' : 'construct-outline'}
          size={24}
          color={waitingActivation ? colors.warning : colors.primary}
        />
      </View>
      <View style={styles.textWrap}>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.sub}>{subtitle}</Text>
        {!waitingActivation && pendingSteps.length > 0 && (
          <View style={styles.steps}>
            {setupStatus.steps.map((step) => (
              <View key={step.key} style={[styles.stepDot, step.done && styles.stepDone]}>
                <Text style={[styles.stepText, step.done && styles.stepTextDone]}>
                  {step.done ? '✓' : '○'}
                </Text>
              </View>
            ))}
          </View>
        )}
      </View>
      {ctaLabel ? (
        <Pressable style={styles.cta} onPress={goToStep} accessibilityRole="button">
          <Text style={styles.ctaText}>{ctaLabel}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    backgroundColor: colors.primaryLight,
    borderRadius: 14,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: colors.primary,
  },
  bannerWaiting: {
    backgroundColor: '#fff8ed',
    borderColor: colors.warning,
  },
  iconWrap: { width: 28, alignItems: 'center', paddingTop: 2 },
  textWrap: { flex: 1, gap: 4 },
  title: { fontSize: 15, fontWeight: '800', color: colors.text },
  sub: { fontSize: 12, color: colors.textSecondary, lineHeight: 17 },
  steps: { flexDirection: 'row', gap: 6, marginTop: 4 },
  stepDot: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  stepDone: { backgroundColor: colors.success, borderColor: colors.success },
  stepText: { fontSize: 10, color: colors.textMuted, fontWeight: '700' },
  stepTextDone: { color: '#FFF' },
  cta: {
    alignSelf: 'center',
    backgroundColor: colors.primary,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
  },
  ctaText: { color: '#FFF', fontSize: 12, fontWeight: '800' },
});
