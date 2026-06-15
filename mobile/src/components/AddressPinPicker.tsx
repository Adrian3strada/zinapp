import React, { useEffect, useMemo, useRef } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import MapView, { Marker, PROVIDER_DEFAULT, Region } from 'react-native-maps';

import { colors } from '../theme/colors';
import { cardShadow } from '../theme/shadows';
import type { MapCoordinate } from '../utils/maps';
import { ZINAPECUARO_REGION } from '../utils/maps';
import { mapHeight } from '../utils/responsive';
import MapPin, { MAP_PIN_ANCHOR, MapPinType } from './MapPin';

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

  const initialRegion: Region = useMemo(() => {
    if (coordinate) {
      return {
        ...coordinate,
        latitudeDelta: 0.012,
        longitudeDelta: 0.012,
      };
    }
    return ZINAPECUARO_REGION;
  }, []);

  useEffect(() => {
    if (!coordinate || !mapRef.current) return;
    mapRef.current.animateToRegion(
      {
        ...coordinate,
        latitudeDelta: 0.012,
        longitudeDelta: 0.012,
      },
      350,
    );
  }, [coordinate?.latitude, coordinate?.longitude]);

  const handlePress = (event: { nativeEvent: { coordinate: MapCoordinate } }) => {
    onCoordinateChange(event.nativeEvent.coordinate);
  };

  const handleDragEnd = (event: { nativeEvent: { coordinate: MapCoordinate } }) => {
    onCoordinateChange(event.nativeEvent.coordinate);
  };

  return (
    <View style={styles.wrap}>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.hint}>{hint}</Text>
      <View style={[styles.mapBox, { height: mapHeightValue }, cardShadow]}>
        <MapView
          ref={mapRef}
          style={styles.map}
          provider={PROVIDER_DEFAULT}
          initialRegion={initialRegion}
          onPress={handlePress}
          scrollEnabled
          zoomEnabled
          rotateEnabled={false}
          pitchEnabled={false}
        >
          {coordinate && (
            <Marker
              coordinate={coordinate}
              draggable
              onDragEnd={handleDragEnd}
              anchor={MAP_PIN_ANCHOR}
              tracksViewChanges={false}
            >
              <MapPin type={pinType} />
            </Marker>
          )}
        </MapView>
      </View>
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
});
