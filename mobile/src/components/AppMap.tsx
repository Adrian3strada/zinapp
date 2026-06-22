import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Platform, StyleSheet, Text, View, ViewStyle } from 'react-native';
import MapView, { Marker, Polyline, PROVIDER_DEFAULT, Region } from 'react-native-maps';

import { colors } from '../theme/colors';
import { cardShadow } from '../theme/shadows';
import type { MapCoordinate } from '../utils/maps';
import { isValidCoordinate, ZINAPECUARO_REGION } from '../utils/maps';
import { shouldRenderNativeMap, shouldUseOsmWebMap } from '../utils/mapProvider';
import MapErrorBoundary from './MapErrorBoundary';
import MapPin, { MAP_PIN_ANCHOR, MapPinType } from './MapPin';
import OsmWebMap from './OsmWebMap';

export interface MapMarker {
  id: string;
  coordinate: MapCoordinate;
  title: string;
  description?: string;
  pinType?: MapPinType;
}

export interface MapPolyline {
  coordinates: MapCoordinate[];
  strokeColor?: string;
  strokeWidth?: number;
  lineDashPattern?: number[];
}

interface Props {
  markers?: MapMarker[];
  polylines?: MapPolyline[];
  region?: Region;
  height?: number;
  style?: ViewStyle;
  showsUserLocation?: boolean;
  followsUserLocation?: boolean;
  emptyMessage?: string;
  onMarkerPress?: (marker: MapMarker) => void;
  followMarkerId?: string | null;
}

const EDGE_PADDING = { top: 56, right: 48, bottom: 56, left: 48 };
const TRACK_EDGE_PADDING = { top: 72, right: 52, bottom: 88, left: 52 };
const FOLLOW_REGION_DELTA = { latitudeDelta: 0.014, longitudeDelta: 0.014 };

function osmMarkerColor(pinType?: MapPinType, id?: string): string {
  if (id === 'me') return '#2563EB';
  switch (pinType) {
    case 'delivery':
      return '#E53935';
    case 'driver':
      return colors.secondary;
    case 'pickup':
      return colors.accent;
    case 'restaurant':
    default:
      return colors.primary;
  }
}

function coordsMoved(a: MapCoordinate, b: MapCoordinate, threshold = 0.00004): boolean {
  if (!isValidCoordinate(a) || !isValidCoordinate(b)) return false;
  return (
    Math.abs(a.latitude - b.latitude) >= threshold
    || Math.abs(a.longitude - b.longitude) >= threshold
  );
}

function MapMarkerView({
  marker,
  followMarkerId,
  onPress,
}: {
  marker: MapMarker;
  followMarkerId: string | null;
  onPress?: () => void;
}) {
  const isMoving = marker.id === followMarkerId;
  const [tracksViewChanges, setTracksViewChanges] = useState(Platform.OS === 'android');

  useEffect(() => {
    if (Platform.OS !== 'android') return;
    setTracksViewChanges(true);
    const timer = setTimeout(() => setTracksViewChanges(false), isMoving ? 900 : 400);
    return () => clearTimeout(timer);
  }, [marker.coordinate.latitude, marker.coordinate.longitude, isMoving]);

  return (
    <Marker
      coordinate={marker.coordinate}
      title={marker.title}
      description={marker.description}
      anchor={MAP_PIN_ANCHOR}
      tracksViewChanges={Platform.OS === 'android' ? tracksViewChanges : false}
      zIndex={isMoving ? 3 : marker.pinType === 'delivery' ? 2 : 1}
      onPress={onPress}
    >
      <MapPin type={marker.pinType ?? 'restaurant'} />
    </Marker>
  );
}

export default function AppMap({
  markers = [],
  polylines = [],
  region,
  height = 220,
  style,
  showsUserLocation = false,
  followsUserLocation = false,
  emptyMessage,
  onMarkerPress,
  followMarkerId = null,
}: Props) {
  const mapRef = useRef<MapView>(null);
  const initialRegion = region ?? ZINAPECUARO_REGION;
  const lastFollowCoordRef = useRef<MapCoordinate | null>(null);
  const hasInitialFitRef = useRef(false);

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

  const followMarker = useMemo(
    () => safeMarkers.find((marker) => marker.id === followMarkerId) ?? null,
    [safeMarkers, followMarkerId],
  );

  const markerCoords = useMemo(() => safeMarkers.map((m) => m.coordinate), [safeMarkers]);

  useEffect(() => {
    if (!mapRef.current || markerCoords.length === 0) return;

    const followCoord = followMarker?.coordinate ?? null;
    const isFollowUpdate =
      !!followMarkerId
      && !!followCoord
      && lastFollowCoordRef.current
      && coordsMoved(lastFollowCoordRef.current, followCoord);

    if (
      followMarkerId
      && followCoord
      && lastFollowCoordRef.current
      && !coordsMoved(lastFollowCoordRef.current, followCoord, 0.000001)
    ) {
      return;
    }

    const timer = setTimeout(() => {
      if (followMarkerId && followCoord) {
        if (!hasInitialFitRef.current && markerCoords.length > 1) {
          hasInitialFitRef.current = true;
          mapRef.current?.fitToCoordinates(markerCoords, {
            edgePadding: TRACK_EDGE_PADDING,
            animated: true,
          });
        } else {
          mapRef.current?.animateToRegion(
            { ...followCoord, ...FOLLOW_REGION_DELTA },
            isFollowUpdate ? 600 : 400,
          );
        }
        lastFollowCoordRef.current = followCoord;
        return;
      }

      if (markerCoords.length === 1) {
        mapRef.current?.animateToRegion(
          {
            ...markerCoords[0],
            latitudeDelta: 0.012,
            longitudeDelta: 0.012,
          },
          400,
        );
        return;
      }

      mapRef.current?.fitToCoordinates(markerCoords, {
        edgePadding: EDGE_PADDING,
        animated: true,
      });
    }, followMarkerId ? 180 : 320);

    return () => clearTimeout(timer);
  }, [markerCoords, followMarkerId, followMarker?.coordinate.latitude, followMarker?.coordinate.longitude]);

  useEffect(() => {
    if (!followMarkerId) {
      lastFollowCoordRef.current = null;
      hasInitialFitRef.current = false;
    }
  }, [followMarkerId]);

  if (!shouldRenderNativeMap()) {
    if (shouldUseOsmWebMap()) {
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
          markers={safeMarkers.map((m) => ({
            id: m.id,
            coordinate: m.coordinate,
            color: osmMarkerColor(m.pinType, m.id),
            label: m.title,
          }))}
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
    return (
      <View style={[styles.fallback, { height }, cardShadow, style]}>
        <Text style={styles.fallbackEmoji}>🗺️</Text>
        <Text style={styles.fallbackText}>
          {emptyMessage ?? 'Mapa no disponible en este dispositivo. Usa «Buscar dirección» o «Mi ubicación».'}
        </Text>
      </View>
    );
  }

  if (safeMarkers.length === 0 && emptyMessage) {
    return (
      <View style={[styles.fallback, { height }, cardShadow, style]}>
        <Text style={styles.fallbackEmoji}>🗺️</Text>
        <Text style={styles.fallbackText}>{emptyMessage}</Text>
      </View>
    );
  }

  return (
    <MapErrorBoundary height={height} fallbackMessage={emptyMessage}>
      <View style={[styles.wrapper, { height }, cardShadow, style]}>
        <MapView
          ref={mapRef}
          style={styles.map}
          provider={PROVIDER_DEFAULT}
          initialRegion={initialRegion}
          showsUserLocation={showsUserLocation}
          showsMyLocationButton={showsUserLocation}
          followsUserLocation={followsUserLocation}
          scrollEnabled
          zoomEnabled
          rotateEnabled={false}
          pitchEnabled={false}
          liteMode={false}
        >
          {safePolylines.map((line, index) => (
            <Polyline
              key={`line-${index}`}
              coordinates={line.coordinates}
              strokeColor={line.strokeColor ?? colors.primary}
              strokeWidth={line.strokeWidth ?? 3}
              lineDashPattern={line.lineDashPattern}
            />
          ))}
          {safeMarkers.map((marker) => (
            <MapMarkerView
              key={marker.id}
              marker={marker}
              followMarkerId={followMarkerId}
              onPress={() => onMarkerPress?.(marker)}
            />
          ))}
        </MapView>
      </View>
    </MapErrorBoundary>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: colors.border,
  },
  map: { flex: 1 },
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
