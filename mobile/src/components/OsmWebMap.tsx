import React, { useCallback, useEffect, useMemo, useRef } from 'react';
import { Platform, StyleSheet, View, ViewStyle } from 'react-native';
import { WebView } from 'react-native-webview';

import { colors } from '../theme/colors';
import { cardShadow } from '../theme/shadows';
import type { MapCoordinate } from '../utils/maps';
import { isValidCoordinate, ZINAPECUARO_REGION } from '../utils/maps';
import { buildOsmMapHtml, type OsmMapMarker, type OsmMapPolyline } from '../utils/osmMapHtml';

interface Props {
  height?: number;
  style?: ViewStyle;
  center?: MapCoordinate;
  zoom?: number;
  markers?: OsmMapMarker[];
  polylines?: OsmMapPolyline[];
  interactive?: boolean;
  pinCoordinate?: MapCoordinate | null;
  onCoordinateChange?: (coord: MapCoordinate) => void;
  onMarkerPress?: (markerId: string) => void;
}

/** Mapa OpenStreetMap en WebView — funciona en Android release sin Google Maps API key. */
export default function OsmWebMap({
  height = 220,
  style,
  center,
  zoom,
  markers = [],
  polylines = [],
  interactive = false,
  pinCoordinate = null,
  onCoordinateChange,
  onMarkerPress,
}: Props) {
  const mapCenter = useMemo(() => {
    if (isValidCoordinate(center)) return center;
    if (isValidCoordinate(pinCoordinate)) return pinCoordinate;
    if (markers.length > 0 && isValidCoordinate(markers[0].coordinate)) {
      return markers[0].coordinate;
    }
    return {
      latitude: ZINAPECUARO_REGION.latitude,
      longitude: ZINAPECUARO_REGION.longitude,
    };
  }, [center, pinCoordinate, markers]);

  const html = useMemo(
    () =>
      buildOsmMapHtml({
        center: mapCenter,
        zoom,
        markers,
        polylines,
        interactive,
        pinCoordinate,
      }),
    [mapCenter, zoom, markers, polylines, interactive, pinCoordinate],
  );

  const webRef = useRef<WebView>(null);

  useEffect(() => {
    if (!interactive || !isValidCoordinate(pinCoordinate) || !webRef.current) return;
    const { latitude, longitude } = pinCoordinate;
    webRef.current.injectJavaScript(
      `window.setPinPosition && window.setPinPosition(${latitude}, ${longitude}); true;`,
    );
  }, [interactive, pinCoordinate?.latitude, pinCoordinate?.longitude]);

  const handleMessage = useCallback(
    (event: { nativeEvent: { data: string } }) => {
      try {
        const data = JSON.parse(event.nativeEvent.data) as {
          type?: string;
          latitude?: number;
          longitude?: number;
          id?: string;
        };
        if (
          data.type === 'move'
          && typeof data.latitude === 'number'
          && typeof data.longitude === 'number'
        ) {
          onCoordinateChange?.({ latitude: data.latitude, longitude: data.longitude });
          return;
        }
        if (data.type === 'markerPress' && typeof data.id === 'string') {
          onMarkerPress?.(data.id);
        }
      } catch {
        // ignore malformed messages
      }
    },
    [onCoordinateChange, onMarkerPress],
  );

  return (
    <View style={[styles.wrapper, { height }, cardShadow, style]}>
      <WebView
        ref={webRef}
        source={{ html }}
        style={styles.webview}
        originWhitelist={['*']}
        scrollEnabled={false}
        nestedScrollEnabled
        bounces={false}
        overScrollMode="never"
        javaScriptEnabled
        domStorageEnabled
        mixedContentMode="always"
        setSupportMultipleWindows={false}
        onMessage={handleMessage}
        {...(Platform.OS === 'android' ? { androidLayerType: 'hardware' as const } : {})}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: colors.border,
  },
  webview: {
    flex: 1,
    backgroundColor: colors.primaryLight,
  },
});
