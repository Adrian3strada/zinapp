import Ionicons from '@expo/vector-icons/Ionicons';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { colors } from '../theme/colors';
import { cardShadow } from '../theme/shadows';
import type { MapCoordinate } from '../utils/maps';
import { isValidCoordinate } from '../utils/maps';

interface Props {
  coordinate: MapCoordinate | null;
  coverageOk: boolean | null;
  addressApproximate?: boolean;
}

/** Estado de ubicación sin MapView — evita cierres nativos en Android sin API key de Google Maps. */
export default function DeliveryLocationStatus({
  coordinate,
  coverageOk,
  addressApproximate,
}: Props) {
  const hasCoords = isValidCoordinate(coordinate);

  if (!hasCoords) {
    return (
      <View style={[styles.box, styles.pending]}>
        <Ionicons name="location-outline" size={22} color={colors.textMuted} />
        <Text style={styles.pendingText}>
          Usa «Buscar dirección» o «Usar mi ubicación» para marcar dónde entregar.
        </Text>
      </View>
    );
  }

  const lat = coordinate!.latitude.toFixed(5);
  const lng = coordinate!.longitude.toFixed(5);

  return (
    <View
      style={[
        styles.box,
        coverageOk === false ? styles.outOfZone : styles.ok,
      ]}
    >
      <Ionicons
        name={coverageOk === false ? 'warning' : 'checkmark-circle'}
        size={22}
        color={coverageOk === false ? colors.error : colors.success}
      />
      <View style={styles.body}>
        <Text style={styles.title}>
          {coverageOk === false
            ? 'Fuera de zona de entrega'
            : addressApproximate
              ? 'Ubicación aproximada confirmada'
              : 'Punto de entrega listo'}
        </Text>
        <Text style={styles.coords}>
          {lat}, {lng}
        </Text>
        {coverageOk === true && addressApproximate && (
          <Text style={styles.hint}>Revisa que la calle sea la correcta.</Text>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    ...cardShadow,
  },
  pending: {
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    borderStyle: 'dashed',
  },
  ok: {
    backgroundColor: colors.primaryLight,
    borderWidth: 1,
    borderColor: colors.success + '44',
  },
  outOfZone: {
    backgroundColor: colors.error + '12',
    borderWidth: 1,
    borderColor: colors.error + '44',
  },
  pendingText: {
    flex: 1,
    fontSize: 13,
    color: colors.textSecondary,
    lineHeight: 19,
  },
  body: { flex: 1, gap: 2 },
  title: { fontSize: 14, fontWeight: '700', color: colors.text },
  coords: { fontSize: 12, color: colors.textMuted, fontFamily: 'monospace' },
  hint: { fontSize: 12, color: colors.textSecondary, marginTop: 4 },
});
