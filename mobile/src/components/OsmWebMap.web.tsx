import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, View, ViewStyle } from 'react-native';

import { colors } from '../theme/colors';
import { cardShadow } from '../theme/shadows';
import type { MapCoordinate } from '../utils/maps';
import { isValidCoordinate, ZINAPECUARO_REGION } from '../utils/maps';
import type { OsmPinType } from '../utils/osmMapHtml';
import {
  buildOsmMapHtml,
  buildOsmMapLivePayload,
  type OsmMapMarker,
  type OsmMapPolyline,
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

/** Mapa OpenStreetMap en iframe (web). */
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

  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const [mapReady, setMapReady] = useState(false);
  const livePayload = useMemo(
    () => buildOsmMapLivePayload({ markers, polylines, followMarkerId, fitAll: !followMarkerId }),
    [markers, polylines, followMarkerId],
  );

  const pushLiveData = useCallback((payload: string) => {
    iframeRef.current?.contentWindow?.postMessage(
      JSON.stringify({ type: 'setMapData', payload: JSON.parse(payload) }),
      '*',
    );
  }, []);

  const pushPinPosition = useCallback((latitude: number, longitude: number) => {
    iframeRef.current?.contentWindow?.postMessage(
      JSON.stringify({ type: 'setPinPosition', latitude, longitude }),
      '*',
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
    const onWindowMessage = (event: MessageEvent) => {
      if (typeof event.data !== 'string') return;
      handleMessage(event.data);
    };
    window.addEventListener('message', onWindowMessage);
    return () => window.removeEventListener('message', onWindowMessage);
  }, [handleMessage]);

  useEffect(() => {
    setMapReady(false);
  }, [html]);

  return (
    <View
      style={[styles.wrapper, { height }, cardShadow, style]}
      onStartShouldSetResponder={() => true}
      onMoveShouldSetResponder={() => true}
      onResponderTerminationRequest={() => false}
    >
      <iframe
        ref={iframeRef}
        title="Mapa ZinApp"
        srcDoc={html}
        style={{
          border: 0,
          width: '100%',
          height: '100%',
          display: 'block',
          pointerEvents: 'auto',
          touchAction: 'none',
        } as React.CSSProperties}
        sandbox="allow-scripts allow-same-origin"
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
});
