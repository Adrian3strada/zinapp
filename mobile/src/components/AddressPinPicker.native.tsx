import React, { useEffect, useMemo, useRef } from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';
import MapView, { Marker, PROVIDER_DEFAULT, Region } from 'react-native-maps';

import { colors } from '../theme/colors';
import { cardShadow } from '../theme/shadows';
import type { MapCoordinate } from '../utils/maps';
import { isValidCoordinate, ZINAPECUARO_REGION } from '../utils/maps';
import { shouldRenderNativeMap, shouldUseOsmWebMap } from '../utils/mapProvider';
import { mapHeight } from '../utils/responsive';
import MapErrorBoundary from './MapErrorBoundary';
import MapPin, { MAP_PIN_ANCHOR, MapPinType } from './MapPin';
import OsmWebMap from './OsmWebMap';

interface Props {
  title: string;
  hint?: string;
  pinType?: MapPinType;
  coordinate: MapCoordinate | null;
  onCoordinateChange: (coord: MapCoordinate) => void;
  height?: number;
}

export default function AddressPinPicker({
  title,
  hint = 'Toca el mapa o arrastra el pin para ajustar',
  pinType = 'delivery',
  coordinate,
  onCoordinateChange,
  height,
}: Props) {
  const mapRef = useRef<MapView>(null);
  const mapHeightValue = height ?? mapHeight(0.24);
  const safeCoordinate = isValidCoordinate(coordinate) ? coordinate : null;

  const initialRegion: Region = useMemo(() => {
    if (safeCoordinate) {
      return {
        ...safeCoordinate,
        latitudeDelta: 0.012,
        longitudeDelta: 0.012,
      };
    }
    return ZINAPECUARO_REGION;
  }, []);

  useEffect(() => {
    if (!safeCoordinate || !mapRef.current) return;
    mapRef.current.animateToRegion(
      {
        ...safeCoordinate,
        latitudeDelta: 0.012,
        longitudeDelta: 0.012,
      },
      350,
    );
  }, [safeCoordinate?.latitude, safeCoordinate?.longitude]);

  const applyCoordinate = (coord: MapCoordinate) => {
    if (isValidCoordinate(coord)) {
      onCoordinateChange(coord);
    }
  };

  if (!shouldRenderNativeMap()) {
    if (shouldUseOsmWebMap()) {
      return (
        <View style={styles.wrap}>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.hint}>{hint}</Text>
          <OsmWebMap
            height={mapHeightValue}
            pinCoordinate={safeCoordinate}
            interactive
            onCoordinateChange={applyCoordinate}
          />
        </View>
      );
    }
    return (
      <View style={styles.wrap}>
        <Text style={styles.title}>{title}</Text>
        <View style={[styles.mapBox, styles.fallback, { height: mapHeightValue }, cardShadow]}>
          <Text style={styles.fallbackText}>
            Mapa no disponible. Escribe tu dirección con colonia y calle.
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.wrap}>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.hint}>{hint}</Text>
      <MapErrorBoundary height={mapHeightValue}>
        <View style={[styles.mapBox, { height: mapHeightValue }, cardShadow]}>
          <MapView
            ref={mapRef}
            style={styles.map}
            provider={PROVIDER_DEFAULT}
            initialRegion={initialRegion}
            onPress={(event) => applyCoordinate(event.nativeEvent.coordinate)}
            scrollEnabled
            zoomEnabled
            rotateEnabled={false}
            pitchEnabled={false}
            liteMode={false}
          >
            {safeCoordinate && (
              <Marker
                coordinate={safeCoordinate}
                draggable
                onDragEnd={(event) => applyCoordinate(event.nativeEvent.coordinate)}
                anchor={MAP_PIN_ANCHOR}
                tracksViewChanges={false}
              >
                <MapPin type={pinType} />
              </Marker>
            )}
          </MapView>
        </View>
      </MapErrorBoundary>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginBottom: 10 },
  title: { fontSize: 14, fontWeight: '700', color: colors.text, marginBottom: 4 },
  hint: { fontSize: 12, color: colors.textMuted, marginBottom: 8 },
  mapBox: {
    borderRadius: 14,
    overflow: 'hidden',
    backgroundColor: colors.border,
  },
  map: { flex: 1 },
  fallback: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    backgroundColor: colors.primaryLight,
  },
  fallbackText: { color: colors.textSecondary, textAlign: 'center', fontSize: 13, lineHeight: 19 },
});
