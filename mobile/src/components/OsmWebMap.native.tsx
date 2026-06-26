import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Platform, StyleSheet, View, ViewStyle } from 'react-native';
import { WebView } from 'react-native-webview';

import { colors } from '../theme/colors';
import { cardShadow } from '../theme/shadows';
import type { MapCoordinate } from '../utils/maps';
import { isValidCoordinate, ZINAPECUARO_REGION } from '../utils/maps';
import {
  buildOsmMapHtml,
  buildOsmMapLivePayload,
  type OsmMapMarker,
  type OsmMapPolyline,
  type OsmPinType,
} from '../utils/osmMapHtml';

interface Props {
  height?: number;
  style?: ViewStyle;
  center?: MapCoordinate;
  zoom?: number;
  markers?: OsmMapMarker[];
  polylines?: OsmMapPolyline[];
  interactive?: boolean;
  pinCoordinate?: MapCoordinate | null;
  pinType?: OsmPinType;
  followMarkerId?: string | null;
  onCoordinateChange?: (coord: MapCoordinate) => void;
  onMarkerPress?: (markerId: string) => void;
}

/** Mapa OpenStreetMap en WebView (iOS/Android). */
export default function OsmWebMap({
  height = 220,
  style,
  center,
  zoom,
  markers = [],
  polylines = [],
  interactive = false,
  pinCoordinate = null,
  pinType = 'delivery',
  followMarkerId = null,
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
        pinType,
        followMarkerId,
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [mapCenter, zoom, interactive, pinType, pinCoordinate?.latitude, pinCoordinate?.longitude],
  );

  const webRef = useRef<WebView>(null);
  const [mapReady, setMapReady] = useState(false);
  const livePayload = useMemo(
    () => buildOsmMapLivePayload({ markers, polylines, followMarkerId, fitAll: !followMarkerId }),
    [markers, polylines, followMarkerId],
  );

  const pushLiveData = useCallback((payload: string) => {
    webRef.current?.injectJavaScript(
      `window.setMapData && window.setMapData(${payload}); true;`,
    );
  }, []);

  const pushPinPosition = useCallback((latitude: number, longitude: number) => {
    webRef.current?.injectJavaScript(
      `window.setPinPosition && window.setPinPosition(${latitude}, ${longitude}); true;`,
    );
  }, []);

  useEffect(() => {
    if (!mapReady) return;
    pushLiveData(livePayload);
  }, [mapReady, livePayload, pushLiveData]);

  useEffect(() => {
    if (!interactive || !isValidCoordinate(pinCoordinate) || !mapReady) return;
    pushPinPosition(pinCoordinate.latitude, pinCoordinate.longitude);
  }, [interactive, pinCoordinate?.latitude, pinCoordinate?.longitude, mapReady, pushPinPosition]);

  const handleMessage = useCallback(
    (raw: string) => {
      try {
        const data = JSON.parse(raw) as {
          type?: string;
          latitude?: number;
          longitude?: number;
          id?: string;
        };
        if (data.type === 'ready') {
          setMapReady(true);
          return;
        }
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

  useEffect(() => {
    setMapReady(false);
  }, [html]);

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
        onMessage={(event) => handleMessage(event.nativeEvent.data)}
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
