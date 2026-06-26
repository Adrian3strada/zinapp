import React, { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { colors } from '../theme/colors';
import { cardShadow } from '../theme/shadows';
import { isValidCoordinate, ZINAPECUARO_REGION } from '../utils/maps';
import { toOsmMapMarkers } from './appMapShared';
import type { AppMapProps } from './AppMap.types';
import OsmWebMap from './OsmWebMap';

export type { MapMarker, MapPolyline } from './AppMap.types';

/** Mapa OSM para web (sin react-native-maps). */
export default function AppMap({
  markers = [],
  polylines = [],
  region,
  height = 220,
  style,
  emptyMessage,
  onMarkerPress,
  followMarkerId = null,
}: AppMapProps) {
  const initialRegion = region ?? ZINAPECUARO_REGION;

  const safeMarkers = useMemo(
    () => markers.filter((m) => isValidCoordinate(m.coordinate)),
    [markers],
  );

  const safePolylines = useMemo(
    () =>
      polylines
        .map((line) => ({
          ...line,
          coordinates: line.coordinates.filter(isValidCoordinate),
        }))
        .filter((line) => line.coordinates.length >= 2),
    [polylines],
  );

  if (safeMarkers.length === 0 && emptyMessage) {
    return (
      <View style={[styles.fallback, { height }, cardShadow, style]}>
        <Text style={styles.fallbackEmoji}>🗺️</Text>
        <Text style={styles.fallbackText}>{emptyMessage}</Text>
      </View>
    );
  }

  return (
    <OsmWebMap
      height={height}
      style={style}
      center={initialRegion}
      markers={toOsmMapMarkers(safeMarkers, followMarkerId)}
      polylines={safePolylines.map((line) => ({
        coordinates: line.coordinates,
        color: line.strokeColor,
      }))}
      followMarkerId={followMarkerId}
      onMarkerPress={
        onMarkerPress
          ? (markerId) => {
              const marker = safeMarkers.find((m) => m.id === markerId);
              if (marker) onMarkerPress(marker);
            }
          : undefined
      }
    />
  );
}

const styles = StyleSheet.create({
  fallback: {
    borderRadius: 16,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
  },
  fallbackEmoji: { fontSize: 32, marginBottom: 8 },
  fallbackText: { color: colors.textSecondary, textAlign: 'center', fontSize: 14 },
});
