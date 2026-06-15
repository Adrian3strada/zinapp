import Ionicons from '@expo/vector-icons/Ionicons';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { VEHICLE_OPTIONS } from '../constants/vehicleTypes';
import { colors } from '../theme/colors';
import { HIT_SLOP } from '../theme/spacing';
import type { DeliveryProfile } from '../types';

interface Props {
  value: DeliveryProfile['vehicle_type'];
  onChange: (value: NonNullable<DeliveryProfile['vehicle_type']>) => void;
}

export default function VehicleTypePicker({ value, onChange }: Props) {
  return (
    <View style={styles.row}>
      {VEHICLE_OPTIONS.map((opt) => {
        const active = value === opt.value;
        return (
          <Pressable
            key={opt.value}
            style={[styles.chip, active && styles.chipActive]}
            onPress={() => onChange(opt.value!)}
            hitSlop={HIT_SLOP}
          >
            <Ionicons
              name={opt.icon as keyof typeof Ionicons.glyphMap}
              size={20}
              color={active ? colors.primary : colors.textMuted}
            />
            <Text style={[styles.text, active && styles.textActive]}>{opt.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 4 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    minHeight: 48,
  },
  chipActive: { borderColor: colors.primary, backgroundColor: colors.primaryLight },
  text: { fontWeight: '600', color: colors.textMuted, fontSize: 14 },
  textActive: { color: colors.primary },
});
