import Ionicons from '@expo/vector-icons/Ionicons';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { colors } from '../theme/colors';
import type { ShipmentStatus } from '../types';

const STEPS: { key: ShipmentStatus; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { key: 'pending', label: 'Registrado', icon: 'time-outline' },
  { key: 'picked_up', label: 'Recogida', icon: 'cube-outline' },
  { key: 'on_the_way', label: 'En camino', icon: 'bicycle-outline' },
  { key: 'delivered', label: 'Entregado', icon: 'checkmark-circle-outline' },
];

const ORDER: ShipmentStatus[] = ['pending', 'picked_up', 'on_the_way', 'delivered'];

interface Props {
  status: ShipmentStatus;
}

export default function ShipmentTimeline({ status }: Props) {
  if (status === 'cancelled') {
    return (
      <View style={styles.cancelled}>
        <Ionicons name="close-circle-outline" size={22} color={colors.error} />
        <Text style={styles.cancelledText}>Envío cancelado</Text>
      </View>
    );
  }

  const currentIndex = status === 'delivered' ? STEPS.length : Math.max(ORDER.indexOf(status), 0);

  return (
    <View style={styles.row}>
      {STEPS.map((step, index) => {
        const done = status === 'delivered' || index < currentIndex;
        const active = status !== 'delivered' && index === currentIndex;
        const color = done ? colors.success : active ? colors.primary : colors.textMuted;

        return (
          <View key={step.key} style={styles.stepWrap}>
            <View style={styles.stepTop}>
              {!index ? null : (
                <View
                  style={[
                    styles.lineLeft,
                    { backgroundColor: index <= currentIndex || status === 'delivered' ? colors.success : colors.border },
                  ]}
                />
              )}
              <View style={[styles.dot, { borderColor: color, backgroundColor: done || active ? color + '18' : colors.surface }]}>
                <Ionicons name={step.icon} size={16} color={color} />
              </View>
              {index < STEPS.length - 1 && (
                <View
                  style={[
                    styles.lineRight,
                    {
                      backgroundColor:
                        status === 'delivered' || index < currentIndex ? colors.success : colors.border,
                    },
                  ]}
                />
              )}
            </View>
            <Text style={[styles.label, (done || active) && styles.labelActive]}>{step.label}</Text>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', justifyContent: 'space-between' },
  stepWrap: { flex: 1, alignItems: 'center' },
  stepTop: { flexDirection: 'row', alignItems: 'center', width: '100%', justifyContent: 'center' },
  dot: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1,
  },
  lineLeft: { flex: 1, height: 3, borderRadius: 2, marginRight: -2 },
  lineRight: { flex: 1, height: 3, borderRadius: 2, marginLeft: -2 },
  label: { fontSize: 10, color: colors.textMuted, marginTop: 8, fontWeight: '600', textAlign: 'center' },
  labelActive: { color: colors.text, fontWeight: '700' },
  cancelled: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: 12,
    backgroundColor: colors.error + '12',
    borderRadius: 12,
  },
  cancelledText: { fontSize: 14, fontWeight: '700', color: colors.error },
});
