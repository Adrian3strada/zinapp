import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { colors } from '../theme/colors';
import type { MapCoordinate } from '../utils/maps';
import { isValidCoordinate } from '../utils/maps';
import { mapHeight } from '../utils/responsive';
import OsmWebMap from './OsmWebMap';

interface Props {
  coordinate: MapCoordinate | null;
  onCoordinateChange: (coord: MapCoordinate) => void;
  height?: number;
}

/** Pin de entrega con mapa OSM (sin Google Maps nativo). */
export default function DeliveryPinPicker({
  coordinate,
  onCoordinateChange,
  height,
}: Props) {
  const mapHeightValue = height ?? mapHeight(0.28);
  const safeCoordinate = isValidCoordinate(coordinate) ? coordinate : null;

  const applyCoordinate = (coord: MapCoordinate) => {
    if (isValidCoordinate(coord)) {
      onCoordinateChange(coord);
    }
  };

  return (
    <View style={styles.wrap}>
      <Text style={styles.title}>Punto de entrega en el mapa</Text>
      <Text style={styles.hint}>Toca el mapa o arrastra el pin para ajustar</Text>
      <OsmWebMap
        height={mapHeightValue}
        pinCoordinate={safeCoordinate}
        interactive
        onCoordinateChange={applyCoordinate}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginBottom: 10 },
  title: { fontSize: 14, fontWeight: '700', color: colors.text, marginBottom: 4 },
  hint: { fontSize: 12, color: colors.textMuted, marginBottom: 8 },
});
