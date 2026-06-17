import React, { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import AppMap, { MapMarker } from './AppMap';
import RouteStatsBar from './RouteStatsBar';
import type { MapPinType } from './MapPin';
import { colors } from '../theme/colors';
import { useStreetRoutes } from '../hooks/useStreetRoutes';
import type { MapCoordinate } from '../utils/maps';
import { regionForCoordinates } from '../utils/maps';
import type { StreetRouteSegment } from '../utils/routing';
import { mapHeight } from '../utils/responsive';

interface Props {
  from: MapCoordinate;
  to: MapCoordinate;
  height?: number;
  title?: string;
  fromMarker?: { title: string; pinType: MapPinType };
  toMarker?: { title: string; pinType: MapPinType };
  statsLabel?: string;
}

export default function RoutePreviewMap({
  from,
  to,
  height,
  title = 'Vista previa de la ruta',
  fromMarker = { title: 'Recoger', pinType: 'pickup' },
  toMarker = { title: 'Entregar', pinType: 'delivery' },
  statsLabel = 'Distancia estimada',
}: Props) {
  const markers = useMemo<MapMarker[]>(() => [
    { id: 'from', coordinate: from, title: fromMarker.title, pinType: fromMarker.pinType },
    { id: 'to', coordinate: to, title: toMarker.title, pinType: toMarker.pinType },
  ], [from, to, fromMarker.pinType, fromMarker.title, toMarker.pinType, toMarker.title]);

  const routeSegments = useMemo<StreetRouteSegment[]>(() => [{
    id: 'preview',
    from,
    to,
    strokeColor: colors.primary,
    strokeWidth: 4,
  }], [from, to]);

  const { polylines, stats, loading } = useStreetRoutes(routeSegments);
  const region = useMemo(() => regionForCoordinates([from, to]), [from, to]);

  return (
    <View style={styles.wrap}>
      <Text style={styles.title}>{title}</Text>
      <AppMap
        markers={markers}
        polylines={polylines}
        region={region}
        height={height ?? mapHeight(0.24)}
      />
      <RouteStatsBar
        loading={loading}
        items={[{
          label: statsLabel,
          stats: stats.preview,
          icon: 'navigate',
        }]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginTop: 12,
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
  },
  title: {
    fontSize: 13,
    fontWeight: '800',
    color: colors.textSecondary,
    marginBottom: 8,
  },
});
