import Ionicons from '@expo/vector-icons/Ionicons';
import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { colors } from '../theme/colors';

const STEPS = [
  { key: 'pending', label: 'Pendiente', icon: 'time' as const },
  { key: 'accepted', label: 'Aceptado', icon: 'checkmark-circle' as const },
  { key: 'preparing', label: 'Preparando', icon: 'flame' as const },
  { key: 'ready', label: 'Listo', icon: 'bag-check' as const },
  { key: 'on_the_way', label: 'En camino', icon: 'bicycle' as const },
  { key: 'delivered', label: 'Entregado', icon: 'happy' as const },
];

const ORDER = STEPS.map((s) => s.key);

interface Props {
  currentStatus: string;
}

export default function OrderTimeline({ currentStatus }: Props) {
  if (currentStatus === 'cancelled') {
    return (
      <View style={styles.cancelled}>
        <Ionicons name="close-circle" size={24} color={colors.error} />
        <Text style={styles.cancelledText}>Pedido cancelado</Text>
      </View>
    );
  }

  const currentIndex = ORDER.indexOf(currentStatus);

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.container}
    >
      {STEPS.map((step, index) => {
        const done = index <= currentIndex;
        const active = index === currentIndex;
        return (
          <View key={step.key} style={styles.step}>
            <View style={styles.stepRow}>
              <View
                style={[
                  styles.dot,
                  done && styles.dotDone,
                  active && styles.dotActive,
                ]}
              >
                <Ionicons
                  name={step.icon}
                  size={14}
                  color={done ? '#FFF' : colors.textMuted}
                />
              </View>
              {index < STEPS.length - 1 && (
                <View style={[styles.line, done && styles.lineDone]} />
              )}
            </View>
            <Text
              style={[
                styles.label,
                done && styles.labelDone,
                active && styles.labelActive,
              ]}
              numberOfLines={1}
            >
              {step.label}
            </Text>
          </View>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    paddingVertical: 8,
    paddingHorizontal: 4,
    gap: 4,
    minWidth: '100%',
  },
  step: { width: 72, alignItems: 'center' },
  stepRow: { flexDirection: 'row', alignItems: 'center', width: '100%', justifyContent: 'center' },
  dot: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1,
  },
  dotDone: { backgroundColor: colors.primary },
  dotActive: { backgroundColor: colors.primaryDark, transform: [{ scale: 1.15 }] },
  line: {
    position: 'absolute',
    left: '55%',
    right: '-45%',
    height: 3,
    backgroundColor: colors.border,
    top: 12,
  },
  lineDone: { backgroundColor: colors.primary },
  label: { fontSize: 9, color: colors.textMuted, marginTop: 6, textAlign: 'center' },
  labelDone: { color: colors.textSecondary, fontWeight: '500' },
  labelActive: { color: colors.primary, fontWeight: '700' },
  cancelled: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 16,
    backgroundColor: colors.error + '12',
    borderRadius: 12,
  },
  cancelledText: { color: colors.error, fontWeight: '600', fontSize: 16 },
});
