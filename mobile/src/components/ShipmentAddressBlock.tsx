import Ionicons from '@expo/vector-icons/Ionicons';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import Button from './Button';
import FormField from './FormField';
import { colors } from '../theme/colors';
import { spacing } from '../theme/spacing';

interface Props {
  title: string;
  fieldLabel: string;
  icon: keyof typeof Ionicons.glyphMap;
  placeholder: string;
  value: string;
  onChangeText: (text: string) => void;
  onGeocode: () => void;
  onUseLocation: () => void;
  geocoding: boolean;
  locating: boolean;
  coverageOk: boolean | null;
  approximate?: boolean;
}

export default function ShipmentAddressBlock({
  title,
  fieldLabel,
  icon,
  placeholder,
  value,
  onChangeText,
  onGeocode,
  onUseLocation,
  geocoding,
  locating,
  coverageOk,
  approximate = false,
}: Props) {
  return (
    <View style={styles.block}>
      <View style={styles.blockHeader}>
        <View style={styles.iconCircle}>
          <Ionicons name={icon} size={18} color={colors.primary} />
        </View>
        <Text style={styles.blockTitle}>{title}</Text>
      </View>
      <FormField
        label={fieldLabel}
        value={value}
        onChangeText={onChangeText}
        icon={icon}
        embedded
        placeholder={placeholder}
      />
      <View style={styles.actions}>
        <Button
          title="Buscar"
          variant="secondary"
          onPress={onGeocode}
          loading={geocoding}
          style={styles.actionBtn}
        />
        <Button
          title="Mi ubicación"
          variant="secondary"
          onPress={onUseLocation}
          loading={locating}
          style={styles.actionBtn}
        />
      </View>
      {coverageOk === true && !approximate && (
        <View style={styles.statusOk}>
          <Ionicons name="checkmark-circle" size={16} color={colors.success} />
          <Text style={styles.statusOkText}>Dirección confirmada en Zinapécuaro</Text>
        </View>
      )}
      {approximate && coverageOk !== false && (
        <View style={styles.statusApprox}>
          <Ionicons name="information-circle" size={16} color={colors.warning} />
          <Text style={styles.statusApproxText}>Ubicación aproximada — confirma el punto</Text>
        </View>
      )}
      {coverageOk === false && (
        <View style={styles.statusWarn}>
          <Ionicons name="alert-circle" size={16} color={colors.error} />
          <Text style={styles.statusWarnText}>Fuera de la zona de cobertura</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  block: {
    backgroundColor: colors.background,
    borderRadius: 14,
    padding: spacing.md,
    marginTop: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  blockHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: spacing.sm },
  iconCircle: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  blockTitle: { fontSize: 15, fontWeight: '800', color: colors.text },
  actions: { flexDirection: 'row', gap: 8 },
  actionBtn: { flex: 1 },
  statusOk: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8 },
  statusOkText: { fontSize: 12, color: colors.success, fontWeight: '600' },
  statusApprox: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8 },
  statusApproxText: { fontSize: 12, color: colors.warning, fontWeight: '600' },
  statusWarn: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8 },
  statusWarnText: { fontSize: 12, color: colors.error, fontWeight: '600' },
});
