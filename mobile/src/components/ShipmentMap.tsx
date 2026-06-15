import React, { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import LiveBadge from './LiveBadge';
import RouteStatsBar from './RouteStatsBar';
import { colors } from '../theme/colors';
import { useStreetRoutes } from '../hooks/useStreetRoutes';
import type { Shipment } from '../types';
import { formatTimeAgo } from '../utils/format';
import type { StreetRouteSegment } from '../utils/routing';
import { regionForCoordinates, toCoordinate } from '../utils/maps';
import { mapHeight } from '../utils/responsive';
import AppMap, { MapMarker } from './AppMap';

interface Props {
  shipment: Shipment;
  height?: number;
  followDriver?: boolean;
}

export default function ShipmentMap({ shipment, height, followDriver = false }: Props) {
  const mapHeightValue = height ?? mapHeight(0.32);
  const isEnRoute = shipment.status === 'on_the_way';
  const isPickupPhase = shipment.status === 'picked_up';
  const isLive = isEnRoute;
  const isTracking = followDriver && (isEnRoute || isPickupPhase);

  const { markers, routeSegments, missing, driverNote, locationAgo, isTrackingActive } = useMemo(() => {
    const list: MapMarker[] = [];
    const segments: StreetRouteSegment[] = [];
    const absent: string[] = [];
    let note: string | null = null;

    const pickup = toCoordinate(shipment.pickup_latitude, shipment.pickup_longitude);
    const delivery = toCoordinate(shipment.delivery_latitude, shipment.delivery_longitude);
    const driver = toCoordinate(shipment.driver_latitude, shipment.driver_longitude);

    if (pickup) {
      list.push({
        id: 'pickup',
        coordinate: pickup,
        title: 'Recoger',
        description: shipment.pickup_address,
        pinType: 'pickup',
      });
    } else {
      absent.push('recogida');
    }

    if (delivery) {
      list.push({
        id: 'delivery',
        coordinate: delivery,
        title: 'Entregar',
        description: shipment.delivery_address,
        pinType: 'delivery',
      });
    } else {
      absent.push('entrega');
    }

    if (pickup && delivery) {
      segments.push({
        id: 'pickup-delivery',
        from: pickup,
        to: delivery,
        strokeColor: colors.primary,
        strokeWidth: 3,
        lineDashPattern: [6, 4],
      });
    }

    if (isEnRoute && shipment.driver) {
      if (driver) {
        list.push({
          id: 'driver',
          coordinate: driver,
          title: 'Repartidor',
          description: shipment.driver_detail?.first_name ?? 'En camino',
          pinType: 'driver',
        });
        if (delivery) {
          segments.push({
            id: 'driver-delivery',
            from: driver,
            to: delivery,
            strokeColor: colors.success,
            strokeWidth: 4,
            dynamic: true,
          });
        }
        if (isTracking) {
          note = 'Seguimiento en vivo del repartidor.';
        }
      } else {
        absent.push('ubicación del repartidor');
        note = 'Esperando ubicación GPS del repartidor…';
      }
    } else if (isPickupPhase && shipment.driver) {
      if (driver) {
        list.push({
          id: 'driver',
          coordinate: driver,
          title: 'Repartidor',
          description: shipment.driver_detail?.first_name ?? 'Va a recoger',
          pinType: 'driver',
        });
        if (pickup) {
          segments.push({
            id: 'driver-pickup',
            from: driver,
            to: pickup,
            strokeColor: colors.primary,
            strokeWidth: 4,
            dynamic: true,
          });
        }
        if (isTracking) {
          note = 'El repartidor va hacia el punto de recogida.';
        }
      } else {
        absent.push('ubicación del repartidor');
        note = 'Esperando ubicación GPS del repartidor…';
      }
    } else if (shipment.status === 'pending' && shipment.driver) {
      note = 'El repartidor aparecerá en el mapa cuando acepte la recogida.';
    }

    const ago = formatTimeAgo(shipment.driver_location_updated_at);

    return {
      markers: list,
      routeSegments: segments,
      missing: absent,
      driverNote: note,
      locationAgo: ago,
      isTrackingActive: isTracking && !!list.find((m) => m.id === 'driver'),
    };
  }, [shipment, isTracking, isEnRoute, isPickupPhase]);

  const { polylines, stats, loading } = useStreetRoutes(routeSegments);

  const routeStatItems = useMemo(() => {
    const items = [];
    if (stats['driver-delivery']) {
      items.push({
        label: 'ETA repartidor',
        stats: stats['driver-delivery'],
        icon: 'bicycle' as const,
      });
    }
    if (stats['driver-pickup']) {
      items.push({
        label: 'ETA recogida',
        stats: stats['driver-pickup'],
        icon: 'cube' as const,
      });
    }
    if (stats['pickup-delivery']) {
      items.push({
        label: 'Ruta del envío',
        stats: stats['pickup-delivery'],
        icon: 'map' as const,
      });
    }
    return items;
  }, [stats]);

  if (markers.length === 0) {
    return (
      <View style={[styles.fallback, { height: mapHeightValue }]}>
        <Text style={styles.fallbackEmoji}>📍</Text>
        <Text style={styles.fallbackText}>Sin coordenadas para este envío.</Text>
        {missing.length > 0 && (
          <Text style={styles.fallbackHint}>
            Falta: {missing.join(', ')}. Usa «Buscar» o «Mi ubicación» al crear el envío.
          </Text>
        )}
      </View>
    );
  }

  const region = regionForCoordinates(markers.map((m) => m.coordinate));

  return (
    <View>
      {isTrackingActive && (
        <View style={styles.liveWrap}>
          <LiveBadge suffix={locationAgo} />
        </View>
      )}
      <AppMap
        markers={markers}
        polylines={polylines}
        region={region}
        height={mapHeightValue}
        followMarkerId={isTrackingActive ? 'driver' : null}
        emptyMessage="Sin coordenadas para mostrar el mapa"
      />
      <RouteStatsBar items={routeStatItems} loading={loading} />
      <View style={styles.legend}>
        {markers.some((m) => m.pinType === 'pickup') && (
          <Text style={styles.legendItem}>📦 Recoger</Text>
        )}
        {markers.some((m) => m.pinType === 'delivery') && (
          <Text style={styles.legendItem}>📍 Entregar</Text>
        )}
        {markers.some((m) => m.pinType === 'driver') && (
          <Text style={styles.legendItem}>🛵 Repartidor</Text>
        )}
      </View>
      {driverNote && <Text style={styles.driverNote}>{driverNote}</Text>}
      {missing.length > 0 && (
        <Text style={styles.missingNote}>Pendiente: {missing.join(', ')}</Text>
      )}
    </View>
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
  fallbackText: { color: colors.textSecondary, textAlign: 'center', fontSize: 14, fontWeight: '600' },
  fallbackHint: { color: colors.textMuted, textAlign: 'center', fontSize: 12, marginTop: 8, lineHeight: 18 },
  liveWrap: { marginBottom: 8 },
  legend: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginTop: 10, justifyContent: 'center' },
  legendItem: { fontSize: 12, color: colors.textSecondary, fontWeight: '600' },
  driverNote: {
    fontSize: 12,
    color: colors.info,
    textAlign: 'center',
    marginTop: 8,
    fontWeight: '500',
  },
  missingNote: { fontSize: 11, color: colors.warning, textAlign: 'center', marginTop: 6 },
});
