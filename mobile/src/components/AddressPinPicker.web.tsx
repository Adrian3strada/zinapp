import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { colors } from '../theme/colors';
import type { MapCoordinate } from '../utils/maps';
import { isValidCoordinate } from '../utils/maps';
import { roundCoordinate } from '../utils/coords';
import { mapHeight } from '../utils/responsive';
import MapErrorBoundary from './MapErrorBoundary';
import type { MapPinType } from './MapPin';
import OsmWebMap from './OsmWebMap';

interface Props {
  title: string;
  hint?: string;
  pinType?: MapPinType;
  coordinate: MapCoordinate | null;
  onCoordinateChange: (coord: MapCoordinate) => void;
  height?: number;
}

/** Selector de pin en mapa OSM (web, sin react-native-maps). */
export default function AddressPinPicker({
  title,
  hint = 'Toca el mapa o arrastra el pin para ajustar',
  pinType = 'delivery',
  coordinate,
  onCoordinateChange,
  height,
}: Props) {
  const mapHeightValue = height ?? mapHeight(0.24);
  const safeCoordinate = isValidCoordinate(coordinate) ? coordinate : null;

  const applyCoordinate = (coord: MapCoordinate) => {
    if (!isValidCoordinate(coord)) return;
    onCoordinateChange({
      latitude: parseFloat(roundCoordinate(coord.latitude)),
      longitude: parseFloat(roundCoordinate(coord.longitude)),
    });
  };

  return (
    <View style={styles.wrap}>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.hint}>{hint}</Text>
      <MapErrorBoundary height={mapHeightValue}>
        <OsmWebMap
          height={mapHeightValue}
          pinCoordinate={safeCoordinate}
          pinType={pinType}
          interactive
          onCoordinateChange={applyCoordinate}
        />
      </MapErrorBoundary>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginBottom: 10 },
  title: { fontSize: 14, fontWeight: '700', color: colors.text, marginBottom: 4 },
  hint: { fontSize: 12, color: colors.textMuted, marginBottom: 8 },
});
