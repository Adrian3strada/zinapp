import React, { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import AppMap, { MapMarker } from './AppMap';
import RouteStatsBar from './RouteStatsBar';
import { colors } from '../theme/colors';
import { useStreetRoutes } from '../hooks/useStreetRoutes';
import type { MapCoordinate } from '../utils/maps';
import { regionForCoordinates } from '../utils/maps';
import type { StreetRouteSegment } from '../utils/routing';
import { mapHeight } from '../utils/responsive';

interface Props {
  pickup: MapCoordinate;
  delivery: MapCoordinate;
  height?: number;
}

export default function RoutePreviewMap({ pickup, delivery, height }: Props) {
  const markers = useMemo<MapMarker[]>(() => [
    { id: 'pickup', coordinate: pickup, title: 'Recoger', pinType: 'pickup' },
    { id: 'delivery', coordinate: delivery, title: 'Entregar', pinType: 'delivery' },
  ], [pickup, delivery]);

  const routeSegments = useMemo<StreetRouteSegment[]>(() => [{
    id: 'preview',
    from: pickup,
    to: delivery,
    strokeColor: colors.primary,
    strokeWidth: 3,
  }], [pickup, delivery]);

  const { polylines, stats, loading } = useStreetRoutes(routeSegments);
  const region = useMemo(() => regionForCoordinates([pickup, delivery]), [pickup, delivery]);

  return (
    <View style={styles.wrap}>
      <Text style={styles.title}>Vista previa de la ruta</Text>
      <AppMap
        markers={markers}
        polylines={polylines}
        region={region}
        height={height ?? mapHeight(0.24)}
      />
      <RouteStatsBar
        loading={loading}
        items={[{
          label: 'Distancia estimada',
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
